import type { PayloadRequest } from "payload";
import { publicPathFor } from "../types";
import { KV_KEYS, kvDelete, kvList, kvPut } from "./kv";

/** Old-slug redirects. Written here when an editor renames a document; read
 *  at build time by next.config.mjs, which turns each entry into a permanent
 *  redirect.
 *
 *  THE PROBLEM. Every slug on this site is a URL, and every URL that has been
 *  live has been crawled, linked and bookmarked. Changing `slug` on a
 *  published book used to do exactly two things: move the page to a new URL,
 *  and turn the old one into a 404 — silently, with no warning at save time
 *  beyond a field description asking editors to treat slugs as permanent. The
 *  cost lands entirely on the old URL: accumulated links stop counting, the
 *  indexed page drops out, and anyone arriving from an external link gets
 *  nothing. Google's guidance on this is not subtle — a moved page needs a 301.
 *
 *  WHY A FULL PATH IS STORED, NOT JUST THE SLUG. The value written is
 *  `{ from: "/book/old-slug", to: "/book/new-slug" }`. next.config.mjs then
 *  needs no knowledge of which collection lives under which URL prefix — it
 *  reads pairs and emits redirects. The alternative (store slugs, rebuild the
 *  paths in the config) means the same collection→prefix map exists in two
 *  files, in two languages, one of which cannot import the other.
 *
 *  WHY IT WORKS UNDER THE DEPLOY-HOOK MODEL. `redirects()` in next.config.mjs
 *  is evaluated once per build. A slug change also triggers a rebuild (see
 *  ./revalidate.ts), so the redirect is in place in the same deployment that
 *  moves the page. The two are never out of step, which is exactly the
 *  property a request-time redirect lookup would have to work for.
 *
 *  THE INVARIANT THIS FILE OWES THE CONFIG: no stored redirect may point away
 *  from a slug that is currently in use. Next matches redirects before the
 *  filesystem, so violating it takes a live page off the site. See the reclaim
 *  in `recordSlugChange`.
 *
 *  Failures are swallowed. A missing redirect is an SEO regression; a thrown
 *  error in an afterChange hook is a save that looks broken to the editor. */

/** Where each slugged collection's documents live in the URL space: now
 *  COLLECTION_URL_PREFIXES in lib/types.ts, read through publicPathFor()
 *  below, because the admin's live-link column needs the same map from a client
 *  component and two copies of it is how the redirect and the link end up
 *  pointing at different URLs. publicPathFor() also owns the slug-shape check
 *  this file used to do with its own local pattern.
 *
 *  Chapters are still absent from that map on purpose: a chapter's URL needs
 *  its parent book's slug, which this hook receives as a bare id. */

/** Two years. Long enough that the redirect outlives the crawl cycle and any
 *  reasonable stock of external links; bounded so the table does not carry
 *  every rename ever made forever. */
const REDIRECT_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export interface SlugRedirect {
  from: string;
  to: string;
}

/** Called from the afterChange hooks in ./revalidate.ts, on every save of
 *  every collection that has one — creates and draft saves included, because
 *  the reclaim below has to run on those too.
 *
 *  Beyond that it does nothing unless the slug actually changed. */
export async function recordSlugChange({
  collectionSlug,
  doc,
  previousDoc,
  req,
}: {
  collectionSlug: string | undefined;
  doc: Record<string, any> | undefined;
  previousDoc: Record<string, any> | undefined;
  req: PayloadRequest;
}): Promise<void> {
  if (!collectionSlug) return;

  const oldSlug = typeof previousDoc?.slug === "string" ? previousDoc.slug : null;
  const newSlug = typeof doc?.slug === "string" ? doc.slug : null;

  // RECLAIM, AND IT HAS TO COME FIRST.
  //
  // Next matches `redirects()` BEFORE the filesystem, so a stored redirect
  // whose source is also a live page wins — permanently, with a 301 that
  // browsers cache for as long as they like. Two ordinary editor actions reach
  // that state: renaming a→b and later back b→a, and creating a new document
  // that reuses a slug some older document has retired (nothing stops that, and
  // the entry lives for two years). Either way the fix is the same one fact:
  // this slug is in use NOW, so it must not redirect away from itself.
  //
  // One indexed DELETE on a unique key, on every save, outside the request's
  // transaction. Doing it unconditionally is the point — on a create there is
  // no previousDoc to compare against, so there is nothing to be conditional
  // on, and a read to decide whether to delete would cost the same round trip.
  if (newSlug && publicPathFor(collectionSlug, newSlug)) {
    try {
      await kvDelete(req.payload, KV_KEYS.redirect(collectionSlug, newSlug));
    } catch (error) {
      req.payload.logger.error(
        `[redirects] could not clear a stale redirect for ${collectionSlug}/${newSlug}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (!oldSlug || !newSlug || oldSlug === newSlug) return;

  const from = publicPathFor(collectionSlug, oldSlug);
  const to = publicPathFor(collectionSlug, newSlug);
  if (!from || !to || from === to) return;

  try {
    await kvPut(
      req.payload,
      KV_KEYS.redirect(collectionSlug, oldSlug),
      { from, to } satisfies SlugRedirect,
      REDIRECT_TTL_MS,
    );

    // CHAIN COLLAPSE. Rename a→b, then b→c, and the first entry still points
    // at /book/b, which is now itself a 404. Next.js will not follow one
    // redirect into another (`redirects()` entries are not re-applied to their
    // own output), so a→b→c would leave every link to `a` broken by the second
    // rename. Rewriting the earlier entries to the final destination keeps
    // every historical URL one hop from the live page.
    const existing = await kvList(req.payload, `bdw:redirect:${collectionSlug}:`);
    for (const entry of existing) {
      const value = entry.value as SlugRedirect | null;
      if (!value || value.to !== from) continue;
      await kvPut(req.payload, entry.key, { from: value.from, to }, REDIRECT_TTL_MS);
    }

    req.payload.logger.info(
      `[redirects] ${from} -> ${to} recorded; it will take effect in the next deployment.`,
    );
  } catch (error) {
    req.payload.logger.error(
      `[redirects] could not record ${from} -> ${to}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/** Every live redirect, for anything running inside the Payload/TS graph that
 *  wants them (a diagnostics view, a test). next.config.mjs cannot call this —
 *  it is plain ESM loaded outside the bundler — and queries the same rows
 *  directly with `pg` instead; the shape written above is the contract between
 *  the two. */
export async function listSlugRedirects(req: PayloadRequest): Promise<SlugRedirect[]> {
  const rows = await kvList(req.payload, "bdw:redirect:");
  const out: SlugRedirect[] = [];
  for (const row of rows) {
    const value = row.value as SlugRedirect | null;
    if (value?.from && value?.to && value.from !== value.to) out.push(value);
  }
  return out;
}

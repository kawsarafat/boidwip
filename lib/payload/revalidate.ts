import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  Payload,
} from "payload";
import { KV_KEYS, kvClaim, kvDelete, kvForceClaim, kvGet, kvPut } from "./kv";
import { recordSlugChange } from "./slugHistory";

/** Publishing = rebuilding. The deploy hook is fired from here, debounced.
 *
 *  WHAT THIS FILE USED TO CLAIM, AND WHY IT COULD NOT WORK. It described
 *  itself as tag-based invalidation: data helpers carrying `'use cache'` +
 *  `cacheTag(...)`, and this module calling `revalidateTag(tag, 'max')` so a
 *  synopsis edit refreshed one page instead of rebuilding the site. Every
 *  sentence of that was aspirational. `cacheComponents` is not enabled in
 *  next.config.mjs, so `'use cache'` and `cacheTag()` are not available and
 *  lib/data.ts contains neither; there was therefore no cache entry anywhere
 *  in the project carrying any of the fourteen tags this file invalidated.
 *  Worse, every route sets `dynamicParams = false` alongside
 *  `generateStaticParams()`, which means a slug that did not exist at build
 *  time returns 404 no matter what any cache is told — a newly published book
 *  could not appear at all. The tag fan-out was elaborate, carefully
 *  commented, and inert.
 *
 *  THE ARCHITECTURE THIS FILE NOW IMPLEMENTS, stated once so the next reader
 *  does not have to infer it: the site is a build artefact. `lib/data.ts`
 *  loads the catalogue through the Local API at build time, every route
 *  prerenders from that snapshot, and NOTHING queries Postgres at request
 *  time. Publishing therefore has exactly one meaning — trigger a deployment
 *  — and this module's whole job is to do that at most once per burst.
 *
 *  THE TRADE-OFF, WHICH IS REAL AND MUST BE TOLD TO EDITORS: a publish is
 *  visible when the deployment finishes, not when Save is pressed. Typically
 *  a couple of minutes. `/preview` exists for seeing a draft immediately.
 *  Set against that, the model has no request-time database traffic, no cache
 *  coherency to reason about, and no way for a page to be stale in a way the
 *  build cannot reproduce.
 *
 *  WHY DEBOUNCE. One editor action is several hook invocations: saving a book
 *  fires afterChange on the book, and often on chapters and relationship
 *  documents within the same few seconds. Undebounced, that is one deployment
 *  each. The claim below is atomic and lives in Postgres (see ./kv.ts), not in
 *  a module-level variable, because Vercel functions share nothing — two
 *  concurrent saves land on two instances and a local variable would let both
 *  through.
 *
 *  Nothing here throws. The content is already committed by the time these
 *  hooks run; a deploy hook that is unreachable must not make an editor's save
 *  look like it failed. Failures set the dirty marker instead, and the daily
 *  cron (app/(frontend)/api/cron/rebuild) sweeps it up.
 *
 *  The opt-out is still `context: { skipRevalidate: true }` — the name is kept
 *  even though nothing revalidates any more, because content-seed/seed.mts
 *  passes it on every one of its ~40 writes and a rename would silently make
 *  seeding trigger forty deployments. */

/** How long one claim holds off further deploy triggers. Long enough to
 *  swallow the hook fan-out of a single editor action and a quick follow-up
 *  correction; short enough that a deliberate second publish a couple of
 *  minutes later gets its own build. */
const DEBOUNCE_MS = 90_000;

/** How long a deferred/failed trigger stays recorded, waiting for the cron.
 *  A week is far longer than needed (the cron runs daily) and costs one row. */
const DIRTY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The deploy hook gets ten seconds. `fetch` has NO default timeout, so
 *  without this a hook that accepts the connection and never answers holds the
 *  invocation open until the platform kills it. */
const HOOK_TIMEOUT_MS = 10_000;

type Logger = {
  error: (message: string) => void;
  info: (message: string) => void;
  warn?: (message: string) => void;
};

export interface RebuildOutcome {
  /** True only when a deployment was actually requested. */
  triggered: boolean;
  status: "triggered" | "deferred" | "unconfigured" | "failed" | "skipped";
  /** Human-readable, safe to log. Never contains the hook URL. */
  detail: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** POSTs the deploy hook. Returns whether Vercel accepted it.
 *
 *  The URL is never logged, on any path. A Vercel deploy hook URL is a
 *  credential — it contains the hook's id and anyone holding it can trigger a
 *  production build — so only the status code goes anywhere. */
async function postDeployHook(logger: Logger): Promise<boolean> {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) return false;
  try {
    const res = await fetch(hookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.error(`[rebuild] deploy hook responded ${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    logger.error(`[rebuild] deploy hook request failed: ${errorMessage(error)}`);
    return false;
  }
}

/** Records that a rebuild is owed. Read and cleared by the daily cron.
 *
 *  Best-effort by design: if the database write that records "we still owe a
 *  build" itself fails, there is nothing useful left to do but log it. The
 *  cron rebuilds unconditionally every day regardless of this marker, so the
 *  worst case is a page that is stale until then rather than forever. */
async function markDirty(payload: Payload, reason: string): Promise<void> {
  try {
    await kvPut(
      payload,
      KV_KEYS.rebuildDirty,
      { reason, at: new Date().toISOString() },
      DIRTY_TTL_MS,
    );
  } catch (error) {
    payload.logger.error(
      `[rebuild] could not record the pending rebuild: ${errorMessage(error)}`,
    );
  }
}

async function clearDirty(payload: Payload): Promise<void> {
  try {
    await kvDelete(payload, KV_KEYS.rebuildDirty);
  } catch {
    // A stale marker only costs one redundant deployment on the next cron run.
  }
}

/** What the cron reports: is a rebuild owed, and what asked for it? */
export async function pendingRebuild(
  payload: Payload,
): Promise<{ reason: string; at: string } | null> {
  try {
    return await kvGet<{ reason: string; at: string }>(payload, KV_KEYS.rebuildDirty);
  } catch {
    return null;
  }
}

/** THE DEBOUNCED TRIGGER. Every editor-facing hook goes through here.
 *
 *  Four outcomes, all of them silent to the editor:
 *    unconfigured  no VERCEL_DEPLOY_HOOK_URL (local dev, or an install that
 *                  has not been wired up yet) — logged once per save, loudly
 *                  enough to be findable, because on a deployed site this
 *                  means publishing does nothing.
 *    deferred      another trigger holds the claim; the marker is set so the
 *                  cron will pick it up if nothing else does.
 *    failed        the hook was reachable but refused; marker set.
 *    triggered     a deployment is building.
 *
 *  A FAILURE TO CLAIM IS TREATED AS A CLAIM. If the KV write itself throws
 *  (database hiccup mid-save), the choice is between one redundant deployment
 *  and a publish that never appears. Redundant builds are cheap and visible;
 *  silently unpublished content is neither. */
export async function queueRebuild(
  payload: Payload,
  reason: string,
): Promise<RebuildOutcome> {
  const logger = payload.logger as Logger;

  if (!process.env.VERCEL_DEPLOY_HOOK_URL) {
    logger.info(
      `[rebuild] ${reason}: VERCEL_DEPLOY_HOOK_URL is not set, so nothing will rebuild. Content is saved; the live site will not change until the next deployment.`,
    );
    return {
      triggered: false,
      status: "unconfigured",
      detail: "VERCEL_DEPLOY_HOOK_URL is not set.",
    };
  }

  let claimed: boolean;
  try {
    claimed = await kvClaim(payload, KV_KEYS.rebuild, DEBOUNCE_MS);
  } catch (error) {
    logger.error(
      `[rebuild] debounce claim failed, triggering anyway: ${errorMessage(error)}`,
    );
    claimed = true;
  }

  if (!claimed) {
    await markDirty(payload, reason);
    logger.info(`[rebuild] ${reason}: folded into the deployment already queued.`);
    return {
      triggered: false,
      status: "deferred",
      detail: "A deployment was already queued within the debounce window.",
    };
  }

  if (!(await postDeployHook(logger))) {
    await markDirty(payload, reason);
    return {
      triggered: false,
      status: "failed",
      detail: "The deploy hook did not accept the request; the daily cron will retry.",
    };
  }

  await clearDirty(payload);
  logger.info(`[rebuild] deployment triggered by ${reason}.`);
  return { triggered: true, status: "triggered", detail: "Deployment requested." };
}

/** THE UNDEBOUNCED TRIGGER. Two callers only: the daily cron, and deletion.
 *
 *  The cron must fire unconditionally — it is what brings a book with a future
 *  publishDate live on the day, and no editor action happens at that moment to
 *  debounce against.
 *
 *  Deletion uses it because on this site a delete may be a TAKEDOWN. A
 *  deferred trigger relies on the cron, which is up to twenty-four hours away,
 *  and "we removed it from the CMS but the page stayed up until tomorrow" is
 *  not an answer to a rights holder. The cost is that deleting fifty books
 *  fires fifty deployments — for a bulk operation, pass
 *  `context: { skipRevalidate: true }` and trigger one rebuild at the end,
 *  which is precisely what that flag is for.
 *
 *  It still takes the claim afterwards (unconditionally, by overwriting it),
 *  so a publish landing one second later is folded in rather than starting a
 *  second build. */
export async function forceRebuild(
  payload: Payload,
  reason: string,
): Promise<RebuildOutcome> {
  const logger = payload.logger as Logger;

  if (!process.env.VERCEL_DEPLOY_HOOK_URL) {
    logger.info(`[rebuild] ${reason}: VERCEL_DEPLOY_HOOK_URL is not set, nothing to trigger.`);
    return {
      triggered: false,
      status: "unconfigured",
      detail: "VERCEL_DEPLOY_HOOK_URL is not set.",
    };
  }

  if (!(await postDeployHook(logger))) {
    await markDirty(payload, reason);
    return {
      triggered: false,
      status: "failed",
      detail: "The deploy hook did not accept the request.",
    };
  }

  try {
    await kvForceClaim(payload, KV_KEYS.rebuild, DEBOUNCE_MS);
  } catch {
    // Only affects debouncing of the next few seconds.
  }
  await clearDirty(payload);
  logger.info(`[rebuild] deployment triggered by ${reason} (undebounced).`);
  return { triggered: true, status: "triggered", detail: "Deployment requested." };
}

/** A stable, log-safe name for whatever asked for the rebuild. Slug first
 *  because that is what an editor recognises in a log line; the id is the
 *  fallback for collections without one. */
function describe(collectionSlug: string | undefined, doc: Record<string, any>): string {
  const identifier =
    (typeof doc?.slug === "string" && doc.slug) || doc?.id || "unknown";
  return `${collectionSlug ?? "unknown"}/${identifier}`;
}

/** For draft-enabled collections: rebuild only when a document crosses the
 *  published boundary, or when an already-live document is edited. Draft→draft
 *  saves change nothing a visitor can see, and a deployment per draft save
 *  would make drafting unusable. */
export const rebuildOnPublish: CollectionAfterChangeHook = async ({
  collection,
  doc,
  previousDoc,
  req,
}) => {
  if (req?.context?.skipRevalidate) return doc;

  // Runs on every save, before the publish-boundary check below: a slug can be
  // corrected on a draft, and the redirect from the old URL still has to exist
  // once that draft goes live. Recording it is idempotent.
  await recordSlugChange({ collectionSlug: collection?.slug, doc, previousDoc, req });

  const isPublished = doc?._status === "published";
  const wasPublished = previousDoc?._status === "published";
  if (!isPublished && !wasPublished) return doc;

  // A book with a future publishDate is published in the CMS but deliberately
  // still hidden by lib/data.ts's date filter, so building now would produce
  // an identical site. The daily cron brings it live on the day — that is the
  // whole point of scheduling.
  if (isPublished && !wasPublished) {
    const publishDate = doc?.publishDate ? new Date(doc.publishDate).getTime() : 0;
    if (publishDate > Date.now()) {
      req.payload.logger.info(
        `[rebuild] "${doc?.title ?? doc?.id}" is scheduled for ${doc?.publishDate}; the daily cron will bring it live.`,
      );
      return doc;
    }
  }

  await queueRebuild(req.payload, describe(collection?.slug, doc));
  return doc;
};

/** For collections with no draft state (authors, publishers, categories,
 *  series), where every saved change is immediately part of what the site
 *  renders. A publish-boundary check here would silently never fire, because
 *  `_status` does not exist on these documents — the same Payload trap that
 *  makes a shared hook tempting and wrong. */
export const rebuildAlways: CollectionAfterChangeHook = async ({
  collection,
  doc,
  previousDoc,
  req,
}) => {
  if (req?.context?.skipRevalidate) return doc;
  await recordSlugChange({ collectionSlug: collection?.slug, doc, previousDoc, req });
  await queueRebuild(req.payload, describe(collection?.slug, doc));
  return doc;
};

/** Deletion can only remove something from the site — except a draft that was
 *  never published, which had no page to begin with. Undebounced: see
 *  forceRebuild. */
export const rebuildOnDelete: CollectionAfterDeleteHook = async ({
  collection,
  doc,
  req,
}) => {
  if (req?.context?.skipRevalidate) return doc;

  // `_status` is absent on collections without drafts, which must always
  // rebuild; on draft-enabled ones an unpublished document was never live.
  if (doc && "_status" in doc && doc._status !== "published") return doc;

  await forceRebuild(req.payload, `deleted ${describe(collection?.slug, doc)}`);
  return doc;
};

/** Globals (SiteSettings, AffiliateSettings). Every field on both is rendered
 *  on every page — the footer, the disclosure line, the homepage rails — so a
 *  change is site-wide by definition and there is no narrower trigger to make.
 *  Replaces the two hand-written `invalidate(["settings"])` calls that pointed
 *  at a tag nothing was ever cached under. */
export const rebuildOnGlobalChange: GlobalAfterChangeHook = async ({
  doc,
  global,
  req,
}) => {
  if (req?.context?.skipRevalidate) return doc;
  await queueRebuild(req.payload, `global/${global?.slug ?? "settings"}`);
  return doc;
};


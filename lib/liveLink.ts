import { publicPathFor } from "./types";

/** WHICH OF FIVE THINGS the admin's "Live" column should show for one row, as a
 *  pure function of that row. The rendering lives in
 *  components/payload/list/LiveLinkCell.tsx; the decision lives here because it
 *  is the part with rules in it, and rules that cannot be tested get quietly
 *  broken by the next person who adds a collection.
 *
 *  WHY THE COLUMN CANNOT JUST ALWAYS LINK. This site is a BUILD ARTEFACT: every
 *  public route pairs generateStaticParams() with `dynamicParams = false`, so a
 *  URL that was not in the last build does not degrade into a draft view — it
 *  404s. Three states therefore have no page to open, and each is labelled
 *  instead of linked, because one link that lands on the 404 page is enough to
 *  teach an editor to distrust the whole column:
 *
 *    - a DRAFT. Books and Pages can offer /preview instead; nothing else can.
 *    - a SCHEDULED document: `_status: published` with a publishDate in the
 *      future, which lib/data.ts holds out of the build (its `publishedNow`
 *      filter is `_status = published AND publishDate <= now`).
 *    - no slug, or a slug that could never be a URL segment, or a collection
 *      with no public page at all (chapters: their URL needs the parent book's
 *      slug, which publicPathFor deliberately cannot supply).
 *
 *  `now` is a parameter, not a Date.now() call in the body, so the scheduled
 *  boundary is testable without waiting for a date to pass. */

/** Collections app/(preview)/preview/page.tsx can render. Kept in step with the
 *  PREVIEWABLE allowlist there; anything else has no draft view to offer. */
const PREVIEWABLE = new Set(["books", "pages"]);

export type LiveLinkState =
  /** A page exists at `href`. */
  | { kind: "live"; href: string; title: string }
  /** No page yet, but the last saved version can be previewed at `href`. */
  | { kind: "preview"; href: string; title: string }
  /** Draft, and this collection has no preview route. */
  | { kind: "draft"; title: string }
  /** Published, but dated forward, so the build leaves it out. */
  | { kind: "scheduled"; title: string }
  /** Nothing to offer: no slug, or no public page for this collection. */
  | { kind: "none"; title: string };

/** The shape of `rowData` this reads. Everything is optional and typed `unknown`
 *  on purpose: Payload fetches whole documents for the list view unless
 *  `admin.enableListViewSelectAPI` is set (nothing in this repo sets it), and if
 *  that ever changes these reads go undefined and every cell degrades to the
 *  "none" dash rather than throwing, which is the failure mode to want. */
export interface LiveLinkRow {
  id?: number | string;
  slug?: unknown;
  _status?: unknown;
  publishDate?: unknown;
}

function isFutureDated(value: unknown, now: number): boolean {
  if (typeof value !== "string" || !value) return false;
  const at = Date.parse(value);
  return Number.isFinite(at) && at > now;
}

export function liveLinkState(
  row: LiveLinkRow | null | undefined,
  collectionSlug: string | undefined,
  now: number = Date.now(),
): LiveLinkState {
  const r = row ?? {};
  const slug = typeof r.slug === "string" ? r.slug : undefined;
  const path = publicPathFor(collectionSlug, slug);

  if (!path) {
    return {
      kind: "none",
      title: slug
        ? "This collection has no page on the site."
        : "No slug yet, so there is no address to open.",
    };
  }

  // `_status` is absent on the collections without drafts (authors, publishers,
  // categories, series), where a saved document is a live document.
  if (r._status === "draft") {
    if (PREVIEWABLE.has(collectionSlug ?? "") && r.id !== undefined) {
      return {
        kind: "preview",
        href: `/preview?collection=${encodeURIComponent(
          collectionSlug as string,
        )}&id=${encodeURIComponent(String(r.id))}`,
        title: `Draft, so ${path} does not exist yet. Opens the preview of the last saved version.`,
      };
    }
    return {
      kind: "draft",
      title: `Draft. ${path} will exist after this is published and the site rebuilds.`,
    };
  }

  if (isFutureDated(r.publishDate, now)) {
    return {
      kind: "scheduled",
      title: `Published, but dated in the future, so the site leaves it out until that date passes. ${path} does not exist yet.`,
    };
  }

  return {
    kind: "live",
    href: path,
    // Says "as of the last deployment" rather than implying the save was
    // instant: under the deploy-hook model it is a couple of minutes.
    title: `Open ${path} in a new tab. Shows the page as of the last deployment, so a change saved moments ago may not be there yet.`,
  };
}

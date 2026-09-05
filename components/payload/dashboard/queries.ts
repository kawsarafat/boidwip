import type {
  CollectionSlug,
  Payload,
  PayloadRequest,
  SanitizedPermissions,
  Where,
} from "payload";
import { RIGHTS_TIERS, tierAllowsDelivery } from "../../../lib/types";

/** Every number the dashboard shows, and the deep link that proves it.
 *
 *  THE RULE THIS FILE EXISTS TO ENFORCE: a count on a dashboard is only useful
 *  if clicking it lands on exactly the rows it counted. So each metric carries
 *  both a `where` (for `payload.count`) and an `href` built from the SAME
 *  conditions, rather than a number here and a hand-written link over there that
 *  drifts apart on the first edit.
 *
 *  WHY `req` IS PASSED TO EVERY COUNT. `payload.count()` opens its own
 *  connection when called bare, outside the request's transaction and without
 *  the request's user. Passing `req` keeps all of it on one footing: the same
 *  connection, and `overrideAccess: false` then evaluates each collection's own
 *  read rule against the logged-in editor. A dashboard that counts documents the
 *  viewer is not allowed to see would be a small information leak dressed up as
 *  a statistic.
 *
 *  WHY A FAILED COUNT RETURNS null RATHER THAN 0. Zero is a claim about the
 *  data — "no reviews are waiting" — and a database hiccup must never make that
 *  claim. `null` renders as an em dash, which reads as "not known".
 *
 *  THAT null PATH IS ALSO THE FIELD-ACCESS PATH, and the takedown row is the one
 *  that can take it. `canRead` below tests COLLECTION read permission, which is
 *  not the only gate: `takedownStatus` carries
 *  `access: { read: authenticatedFieldRead }` (lib/payload/access.ts), and
 *  Payload's `validateQueryPaths` answers a query on a field the requester cannot
 *  read with a 400 QueryError — not with zero rows. So the count throws, is
 *  caught, and the card shows an em dash. Today `authenticatedFieldRead` is
 *  `Boolean(req.user)` and every editor who can load /admin passes it; tighten
 *  that rule and this row starts reading "not known" for the editors it excludes,
 *  which is correct and is not a bug to chase. The useful consequence: a
 *  mistyped or unreadable field name in this file can never surface as a
 *  reassuring 0. It surfaces as an em dash. */

export type MetricTone = "neutral" | "brand" | "positive" | "warning" | "danger";

export type Metric = {
  /** Stable key, used as the React key and nothing else. */
  key: string;
  label: string;
  /** One line saying what the number means and what to do about it. */
  hint: string;
  /** null when the count could not be read, or the viewer may not read it. */
  count: number | null;
  href: string;
  tone: MetricTone;
};

export type DashboardData = {
  stats: Metric[];
  attention: Metric[];
  /** True when every attention check came back zero — not the same as "all the
   *  checks failed", which is why it is computed here rather than inferred from
   *  an empty list in the component. */
  allClear: boolean;
};

/* ─────────────────────────── URL building ─────────────────────────── */

type Condition = { field: string; operator: string; value: string };

/** A list-view URL carrying a filter Payload's own Filters panel can read back.
 *
 *  The `where[or][0][and][N]` nesting is not decoration: that is the shape
 *  Payload's where-builder serialises to, so a link built this way arrives with
 *  the conditions already displayed as editable rows. A flatter
 *  `?where[status][equals]=pending` filters correctly but shows the editor an
 *  empty Filters panel, which makes a filtered list look like the whole list. */
function listUrl(adminRoute: string, slug: string, conditions: Condition[] = []): string {
  const base = `${adminRoute}/collections/${slug}`;
  if (conditions.length === 0) return base;
  const query = conditions
    .map(
      (c, i) =>
        `where[or][0][and][${i}][${c.field}][${c.operator}]=${encodeURIComponent(c.value)}`,
    )
    .join("&");
  return `${base}?${query}`;
}

/* ─────────────────────────── Counting ─────────────────────────── */

/** Payload pre-computes read permission per collection, so this is a lookup
 *  rather than an access-control evaluation. Same test `getNavGroups` applies to
 *  the sidebar, so the dashboard can never advertise a collection the nav hides. */
function canRead(permissions: SanitizedPermissions | undefined, slug: string): boolean {
  return Boolean(permissions?.collections?.[slug]?.read);
}

async function countDocs(
  payload: Payload,
  req: PayloadRequest,
  permissions: SanitizedPermissions | undefined,
  collection: CollectionSlug,
  where?: Where,
): Promise<number | null> {
  if (!canRead(permissions, collection)) return null;
  try {
    const result = await payload.count({
      collection,
      overrideAccess: false,
      req,
      where,
    });
    return typeof result?.totalDocs === "number" ? result.totalDocs : null;
  } catch (error) {
    // Logged, not thrown: one unavailable number must not replace the whole
    // dashboard with an error screen. The card shows an em dash instead.
    payload.logger.error({
      err: error,
      msg: `[dashboard] count failed for "${collection}"`,
    });
    return null;
  }
}

/* ─────────────────────────── The checks ─────────────────────────── */

/** The rights tiers whose books are expected to carry a downloadable file. Read
 *  from the tier helpers rather than listed by hand, so adding a tier later
 *  cannot leave this check quietly testing the wrong three. */
const DELIVERY_TIERS = RIGHTS_TIERS.filter(tierAllowsDelivery);

export async function loadDashboardData(args: {
  adminRoute: string;
  payload: Payload;
  permissions?: SanitizedPermissions;
  req: PayloadRequest;
}): Promise<DashboardData> {
  const { adminRoute, payload, permissions, req } = args;
  const count = (collection: CollectionSlug, where?: Where) =>
    countDocs(payload, req, permissions, collection, where);

  // The moment the page renders, used for the scheduled-publish check so the
  // count and the link agree on "now" to the second.
  const now = new Date().toISOString();

  const [
    publishedBooks,
    draftBooks,
    chapters,
    authors,
    pendingReviews,
    takedownNotices,
    noCover,
    noFile,
    noSynopsis,
    scheduled,
    thinAuthors,
  ] = await Promise.all([
    count("books", { _status: { equals: "published" } }),
    count("books", { _status: { equals: "draft" } }),
    count("book-chapters", { _status: { equals: "published" } }),
    count("authors"),
    count("reviews", { status: { equals: "pending" } }),
    count("books", { takedownStatus: { equals: "notice-received" } }),
    count("books", {
      and: [{ _status: { equals: "published" } }, { cover: { exists: false } }],
    }),
    count("books", {
      and: [
        { _status: { equals: "published" } },
        { rightsTier: { in: DELIVERY_TIERS } },
        { pdf: { exists: false } },
        { pdfExternalUrl: { exists: false } },
      ],
    }),
    count("books", {
      and: [{ _status: { equals: "published" } }, { synopsis: { exists: false } }],
    }),
    count("books", {
      and: [{ _status: { equals: "published" } }, { publishDate: { greater_than: now } }],
    }),
    count("authors", { bio: { exists: false } }),
  ]);

  const stats: Metric[] = [
    {
      key: "published-books",
      label: "Published books",
      hint: "Live on the site right now.",
      count: publishedBooks,
      href: listUrl(adminRoute, "books", [
        { field: "_status", operator: "equals", value: "published" },
      ]),
      tone: "brand",
    },
    {
      key: "draft-books",
      label: "Books in draft",
      hint: "Saved but not visible to readers.",
      count: draftBooks,
      href: listUrl(adminRoute, "books", [
        { field: "_status", operator: "equals", value: "draft" },
      ]),
      tone: "neutral",
    },
    {
      key: "chapters",
      label: "Reader chapters",
      hint: "Published full-text pages — the largest search asset here.",
      count: chapters,
      href: listUrl(adminRoute, "book-chapters", [
        { field: "_status", operator: "equals", value: "published" },
      ]),
      tone: "neutral",
    },
    {
      key: "authors",
      label: "Authors",
      hint: "Every writer with a hub page of their own.",
      count: authors,
      href: listUrl(adminRoute, "authors"),
      tone: "neutral",
    },
  ];

  const attention: Metric[] = [
    {
      key: "takedown-notices",
      label: "Takedown notices received",
      hint: "Answer these first. Acknowledge fast, remove fast, log everything.",
      count: takedownNotices,
      href: listUrl(adminRoute, "books", [
        { field: "takedownStatus", operator: "equals", value: "notice-received" },
      ]),
      tone: "danger",
    },
    {
      key: "pending-reviews",
      label: "Reviews waiting for moderation",
      hint: "Not on the site and not counted in any rating until you decide.",
      count: pendingReviews,
      href: listUrl(adminRoute, "reviews", [
        { field: "status", operator: "equals", value: "pending" },
      ]),
      tone: "warning",
    },
    {
      key: "no-file",
      label: "Downloadable books with no file",
      hint: "The rights tier promises a PDF the page cannot deliver. Upload one or change the tier.",
      count: noFile,
      href: listUrl(adminRoute, "books", [
        { field: "_status", operator: "equals", value: "published" },
        { field: "rightsTier", operator: "in", value: DELIVERY_TIERS.join(",") },
        { field: "pdf", operator: "exists", value: "false" },
        { field: "pdfExternalUrl", operator: "exists", value: "false" },
      ]),
      tone: "warning",
    },
    {
      key: "no-cover",
      label: "Published books with no cover",
      hint: "A cover is the whole card in a grid and the social image in a share.",
      count: noCover,
      href: listUrl(adminRoute, "books", [
        { field: "_status", operator: "equals", value: "published" },
        { field: "cover", operator: "exists", value: "false" },
      ]),
      tone: "warning",
    },
    {
      key: "no-synopsis",
      label: "Published books with no synopsis",
      hint: "Nothing for a reader to read and nothing for a search engine to rank.",
      count: noSynopsis,
      href: listUrl(adminRoute, "books", [
        { field: "_status", operator: "equals", value: "published" },
        { field: "synopsis", operator: "exists", value: "false" },
      ]),
      tone: "warning",
    },
    {
      key: "thin-authors",
      label: "Authors with no biography",
      hint: "An author page with no text is a list of covers. These rank for nothing.",
      count: thinAuthors,
      href: listUrl(adminRoute, "authors", [
        { field: "bio", operator: "exists", value: "false" },
      ]),
      tone: "neutral",
    },
    {
      key: "scheduled",
      label: "Published, waiting for their date",
      hint: "Nothing to fix — these appear on the site once the publish date passes.",
      count: scheduled,
      href: listUrl(adminRoute, "books", [
        { field: "_status", operator: "equals", value: "published" },
        { field: "publishDate", operator: "greater_than", value: now },
      ]),
      tone: "neutral",
    },
  ];

  return {
    stats,
    attention,
    allClear: attention.every((item) => item.count === 0),
  };
}

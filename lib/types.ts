// Split out from lib/data.ts specifically so client components (like the
// search UI, via BookCard) can import types and label maps without pulling
// in Payload's Local API, which cannot be bundled for the browser at all.

/* ─────────────────────────── Rights tiers ─────────────────────────── */

/** The four-tier rights model — the single most important vocabulary in the
 *  codebase, because it decides what a book PAGE IS ALLOWED TO OFFER:
 *
 *    public-domain  (Tier A) author dead 60+ years in BD → PDF download AND
 *                            online reading, both first-class.
 *    open-licence   (Tier B) CC/openly licensed → PDF download with licence
 *                            attribution rendered.
 *    permitted      (Tier C) written permission from the rights holder is on
 *                            file → PDF download with "প্রকাশকের অনুমতিতে" line.
 *    in-copyright   (Tier D) everything else → NO pdf, NO full text, ever.
 *                            The page is discovery: review, summary, buy link.
 *
 *  The Books collection enforces the Tier D rule in a beforeValidate hook —
 *  a book with rightsTier "in-copyright" REFUSES to publish while it carries
 *  a pdf or chapters. This list is the source the select field's options are
 *  built from, so tier vocabulary lives in exactly one place. */
export const RIGHTS_TIERS = [
  "public-domain",
  "open-licence",
  "permitted",
  "in-copyright",
] as const;

export type RightsTier = (typeof RIGHTS_TIERS)[number];

/** Narrows a string that arrived over HTTP (or from an untyped Payload doc)
 *  to a real rights tier. A cast would assert rather than check, and an
 *  unknown tier must fail CLOSED — callers treat non-tiers as in-copyright. */
export function isRightsTier(value: unknown): value is RightsTier {
  return (
    typeof value === "string" && (RIGHTS_TIERS as readonly string[]).includes(value)
  );
}

const RIGHTS_TIER_LABELS: Record<RightsTier, string> = {
  "public-domain": "পাবলিক ডোমেইন",
  "open-licence": "উন্মুক্ত লাইসেন্স",
  permitted: "অনুমতিপ্রাপ্ত",
  "in-copyright": "কপিরাইটকৃত",
};

export function getRightsTierLabel(tier: RightsTier): string {
  return RIGHTS_TIER_LABELS[tier];
}

/** The one question most of the frontend actually asks of a tier. Fails
 *  closed: anything unrecognized offers nothing. */
export function tierAllowsDelivery(tier: string): boolean {
  return tier === "public-domain" || tier === "open-licence" || tier === "permitted";
}

/** May this book carry full chapter TEXT for the online reader?
 *
 *  A STRICTER question than tierAllowsDelivery, and the distinction is legal,
 *  not cosmetic. Tier C ("permitted") means the rights holder gave written
 *  permission to distribute a PDF — the artefact named in the permission
 *  email. Republishing the same work as indexable HTML chapters on our own
 *  domain is a separate act of publication that a PDF-distribution permission
 *  does not grant, and it is the one that competes with the publisher's own
 *  edition in search results. So `permitted` gets the download and NOT the
 *  reader.
 *
 *  WHY IT IS A NAMED FUNCTION rather than an inline comparison: this exact
 *  rule was previously written out by hand in two places that disagreed with
 *  each other — collections/BookChapters.ts refused to attach a chapter to
 *  anything but Tier A/B, while lib/data.ts attached chapters to any book that
 *  was merely not in-copyright. A `permitted` book with chapters (created
 *  before a reclassification, or by an import that bypassed validation) was
 *  therefore rejected by the CMS and rendered by the site. One function, every
 *  caller: collections/BookChapters.ts, collections/Books.ts, lib/data.ts,
 *  the reader route's generateStaticParams, the book page and the sitemap.
 *
 *  Fails closed with the rest of the tier helpers: an unrecognized tier reads
 *  as in-copyright and offers nothing. */
export function tierAllowsOnlineReading(tier: string): boolean {
  return tier === "public-domain" || tier === "open-licence";
}

/** Words per minute for the reading-time estimates. Deliberately slower than
 *  the ~250 quoted for English: Bengali is written in longer orthographic words
 *  and read on this site as long-form prose, not scanned. */
const READING_WORDS_PER_MINUTE = 180;

/** Reading time in whole minutes, floored at one so a short chapter never
 *  advertises "০ মিনিট".
 *
 *  A NAMED FUNCTION because three places quote a reading time from the same word
 *  count — the chapter view model in lib/render.ts, the per-chapter rows on the
 *  reader index, and that page's whole-book total — and the reader index first
 *  shipped with `Math.round` against render.ts's `Math.ceil`. Two estimates of
 *  the same chapter differing by a minute is the kind of thing nobody reports
 *  and everybody notices. */
export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / READING_WORDS_PER_MINUTE));
}

/** How many of these books offer a PDF this site may actually serve.
 *
 *  ONE FUNCTION because every hub on the site branches its <title> and its <h1>
 *  on this number — lib/seo.ts listingTitle, authorTitle, authorHeading,
 *  publisherTitle all refuse to say "ফ্রি PDF" over a grid that has none — and
 *  the filter was being rewritten per page, once per hub, with the tier arm
 *  present in some copies and absent in others. When a page's title reads its
 *  count from one expression and its heading from another, the two eventually
 *  disagree, and the disagreement is invisible until a reader sees a download
 *  promise over a buy-only grid.
 *
 *  The tier arm is belt and braces: lib/render.ts already nulls pdfUrl for any
 *  book whose tier forbids delivery, so `Boolean(b.pdfUrl)` alone would give the
 *  same answer today. It is stated anyway because this expression is what decides
 *  what a title CLAIMS, and a claim should not rest on a distant invariant in the
 *  render layer staying true. */
export function countFreePdfs(
  books: ReadonlyArray<Pick<BookContent, "rightsTier" | "pdfUrl">>,
): number {
  return books.filter((b) => tierAllowsDelivery(b.rightsTier) && Boolean(b.pdfUrl)).length;
}

/* ─────────────────────────── Reserved slugs ─────────────────────────── */

/** URL segments the app itself owns, which therefore cannot belong to a
 *  Pages document (Pages sit at the site root, `/about`) — and the FIRST
 *  segment of every content namespace, so no future root-level collection
 *  can collide with a real route. A static segment always beats `[slug]` in
 *  Next's matcher: the document would save cleanly, appear in the sitemap,
 *  and render the route's own page forever. That silent dead page is what
 *  this list prevents.
 *
 *  Unlike the reference project, books/authors/etc. do NOT live at the root
 *  (they are namespaced under /book, /author, ...), so only Pages resolves at
 *  `[slug]` — but their namespace prefixes must all be reserved.
 *
 *  Entries with a dot cannot pass the `^[a-z0-9-]+$` slug pattern and are
 *  listed anyway, so this reads as the full inventory of taken segments
 *  rather than as "the ones the regex happens to miss". */
export const RESERVED_ROUTE_SLUGS = [
  // app namespaces
  "book",
  "author",
  "publisher",
  "category",
  "series",
  "list",
  "search",
  "new",
  "popular",
  "blog",
  // infrastructure
  "admin",
  "api",
  "preview",
  // well-known files
  "rss.xml",
  "sitemap.xml",
  "robots.txt",
  "llms.txt",
  "og.png",
  "icon.svg",
  "favicon.ico",
  "manifest.webmanifest",
] as const;

export function isReservedRouteSlug(value: string): boolean {
  return (RESERVED_ROUTE_SLUGS as readonly string[]).includes(value);
}

/* ─────────────────────────── Shared fragments ─────────────────────────── */

/** One entry in a long page's on-page table of contents.
 *
 *  Built at BUILD time from the already-sanitized HTML (see withHeadingIds in
 *  lib/render.ts), not in the browser. A client-side TOC would have to wait
 *  for hydration, measure the DOM and then insert links, which is layout
 *  shift on the slowest phones for something knowable before the page ships. */
export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Used whenever a book has no cover image set, applied once at the data
 *  layer so every place a book is displayed automatically shows something
 *  instead of needing its own fallback logic. SVG for on-page use (crisp,
 *  tiny); social platforms don't reliably render SVG previews, so
 *  `hasCustomCover` exists specifically to let the Open Graph image fall
 *  back to the generated PNG route instead of this file. */
export const DEFAULT_COVER_IMAGE = "/default-cover.svg";

/* ─────────────────────────── Book view models ─────────────────────────── */

/** A tiny projection of a related entity — enough to render a link and a
 *  name, nothing more. Cards and bylines need exactly this; anything bigger
 *  rides into RSC payloads for free. */
export interface EntityRef {
  slug: string;
  name: string;
}

/** A chapter as the reader's chapter list shows it — NOT the body. The body
 *  is fetched only by the /book/[slug]/read/[chapter] route itself. */
export interface BookChapterSummary {
  slug: string;
  title: string;
  order: number;
  wordCount: number;
}

/** The full chapter the online reader renders — summary plus the sanitized
 *  body. Only /book/[slug]/read/[chapter] ever holds one of these. */
export interface BookChapterContent extends BookChapterSummary {
  bodyHtml: string;
  readingTimeMinutes: number;
  updatedAt: string;
}

/** The full book view model the book page renders. Everything is already
 *  resolved by the data layer: relationships flattened to EntityRefs, media
 *  to URL strings, rich text to sanitized HTML. */
export interface BookContent {
  slug: string;
  title: string;
  /** Latin transliteration for Banglish search ("Shesher Kobita"). */
  titleLatin: string | null;
  subtitle: string | null;
  rightsTier: RightsTier;
  /** Tier B: the licence name to attribute ("CC BY-SA 4.0"). */
  licenceName: string | null;
  /** Tier B: URL of the licence text. */
  licenceUrl: string | null;
  /** Where the text was transcribed from, as the reader sees it ("বাংলা
   *  উইকিসংকলন"). Public, unlike the `rightsBasis` audit note it was split out
   *  of: citing the source is what keeps a republished public-domain text clear
   *  of Google's Scraping policy. */
  textSourceName: string | null;
  /** Deep link to that source. Already checked by isSafeHttpUrl. */
  textSourceUrl: string | null;
  /** WHY the book is out of copyright, in one Bengali sentence, derived at
   *  build time from the authors' death years by lib/rights.ts. Null unless
   *  the tier is `public-domain` AND the arithmetic agrees with the editor:
   *  a page that contradicts itself about copyright is worse than a page that
   *  says nothing. */
  publicDomainNote: string | null;
  /** Tier C: the permission attribution line ("প্রকাশকের অনুমতিতে"). */
  permissionNote: string | null;
  authors: EntityRef[];
  publisher: EntityRef | null;
  categories: EntityRef[];
  /** The category driving the breadcrumb trail; first category when unset. */
  primaryCategory: EntityRef | null;
  series: (EntityRef & { position: number | null }) | null;
  coverImage: string;
  hasCustomCover: boolean;
  /** Sanitized HTML — the editor's synopsis (সারসংক্ষেপ). Always present. */
  synopsisHtml: string;
  /** Sanitized HTML — the editorial review. Empty string when none written;
   *  for Tier D books this is the page's main content. */
  reviewHtml: string;
  /** 2–3 sentences: who this book is for. */
  whoShouldRead: string | null;
  /** Memorable quotes — each one a long-tail search entry point. */
  quotes: string[];
  /** Short plain-text summary for cards, meta descriptions, JSON-LD. */
  summary: string;
  /** Extracted from reviewHtml (falling back to synopsisHtml) at build time.
   *  Empty when the body has fewer than two headings, which is the signal to
   *  render no TOC at all. */
  toc: TocEntry[];
  /** The printed book's own chapter list (title + optional printed page). */
  printedToc: Array<{ title: string; page: number | null }>;
  faqItems: FaqItem[];
  /** Direct R2 URL (or safe pasted URL). null for Tier D, always. */
  pdfUrl: string | null;
  pdfSizeMB: number | null;
  /** Chapters for the online reader (Tier A). Empty when none. */
  chapters: BookChapterSummary[];
  /** Plain Rokomari product URL as stored — lib/affiliate.ts decorates it. */
  rokomariUrl: string | null;
  /** Last known Rokomari list price in Taka, with the date it was checked —
   *  price chips render nothing when older than 60 days. */
  priceTaka: number | null;
  priceCheckedAt: string | null;
  pageCount: number | null;
  firstPublishedYear: number | null;
  isbn: string | null;
  language: string;
  /** Denormalized from approved reviews by an afterChange hook. */
  ratingAverage: number | null;
  ratingCount: number;
  downloadCount: number;
  featured: boolean;
  popular: boolean;
  publishDate: string;
  updatedAt: string;
}

/** A book reduced to the fields a LISTING actually paints: what a card shows
 *  plus what search matches against.
 *
 *  WHY THIS EXISTS — a page-weight fix, not tidiness. Anything handed as a
 *  prop to a `"use client"` component is serialized into the RSC flight
 *  payload and shipped inside the HTML. Listing routes pass many books into
 *  client components; with the full BookContent each would carry its entire
 *  descriptionHtml, toc, faqItems and chapter list into the browser, where
 *  the card reads none of them. The projection drops kilobytes per book on
 *  exactly the routes that render the most books.
 *
 *  A `Pick` rather than a hand-written interface on purpose: a field renamed
 *  in BookContent is then a compile error here instead of a summary that
 *  quietly keeps the old shape. And because BookContent has every one of
 *  these fields, it is assignable to BookSummary — server call sites holding
 *  a full book need no mapping. */
export type BookSummary = Pick<
  BookContent,
  | "slug"
  | "title"
  | "titleLatin"
  | "rightsTier"
  | "authors"
  | "coverImage"
  | "summary"
  | "pdfUrl"
  | "rokomariUrl"
  | "priceTaka"
  | "priceCheckedAt"
  | "ratingAverage"
  | "ratingCount"
  | "featured"
  | "publishDate"
>;

/** Narrows a full book to the listing fields. Explicit field-by-field rather
 *  than a spread-and-delete so nothing new added to BookContent can ride
 *  along into a client bundle by default. */
export function toBookSummary(book: BookContent): BookSummary {
  return {
    slug: book.slug,
    title: book.title,
    titleLatin: book.titleLatin,
    rightsTier: book.rightsTier,
    authors: book.authors,
    coverImage: book.coverImage,
    summary: book.summary,
    pdfUrl: book.pdfUrl,
    rokomariUrl: book.rokomariUrl,
    priceTaka: book.priceTaka,
    priceCheckedAt: book.priceCheckedAt,
    ratingAverage: book.ratingAverage,
    ratingCount: book.ratingCount,
    featured: book.featured,
    publishDate: book.publishDate,
  };
}

/* ─────────────────── Author / publisher / taxonomy models ─────────────────── */

export interface AuthorContent {
  slug: string;
  name: string;
  /** Latin transliteration + aliases for Banglish search. */
  nameLatin: string | null;
  nameAliases: string[];
  photo: string | null;
  /** Sanitized HTML biography. */
  bioHtml: string;
  /** Word count of the bio — drives the thin-page noindex decision. */
  bioWordCount: number;
  birthYear: number | null;
  deathYear: number | null;
  /** How many of this author's published books offer a free PDF — drives the
   *  tier-dependent SEO title and the noindex decision for thin pages. */
  freePdfCount: number;
  bookCount: number;
  updatedAt: string;
}

export interface PublisherContent {
  slug: string;
  name: string;
  nameLatin: string | null;
  logo: string | null;
  descriptionHtml: string;
  website: string | null;
  freePdfCount: number;
  bookCount: number;
  updatedAt: string;
}

export interface CategoryContent {
  slug: string;
  name: string;
  nameLatin: string | null;
  descriptionHtml: string;
  /** Parent category for the breadcrumb trail, when this is a subcategory. */
  parent: EntityRef | null;
  bookCount: number;
  updatedAt: string;
}

export interface SeriesContent {
  slug: string;
  name: string;
  nameLatin: string | null;
  descriptionHtml: string;
  bookCount: number;
  updatedAt: string;
}

/** A curated list (তালিকা) — "১০টি সেরা মুক্তিযুদ্ধের বই" style editorial
 *  collections, each entry a book plus an editor's note on WHY it's here. */
export interface ListContent {
  slug: string;
  title: string;
  descriptionHtml: string;
  entries: Array<{
    book: BookSummary;
    noteHtml: string;
  }>;
  publishDate: string;
  updatedAt: string;
}

/* ─────────────────────────── Reviews ─────────────────────────── */

/** An approved reader review as the book page's review list renders it.
 *  Email and IP hash never leave the server — this shape is the proof. */
export interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

/* ─────────────────────────── Static pages / blog ─────────────────────────── */

export interface StaticPage {
  slug: string;
  title: string;
  bodyHtml: string;
  updatedAt: string;
}

export interface BlogPostContent {
  slug: string;
  title: string;
  summary: string;
  coverImage: string | null;
  bodyHtml: string;
  toc: TocEntry[];
  /** Words in the body. Feeds the post's own reading-time line and the
   *  `wordCount` property of its BlogPosting JSON-LD, which is how a crawler
   *  tells a 2,000-word essay from a stub without parsing the body. */
  wordCount: number;
  /** Minutes at 180 wpm, via readingMinutes — the same figure a chapter shows,
   *  from the same function, so a reader is never told that 900 words takes five
   *  minutes here and three minutes one route over. */
  readingTimeMinutes: number;
  /** Books referenced by the post, for the "এই লেখায় যে বইগুলো" rail. */
  books: BookSummary[];
  publishDate: string;
  updatedAt: string;
}

export type BlogPostSummary = Pick<
  BlogPostContent,
  "slug" | "title" | "summary" | "coverImage" | "publishDate"
>;

/* ─────────────────────────── Globals ─────────────────────────── */

/** SiteSettings flattened for the frontend — footer, social links, homepage
 *  curation. Every field has a working default so a fresh install renders
 *  before anyone opens the admin. */
export interface SiteSettingsContent {
  siteName: string;
  tagline: string;
  siteDescription: string;
  socialLinks: Array<{ label: string; url: string }>;
  contactEmail: string | null;
  footerNote: string;
  featuredCategorySlugs: string[];
  featuredListSlugs: string[];
  heroBookSlug: string | null;
}

/** AffiliateSettings flattened — button labels and the disclosure line, so
 *  wording is editable without a deploy. lib/affiliate.ts holds the URL
 *  logic; this holds the words. */
export interface AffiliateSettingsContent {
  affiliateEnabled: boolean;
  buyButtonLabel: string;
  downloadButtonLabel: string;
  disclosureText: string;
  postDownloadHeading: string;
  postDownloadBody: string;
}

/* ─────────────────────────── Safety helpers ─────────────────────────── */

/** Only http(s) links are ever rendered as a real href. This exists
 *  specifically because the CMS accepts manually pasted URLs (a book's
 *  Rokomari URL, an external PDF URL). React does not sanitize href values,
 *  so without this check a pasted `javascript:...` URL would execute when
 *  clicked. Files uploaded to R2 are always real https URLs anyway; this
 *  only matters for the manual-paste path. */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** JSON.stringify does not escape "</script>" sequences, and a title or
 *  body containing that exact string would prematurely close the
 *  surrounding <script type="application/ld+json"> tag when injected
 *  via dangerouslySetInnerHTML, breaking out of the JSON context into
 *  actual page HTML. Escaping "<" to its unicode form is inert inside
 *  JSON (still parses identically) but can never be interpreted as the
 *  start of a closing tag by the HTML parser. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

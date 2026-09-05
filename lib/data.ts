import { getPayload, type Where } from "payload";
import config from "@payload-config";
import type {
  Author as PayloadAuthor,
  BlogPost as PayloadBlogPost,
  Book as PayloadBook,
  BookChapter as PayloadBookChapter,
  Category as PayloadCategory,
  List as PayloadList,
  Page as PayloadPage,
  Publisher as PayloadPublisher,
  Series as PayloadSeries,
} from "@/payload-types";
import type {
  AffiliateSettingsContent,
  AuthorContent,
  BlogPostContent,
  BookChapterContent,
  BookContent,
  BookSummary,
  CategoryContent,
  ListContent,
  PublisherContent,
  ReferencedBook,
  ReviewItem,
  SeriesContent,
  SiteSettingsContent,
  StaticPage,
} from "@/lib/types";
import { relationshipId, tierAllowsOnlineReading, toBookSummary } from "@/lib/types";
import {
  makeRichTextRenderer,
  toAuthorContent,
  toBlogPostContent,
  toBookChapterContent,
  toBookChapterSummary,
  toBookContent,
  toCategoryContent,
  toListContent,
  toPendingBookSummary,
  toPublisherContent,
  toSeriesContent,
  toStaticPage,
} from "@/lib/render";

export type {
  AuthorContent,
  BlogPostContent,
  BlogPostSummary,
  BookChapterContent,
  BookContent,
  BookSummary,
  CategoryContent,
  ListContent,
  PublisherContent,
  ReviewItem,
  SeriesContent,
  StaticPage,
} from "@/lib/types";
export {
  DEFAULT_COVER_IMAGE,
  getRightsTierLabel,
  isSafeHttpUrl,
  safeJsonLd,
  tierAllowsDelivery,
  tierAllowsOnlineReading,
  toBookSummary,
} from "@/lib/types";

// The site's data layer. It reads Payload through the LOCAL API — an
// in-process call straight to the database, not HTTP — and it runs at BUILD
// time, once per page. Nothing here executes when a visitor loads the site;
// they get static HTML. That is why publishing goes through a deploy hook
// (lib/payload/revalidate.ts) rather than per-request queries.
//
// Page templates never need to change when the CMS changes: only this file
// (and lib/render.ts, which it shares with the preview route) knows the shape
// of a Payload document. Everything handed back is the plain, already-rendered
// view-model shape declared in lib/types.ts.

type Store = {
  books: BookContent[];
  /** id → book, for resolving relationship ids inside lists and blog posts. */
  booksById: Map<number, BookContent>;
  authors: AuthorContent[];
  publishers: PublisherContent[];
  categories: CategoryContent[];
  series: SeriesContent[];
  lists: ListContent[];
  blogPosts: BlogPostContent[];
  pages: StaticPage[];
  siteSettings: SiteSettingsContent;
  affiliateSettings: AffiliateSettingsContent;
};

/** One fetch per process, shared by every page in the build.
 *
 *  Next renders pages across several worker processes, so this is a
 *  per-worker cache rather than a global one — a handful of queries instead
 *  of one, and still not the hundreds that fetching per page would cost.
 *  Stored as the PROMISE, not the resolved value, so concurrent callers
 *  during the same tick await the same query instead of racing to start
 *  their own. */
let storePromise: Promise<Store> | null = null;

/** A build renders every page once and then exits, so a cache that never
 *  expires is exactly right there. `next dev` is the opposite: the process
 *  lives for hours while an editor publishes things, and each route compiles
 *  its own copy of this module, so the cache would freeze a different
 *  snapshot per route with nothing to invalidate it. Rebuilding per render in
 *  development costs a few queries and is worth it to make the dev server
 *  tell the truth about the database. */
const CACHE_STORE = process.env.NODE_ENV === "production";

function loadStore(): Promise<Store> {
  if (!CACHE_STORE) return buildStore();
  storePromise ??= buildStore();
  return storePromise;
}

/* ─────────────────────────── Defaults ─────────────────────────── */

/** Fresh-install fallbacks so the frontend renders before anyone has opened
 *  the admin. Every field mirrors the defaultValue in the global's config —
 *  when the global row exists these are never used. */
const DEFAULT_SITE_SETTINGS: SiteSettingsContent = {
  siteName: "বইদ্বীপ",
  tagline: "বাংলা বইয়ের দ্বীপ",
  siteDescription:
    "বাংলা বইয়ের রিভিউ, সারসংক্ষেপ, ফ্রি PDF ডাউনলোড (শুধুমাত্র পাবলিক ডোমেইন ও অনুমতিপ্রাপ্ত বই) এবং অনলাইনে পড়ার সুবিধা।",
  socialLinks: [],
  contactEmail: null,
  footerNote:
    "বইদ্বীপ শুধুমাত্র পাবলিক ডোমেইন, উন্মুক্ত লাইসেন্স ও অনুমতিপ্রাপ্ত বইয়ের PDF বিতরণ করে। কপিরাইটকৃত বইয়ের জন্য কেনার লিংক দেওয়া হয়।",
  featuredCategorySlugs: [],
  featuredListSlugs: [],
  heroBookSlug: null,
};

const DEFAULT_AFFILIATE_SETTINGS: AffiliateSettingsContent = {
  affiliateEnabled: true,
  buyButtonLabel: "রকমারিতে কিনুন",
  downloadButtonLabel: "PDF ডাউনলোড করুন",
  disclosureText:
    "এই পেজের কেনার লিংকগুলো অ্যাফিলিয়েট লিংক। এখান থেকে বই কিনলে বইদ্বীপ একটি ছোট কমিশন পায়, আপনার দাম একই থাকে।",
  postDownloadHeading: "বইটি ভালো লাগলে লেখক ও প্রকাশককে সমর্থন করুন",
  postDownloadBody:
    "ছাপা বই কিনলে লেখকের উত্তরসূরি ও প্রকাশক রয়্যালটি পান। ভালো লাগা বইয়ের একটি ছাপা কপি সংগ্রহে রাখার মতো আনন্দ কমই আছে।",
};

/* ─────────────────────────── The one big fetch ─────────────────────────── */

async function buildStore(): Promise<Store> {
  const payload = await getPayload({ config });
  const toHtml = await makeRichTextRenderer(payload);

  const now = new Date().toISOString();

  // Published + past-dated, everywhere a collection has drafts/scheduling.
  // A future publishDate keeps a document hidden even though it is
  // "published" in the CMS — combined with a daily rebuild this makes a
  // future date behave as real scheduling rather than just a label.
  const publishedNow: Where = {
    and: [
      { _status: { equals: "published" } },
      { publishDate: { less_than_equal: now } },
    ],
  };

  const [
    booksResult,
    chaptersResult,
    authorsResult,
    publishersResult,
    categoriesResult,
    seriesResult,
    listsResult,
    blogResult,
    pagesResult,
    siteSettingsDoc,
    affiliateSettingsDoc,
  ] = await Promise.all([
    payload.find({
      collection: "books",
      pagination: false,
      sort: "-publishDate",
      // Populates authors, publisher, categories, series, cover, pdf in the
      // same query rather than one follow-up per book.
      depth: 1,
      where: publishedNow,
    }),
    payload.find({
      collection: "book-chapters",
      pagination: false,
      sort: "chapterNumber",
      // depth 0 on purpose: the book relationship stays an id, which is all
      // the grouping below needs, and chapter BODIES are heavy — they are
      // rendered per chapter page, not here. Only the summary fields ride in
      // the store.
      depth: 0,
      // `depth: 0` does NOT drop `body`. Depth controls how far
      // RELATIONSHIPS are populated; `body` is a field on the chapter itself,
      // so a depth-0 chapter still carries its entire Lexical document — the
      // single largest column in the database, for every published chapter, in
      // one array, in memory. `select` is the switch that actually leaves it in
      // Postgres. Fields listed here are exactly what toBookChapterSummary()
      // and the grouping loop below read; `id` is always returned.
      select: {
        book: true,
        title: true,
        slug: true,
        chapterNumber: true,
        wordCount: true,
      },
      where: { _status: { equals: "published" } },
    }),
    payload.find({ collection: "authors", pagination: false, sort: "name", depth: 1 }),
    payload.find({ collection: "publishers", pagination: false, sort: "name", depth: 1 }),
    payload.find({
      collection: "categories",
      pagination: false,
      sort: "order",
      depth: 1,
    }),
    payload.find({ collection: "series", pagination: false, sort: "name", depth: 1 }),
    payload.find({
      collection: "lists",
      pagination: false,
      sort: "-publishDate",
      depth: 0,
      where: publishedNow,
    }),
    payload.find({
      collection: "blog-posts",
      pagination: false,
      sort: "-publishDate",
      depth: 1,
      where: publishedNow,
    }),
    // `_status` only, no publishDate: Pages have drafts enabled but no
    // publishDate field, so `publishedNow` cannot be reused here — a filter on a
    // field the collection does not have would match nothing.
    //
    // The filter itself is not optional. Without a `where`, `find` on a
    // drafts-enabled collection returns the newest saved state of every
    // document, `_status: "draft"` included — so an unfinished About page saved
    // as a draft was built into the site and served at /about like any other.
    // Every other drafts collection here filters; this one did not.
    payload.find({
      collection: "pages",
      pagination: false,
      depth: 1,
      where: { _status: { equals: "published" } },
    }),
    payload.findGlobal({ slug: "site-settings", depth: 0 }).catch(() => null),
    payload.findGlobal({ slug: "affiliate-settings", depth: 0 }).catch(() => null),
  ]);

  /* Books first: everything else references them. */
  const books: BookContent[] = [];
  const booksById = new Map<number, BookContent>();
  for (const doc of booksResult.docs as PayloadBook[]) {
    const book = await toBookContent(doc, toHtml);
    books.push(book);
    booksById.set(doc.id, book);
  }

  /* Attach chapter summaries to their books (Tier A online reading). */
  const chaptersByBookId = new Map<number, PayloadBookChapter[]>();
  for (const c of chaptersResult.docs as PayloadBookChapter[]) {
    const bookId = typeof c.book === "object" && c.book !== null ? c.book.id : c.book;
    if (typeof bookId !== "number") continue;
    const bucket = chaptersByBookId.get(bookId) ?? [];
    bucket.push(c);
    chaptersByBookId.set(bookId, bucket);
  }
  for (const [bookId, chapters] of chaptersByBookId) {
    const book = booksById.get(bookId);
    // Chapters attach only to books whose tier permits ONLINE READING, which
    // is Tier A/B only — `permitted` books get the PDF and not the reader (see
    // tierAllowsOnlineReading in lib/types.ts for why the two questions
    // differ). This used to read `!== "in-copyright"`, which quietly published
    // full text for every Tier C book that had chapters, contradicting the
    // validation in collections/BookChapters.ts. A chapter written against a
    // book later reclassified out of Tier A/B silently detaches here — the
    // render-side arm of the gate.
    if (!book || !tierAllowsOnlineReading(book.rightsTier)) continue;
    book.chapters = chapters
      .map(toBookChapterSummary)
      .sort((a, b) => a.order - b.order);
  }

  /* Per-entity book counts, computed from the PUBLISHED set rather than the
   * hook-denormalised fields, which can lag a publish/unpublish. */
  const countFor = (predicate: (b: BookContent) => boolean) => {
    let bookCount = 0;
    let freePdfCount = 0;
    for (const b of books) {
      if (!predicate(b)) continue;
      bookCount += 1;
      if (b.pdfUrl) freePdfCount += 1;
    }
    return { bookCount, freePdfCount };
  };

  const authors: AuthorContent[] = [];
  for (const doc of authorsResult.docs as PayloadAuthor[]) {
    const counts = countFor((b) => b.authors.some((a) => a.slug === doc.slug));
    authors.push(await toAuthorContent(doc, toHtml, counts));
  }

  const publishers: PublisherContent[] = [];
  for (const doc of publishersResult.docs as PayloadPublisher[]) {
    const counts = countFor((b) => b.publisher?.slug === doc.slug);
    publishers.push(await toPublisherContent(doc, toHtml, counts));
  }

  const categories: CategoryContent[] = [];
  for (const doc of categoriesResult.docs as PayloadCategory[]) {
    const { bookCount } = countFor((b) =>
      b.categories.some((c) => c.slug === doc.slug)
    );
    categories.push(await toCategoryContent(doc, toHtml, bookCount));
  }

  const series: SeriesContent[] = [];
  for (const doc of seriesResult.docs as PayloadSeries[]) {
    const { bookCount } = countFor((b) => b.series?.slug === doc.slug);
    series.push(await toSeriesContent(doc, toHtml, bookCount));
  }

  /* PENDING BOOKS: the ones a published list or post names that the query above
   * did not return. Three reasons an id lands here — the book is a draft, it is
   * published with a future date, or it was deleted — and the first two are the
   * ones this exists for. Before it, `resolveBook` returned undefined and the
   * entry vanished from the live list, so publishing a list meant detailing every
   * book in it first; see ReferencedBook in lib/types.ts for the whole argument.
   *
   * WHY A SECOND QUERY RATHER THAN DROPPING `publishedNow` FROM THE FIRST. That
   * one feeds /book/[slug], every shelf, the sitemap and search. Widening it to
   * include drafts would put an unpublished book on the site through a dozen
   * routes to fix one. This query is narrow by construction: specific ids, only
   * the fields a stub row paints, and it is skipped entirely when every reference
   * already resolved — which is the normal case.
   *
   * It runs after the batch above rather than inside it because the ids it needs
   * come out of that batch's own results. One extra round trip per build. */
  const referencedIds = new Set<number>();
  for (const doc of listsResult.docs as PayloadList[]) {
    for (const entry of doc.entries ?? []) {
      const id = relationshipId(entry.book);
      if (id !== undefined && !booksById.has(id)) referencedIds.add(id);
    }
  }
  for (const doc of blogResult.docs as PayloadBlogPost[]) {
    for (const raw of doc.relatedBooks ?? []) {
      const id = relationshipId(raw);
      if (id !== undefined && !booksById.has(id)) referencedIds.add(id);
    }
  }

  const pendingBooksById = new Map<number, BookSummary>();
  if (referencedIds.size > 0) {
    const pendingResult = await payload.find({
      collection: "books",
      pagination: false,
      // The newest saved state, which for a draft-only book is the draft. Without
      // this a book that has been published once and then edited back into draft
      // would return its stale published version and render as a live entry.
      draft: true,
      // depth 1 populates `authors` and `cover`, the only two relationships a
      // stub row reads. Verified against the real database: a draft with one
      // author comes back with the author document, not its id.
      depth: 1,
      where: { id: { in: [...referencedIds] } },
      // Everything toPendingBookSummary reads and nothing else. A draft book's
      // synopsis, review, rights evidence and prices stay in Postgres — they are
      // not on the page, so they have no business in the build's memory.
      select: {
        title: true,
        titleLatin: true,
        slug: true,
        authors: true,
        cover: true,
        rightsTier: true,
        publishDate: true,
        updatedAt: true,
      },
    });
    for (const doc of pendingResult.docs as PayloadBook[]) {
      pendingBooksById.set(doc.id, toPendingBookSummary(doc));
    }
  }

  /** One resolver, so the live-or-pending decision is made in one place rather
   *  than once per builder. Returns undefined only for a book that is genuinely
   *  gone, which is the one case a list entry is still dropped for. */
  const resolveBook = (id: number): ReferencedBook | undefined => {
    const live = booksById.get(id);
    if (live) return { book: toBookSummary(live), pending: false };
    const stub = pendingBooksById.get(id);
    return stub ? { book: stub, pending: true } : undefined;
  };

  const lists: ListContent[] = [];
  for (const doc of listsResult.docs as PayloadList[]) {
    lists.push(await toListContent(doc, toHtml, resolveBook));
  }

  const blogPosts: BlogPostContent[] = [];
  for (const doc of blogResult.docs as PayloadBlogPost[]) {
    blogPosts.push(await toBlogPostContent(doc, toHtml, resolveBook));
  }

  const pages: StaticPage[] = [];
  for (const doc of pagesResult.docs as PayloadPage[]) {
    pages.push(await toStaticPage(doc, toHtml));
  }

  /* Globals → flat settings, with fresh-install defaults. */
  const s = siteSettingsDoc as Record<string, unknown> | null;
  const refSlug = (v: unknown): string | null => {
    // depth 0 keeps relationships as ids; resolve through booksById & co.
    if (typeof v === "number") return booksById.get(v)?.slug ?? null;
    if (v && typeof v === "object" && "slug" in v) return String((v as { slug: unknown }).slug);
    return null;
  };
  const refSlugs = (v: unknown, resolve: (id: number) => string | null): string[] =>
    Array.isArray(v)
      ? v
          .map((item) =>
            typeof item === "number"
              ? resolve(item)
              : item && typeof item === "object" && "slug" in item
                ? String((item as { slug: unknown }).slug)
                : null
          )
          .filter((x): x is string => Boolean(x))
      : [];

  const categoryById = new Map(
    (categoriesResult.docs as PayloadCategory[]).map((c) => [c.id, c.slug])
  );
  const listById = new Map((listsResult.docs as PayloadList[]).map((l) => [l.id, l.slug]));

  const siteSettings: SiteSettingsContent = s
    ? {
        siteName: (s.siteName as string) || DEFAULT_SITE_SETTINGS.siteName,
        tagline: (s.tagline as string) || DEFAULT_SITE_SETTINGS.tagline,
        siteDescription:
          (s.siteDescription as string) || DEFAULT_SITE_SETTINGS.siteDescription,
        socialLinks: Array.isArray(s.socialLinks)
          ? (s.socialLinks as Array<{ label?: string; url?: string }>)
              .filter((l) => l.label && l.url)
              .map((l) => ({ label: l.label as string, url: l.url as string }))
          : [],
        contactEmail: (s.contactEmail as string) || null,
        footerNote: (s.footerNote as string) || DEFAULT_SITE_SETTINGS.footerNote,
        featuredCategorySlugs: refSlugs(s.featuredCategories, (id) =>
          categoryById.get(id) ?? null
        ),
        featuredListSlugs: refSlugs(s.featuredLists, (id) => listById.get(id) ?? null),
        heroBookSlug: refSlug(s.heroBook),
      }
    : DEFAULT_SITE_SETTINGS;

  const a = affiliateSettingsDoc as Record<string, unknown> | null;
  const affiliateSettings: AffiliateSettingsContent = a
    ? {
        affiliateEnabled: a.affiliateEnabled !== false,
        buyButtonLabel:
          (a.buyButtonLabel as string) || DEFAULT_AFFILIATE_SETTINGS.buyButtonLabel,
        downloadButtonLabel:
          (a.downloadButtonLabel as string) ||
          DEFAULT_AFFILIATE_SETTINGS.downloadButtonLabel,
        disclosureText:
          (a.disclosureText as string) || DEFAULT_AFFILIATE_SETTINGS.disclosureText,
        postDownloadHeading:
          (a.postDownloadHeading as string) ||
          DEFAULT_AFFILIATE_SETTINGS.postDownloadHeading,
        postDownloadBody:
          (a.postDownloadBody as string) || DEFAULT_AFFILIATE_SETTINGS.postDownloadBody,
      }
    : DEFAULT_AFFILIATE_SETTINGS;

  return {
    books,
    booksById,
    authors,
    publishers,
    categories,
    series,
    lists,
    blogPosts,
    pages,
    siteSettings,
    affiliateSettings,
  };
}

// ---------------------------------------------------------------------------
// Public API — everything the routes call. All async; a database cannot be
// read synchronously at import time the way a content directory could.
// ---------------------------------------------------------------------------

/* ───────── Books ───────── */

export async function getAllBooks(): Promise<BookContent[]> {
  return (await loadStore()).books;
}

export async function getBook(slug: string): Promise<BookContent | undefined> {
  return (await getAllBooks()).find((b) => b.slug === slug);
}

export async function getRecentBooks(limit: number): Promise<BookSummary[]> {
  return (await getAllBooks()).slice(0, limit).map(toBookSummary);
}

/** Books with a downloadable PDF, newest first — the "ফ্রি PDF" rail. */
export async function getFreePdfBooks(limit?: number): Promise<BookSummary[]> {
  const free = (await getAllBooks()).filter((b) => b.pdfUrl);
  return (limit ? free.slice(0, limit) : free).map(toBookSummary);
}

/** Manually curated via the "popular" checkbox, topped up with recent books
 *  so the rail is never empty on a fresh site. `excludeSlug` is applied
 *  BEFORE the limit so pages that pass it still get `limit` items. */
export async function getPopularBooks(
  limit: number,
  excludeSlug?: string
): Promise<BookSummary[]> {
  const all = (await getAllBooks()).filter((b) => b.slug !== excludeSlug);
  const flagged = all.filter((b) => b.popular);
  const rest = all.filter((b) => !b.popular);
  return [...flagged, ...rest].slice(0, limit).map(toBookSummary);
}

export async function getFeaturedBooks(limit: number): Promise<BookSummary[]> {
  const all = await getAllBooks();
  const featured = all.filter((b) => b.featured);
  const rest = all.filter((b) => !b.featured);
  return [...featured, ...rest].slice(0, limit).map(toBookSummary);
}

/** Same author first, then same primary category — the "আরও বই" rail on a
 *  book page. Spreads internal links along the axes a reader actually
 *  follows: "more by this author", then "more like this". */
export async function getRelatedBooks(
  book: BookContent,
  limit: number
): Promise<BookSummary[]> {
  const all = (await getAllBooks()).filter((b) => b.slug !== book.slug);
  const authorSlugs = new Set(book.authors.map((a) => a.slug));
  const sameAuthor = all.filter((b) => b.authors.some((a) => authorSlugs.has(a.slug)));
  const sameCategory = all.filter(
    (b) =>
      !sameAuthor.includes(b) &&
      book.primaryCategory &&
      b.categories.some((c) => c.slug === book.primaryCategory?.slug)
  );
  return [...sameAuthor, ...sameCategory].slice(0, limit).map(toBookSummary);
}

/* ───────── Chapters (online reader) ───────── */

/** The FULL chapter body, fetched on demand by the reader route only — the
 *  store deliberately holds summaries. One extra query per chapter page at
 *  build time, in exchange for a store that stays small. */
export async function getBookChapter(
  bookSlug: string,
  chapterSlug: string
): Promise<{ book: BookContent; chapter: BookChapterContent } | undefined> {
  const book = await getBook(bookSlug);
  // The chapter list on the book is already Tier-gated; an empty list means
  // there is nothing to read regardless of what the chapters table holds.
  if (!book || !book.chapters.some((c) => c.slug === chapterSlug)) return undefined;

  const payload = await getPayload({ config });
  const toHtml = await makeRichTextRenderer(payload);
  // BOTH identifiers in the WHERE, not one plus a filter afterwards. Chapter
  // slugs are unique per book, not globally (collections/BookChapters.ts
  // indexes [book, slug] unique), so "chapter-1" exists on every book on the
  // site. Fetching by slug alone and picking the right parent out of the page
  // means the answer depends on which ten rows Postgres returned: once more
  // than ten books have a "chapter-1", the correct chapter can fall off the
  // end of the page and a real URL 404s — non-deterministically, worse on the
  // most common slug names. Constraining on book.slug lets the join do it and
  // makes limit: 1 exact.
  const result = await payload.find({
    collection: "book-chapters",
    where: {
      and: [
        { slug: { equals: chapterSlug } },
        { "book.slug": { equals: bookSlug } },
        { _status: { equals: "published" } },
      ],
    },
    depth: 1,
    limit: 1,
  });
  const doc = result.docs[0] as PayloadBookChapter | undefined;
  if (!doc) return undefined;
  return { book, chapter: await toBookChapterContent(doc, toHtml) };
}

/* ───────── Authors / publishers / taxonomy ───────── */

export async function getAuthors(): Promise<AuthorContent[]> {
  return (await loadStore()).authors;
}

export async function getAuthor(slug: string): Promise<AuthorContent | undefined> {
  return (await getAuthors()).find((a) => a.slug === slug);
}

export async function getBooksByAuthor(authorSlug: string): Promise<BookContent[]> {
  return (await getAllBooks()).filter((b) =>
    b.authors.some((a) => a.slug === authorSlug)
  );
}

export async function getPublishers(): Promise<PublisherContent[]> {
  return (await loadStore()).publishers;
}

export async function getPublisher(slug: string): Promise<PublisherContent | undefined> {
  return (await getPublishers()).find((p) => p.slug === slug);
}

export async function getBooksByPublisher(publisherSlug: string): Promise<BookContent[]> {
  return (await getAllBooks()).filter((b) => b.publisher?.slug === publisherSlug);
}

export async function getCategories(): Promise<CategoryContent[]> {
  return (await loadStore()).categories;
}

export async function getCategory(slug: string): Promise<CategoryContent | undefined> {
  return (await getCategories()).find((c) => c.slug === slug);
}

export async function getBooksByCategory(categorySlug: string): Promise<BookContent[]> {
  return (await getAllBooks()).filter((b) =>
    b.categories.some((c) => c.slug === categorySlug)
  );
}

export async function getAllSeries(): Promise<SeriesContent[]> {
  return (await loadStore()).series;
}

export async function getSeries(slug: string): Promise<SeriesContent | undefined> {
  return (await getAllSeries()).find((s) => s.slug === slug);
}

/** Series books in reading order (seriesNumber), unnumbered ones last. */
export async function getBooksBySeries(seriesSlug: string): Promise<BookContent[]> {
  return (await getAllBooks())
    .filter((b) => b.series?.slug === seriesSlug)
    .sort((a, b) => (a.series?.position ?? 9999) - (b.series?.position ?? 9999));
}

/* ───────── Lists / blog / pages ───────── */

export async function getLists(): Promise<ListContent[]> {
  return (await loadStore()).lists;
}

export async function getList(slug: string): Promise<ListContent | undefined> {
  return (await getLists()).find((l) => l.slug === slug);
}

export async function getBlogPosts(): Promise<BlogPostContent[]> {
  return (await loadStore()).blogPosts;
}

export async function getBlogPost(slug: string): Promise<BlogPostContent | undefined> {
  return (await getBlogPosts()).find((p) => p.slug === slug);
}

export async function getPages(): Promise<StaticPage[]> {
  return (await loadStore()).pages;
}

export async function getPage(slug: string): Promise<StaticPage | undefined> {
  return (await getPages()).find((p) => p.slug === slug);
}

/* ───────── Globals ───────── */

export async function getSiteSettings(): Promise<SiteSettingsContent> {
  return (await loadStore()).siteSettings;
}

export async function getAffiliateSettings(): Promise<AffiliateSettingsContent> {
  return (await loadStore()).affiliateSettings;
}

/* ───────── Reviews ───────── */

/** Approved reviews for one book, newest first. NOT in the store: reviews
 *  arrive continuously and the book page is the only consumer, so a direct
 *  query keeps the store's shape stable. Email and ipHash are stripped HERE
 *  — the ReviewItem shape is the proof they never reach a page prop. */
export async function getApprovedReviews(bookSlug: string): Promise<ReviewItem[]> {
  const book = await getBook(bookSlug);
  if (!book) return [];
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "reviews",
    where: {
      and: [{ status: { equals: "approved" } }, { "book.slug": { equals: bookSlug } }],
    },
    sort: "-createdAt",
    depth: 0,
    limit: 100,
  });
  return result.docs.map((r) => ({
    id: String(r.id),
    authorName: r.authorName,
    rating: r.rating,
    body: r.body,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

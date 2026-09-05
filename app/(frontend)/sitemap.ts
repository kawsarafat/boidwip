import type { MetadataRoute } from "next";
import {
  getAllBooks,
  getAuthors,
  getPublishers,
  getCategories,
  getAllSeries,
  getLists,
  getBlogPosts,
  getPages,
} from "@/lib/data";
import { isReservedRouteSlug, tierAllowsOnlineReading, htmlWordCount } from "@/lib/types";
import { isThinEntityPage } from "@/lib/seo";

/** The sitemap: every canonical URL on this site that answers 200, and nothing
 *  else.
 *
 *  THREE RULES, each of them a defect this file used to have:
 *
 *  1. No `priority`, no `changeFrequency`. Google has said for years that it
 *     ignores both. They were noise in the XML and, worse, noise in this file —
 *     a reviewer reading `priority: 0.9` reasonably assumes it buys something.
 *     `lastModified` is the one hint still read, so it is the only one this
 *     file spends effort getting right.
 *
 *  2. A URL that 404s must never appear. Two ways that happened here: reader
 *     chapters were listed for every book that had chapter rows, including
 *     tiers whose text this site may not serve; and /about, /contact and
 *     /privacy-policy were listed unconditionally although each renders a CMS
 *     page and calls notFound() when it is missing.
 *
 *  3. A URL the page itself marks noindex must not appear either — that is a
 *     sitemap and a meta tag arguing with each other. Thin author/publisher
 *     pages are held out by the SAME predicate that sets their meta tag. */

// Single source of truth for the deploy URL. Set NEXT_PUBLIC_SITE_URL in
// Vercel's environment variables once the custom domain is attached,
// until then this correctly falls back to the Vercel URL.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The trust pages that have their own hard-coded routes under app/(frontend)/,
 *  each rendering the CMS page of the same slug. One list, two jobs: emit those
 *  three URLs with the page's real updatedAt, and keep them out of
 *  genericPageRoutes so they are never listed twice. */
const TRUST_PAGES: readonly string[] = ["about", "contact", "privacy-policy"];

/** Google rejects a sitemap FILE over 50,000 URLs (or 50MB uncompressed) —
 *  rejects, not truncates, so silently dropping URLs here would trade a visible
 *  error for an invisible one. Hence: warn at build time, emit everything, and
 *  fix it the documented way. The fix is Next's generateSitemaps(): return
 *  [{ id: 0 }, { id: 1 }, …] from it, take `id` as a parameter here, slice the
 *  assembled array, and Next serves /sitemap/0.xml … behind a sitemap index. */
const SITEMAP_URL_LIMIT = 50_000;

/** Newest of a set of ISO timestamps, or undefined when none is valid.
 *
 *  Takes an ARRAY rather than rest arguments deliberately: the call sites pass
 *  one entry per book, and spreading a catalogue-sized array into a call is how
 *  you discover your engine's argument limit. */
function newestDate(
  dates: ReadonlyArray<string | null | undefined>
): string | undefined {
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const date of dates) {
    if (!date) continue;
    const ms = Date.parse(date);
    if (!Number.isFinite(ms) || ms <= bestMs) continue;
    best = date;
    bestMs = ms;
  }
  return best;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [books, authors, publishers, categories, series, lists, posts, pages] =
    await Promise.all([
      getAllBooks(),
      getAuthors(),
      getPublishers(),
      getCategories(),
      getAllSeries(),
      getLists(),
      getBlogPosts(),
      getPages(),
    ]);

  /* lastModified for the routes that own no document of their own. Each gets
   * the newest timestamp among the records IT renders, so /new and /popular
   * move when the catalogue moves and /blog does not move because a book was
   * edited. */
  const newestBook = newestDate(books.map((b) => b.updatedAt));
  const newestPost = newestDate(posts.map((p) => p.updatedAt));
  const newestList = newestDate(lists.map((l) => l.updatedAt));
  const newestOverall = newestDate([newestBook, newestPost, newestList]);

  /* The three trust pages, listed only when the CMS page they render exists.
   * StaticPageBody calls notFound() otherwise, so listing them unconditionally
   * advertised three guaranteed 404s on a fresh deploy — and these are exactly
   * the pages a review judges a site's legitimacy by, which is why the warning
   * names them instead of failing quietly. */
  const trustRoutes: MetadataRoute.Sitemap = [];
  const missingTrustPages: string[] = [];
  for (const slug of TRUST_PAGES) {
    const page = pages.find((p) => p.slug === slug);
    if (!page) {
      missingTrustPages.push(slug);
      continue;
    }
    trustRoutes.push({ url: `${BASE_URL}/${slug}`, lastModified: page.updatedAt });
  }
  if (missingTrustPages.length > 0) {
    console.warn(
      `[sitemap] no published CMS page for: ${missingTrustPages.join(", ")}. ` +
        `Those routes 404 today, so they are held out of the sitemap. Write them in the admin.`
    );
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: newestOverall },
    { url: `${BASE_URL}/new`, lastModified: newestBook },
    { url: `${BASE_URL}/popular`, lastModified: newestBook },
    // The bare /search page is a legitimate landing page. Its ?q= RESULT URLs
    // are noindex,follow and are not URLs a sitemap could enumerate anyway.
    { url: `${BASE_URL}/search`, lastModified: newestBook },
    { url: `${BASE_URL}/blog`, lastModified: newestPost },
    ...trustRoutes,
  ];

  /* The five hub indexes — /list, /author, /category, /publisher, /series.
   *
   * These are new, and until they existed all five 404'd while every
   * /<hub>/<slug> beneath them resolved. They were correctly absent from this
   * file then; they belong in it now.
   *
   * EMITTED ONLY WHEN THE HUB HAS ROWS, because an empty hub sets
   * `robots: { index: false }` in its own generateMetadata — that is rule 3
   * above, and stating it as one filter over a table is how the five cannot
   * drift apart. lastModified is the newest record the hub renders, so /author
   * moves when an author is edited and not when a blog post is. */
  const hubRoutes: MetadataRoute.Sitemap = (
    [
      ["list", lists.map((l) => l.updatedAt)],
      ["author", authors.map((a) => a.updatedAt)],
      ["category", categories.map((c) => c.updatedAt)],
      ["publisher", publishers.map((p) => p.updatedAt)],
      ["series", series.map((s) => s.updatedAt)],
    ] as const
  )
    .filter(([, dates]) => dates.length > 0)
    .map(([path, dates]) => ({
      url: `${BASE_URL}/${path}`,
      lastModified: newestDate(dates),
    }));

  const bookRoutes: MetadataRoute.Sitemap = books.map((b) => ({
    url: `${BASE_URL}/book/${b.slug}`,
    lastModified: b.updatedAt,
  }));

  /* Reader hubs and reader chapters — long-tail "অনলাইনে পড়ুন" entries, and the
   * one part of this file that can leak a rights problem straight into Google's
   * index.
   *
   * The tier gate is stated HERE even though lib/data.ts already empties
   * `chapters` for any book outside Tier A/B. Two arms on purpose: this is the
   * file that publishes URLs to the outside world, and it should not depend on
   * a distant invariant in the store to stay lawful. tierAllowsOnlineReading
   * names the sitemap among its callers (lib/types.ts) for that reason — until
   * this line it was a documented caller that never actually called.
   *
   * The `/read` index is emitted under exactly the predicate its own
   * generateStaticParams uses (Tier A/B *and* at least one chapter), because
   * `dynamicParams = false` means a book that fails either half has no such URL
   * to advertise. */
  const readableBooks = books.filter(
    (b) => tierAllowsOnlineReading(b.rightsTier) && b.chapters.length > 0
  );

  const readerIndexRoutes: MetadataRoute.Sitemap = readableBooks.map((b) => ({
    url: `${BASE_URL}/book/${b.slug}/read`,
    lastModified: b.updatedAt,
  }));

  const chapterRoutes: MetadataRoute.Sitemap = readableBooks.flatMap((b) =>
    b.chapters.map((c) => ({
      url: `${BASE_URL}/book/${b.slug}/read/${c.slug}`,
      // The chapter's own updatedAt is not in the store (lib/data.ts selects
      // only summary fields), and saving a chapter touches its book, so the
      // book's timestamp is both available and honest enough.
      lastModified: b.updatedAt,
    }))
  );

  // Thin entity pages carry noindex (lib/seo.ts); listing a URL the page
  // itself asks Google not to index is a mixed signal, so they are held out
  // of the sitemap by the SAME rule that sets the meta tag.
  const authorRoutes: MetadataRoute.Sitemap = authors
    .filter((a) => !isThinEntityPage(a.bookCount, a.bioWordCount))
    .map((a) => ({ url: `${BASE_URL}/author/${a.slug}`, lastModified: a.updatedAt }));

  const publisherRoutes: MetadataRoute.Sitemap = publishers
    // htmlWordCount, the same helper the publisher page's own noindex decision
    // calls. This was an inline regex, and the page had a second one: two copies
    // of a predicate whose whole job is that the meta tag and the sitemap agree.
    .filter((p) => !isThinEntityPage(p.bookCount, htmlWordCount(p.descriptionHtml)))
    .map((p) => ({ url: `${BASE_URL}/publisher/${p.slug}`, lastModified: p.updatedAt }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/category/${c.slug}`,
    lastModified: c.updatedAt,
  }));

  const seriesRoutes: MetadataRoute.Sitemap = series.map((s) => ({
    url: `${BASE_URL}/series/${s.slug}`,
    lastModified: s.updatedAt,
  }));

  const listRoutes: MetadataRoute.Sitemap = lists.map((l) => ({
    url: `${BASE_URL}/list/${l.slug}`,
    lastModified: l.updatedAt,
  }));

  const blogRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: p.updatedAt,
  }));

  /* Editor-added pages at the domain root. The same two exclusions as the
   * catch-all's generateStaticParams (app/(frontend)/[slug]/page.tsx): the
   * trust slugs are emitted above, and a page whose slug shadows a real route
   * namespace is not reachable at that URL at all. */
  const genericPageRoutes: MetadataRoute.Sitemap = pages
    .filter((p) => !TRUST_PAGES.includes(p.slug) && !isReservedRouteSlug(p.slug))
    .map((p) => ({ url: `${BASE_URL}/${p.slug}`, lastModified: p.updatedAt }));

  const urls: MetadataRoute.Sitemap = [
    ...staticRoutes,
    ...hubRoutes,
    ...bookRoutes,
    ...readerIndexRoutes,
    ...chapterRoutes,
    ...authorRoutes,
    ...publisherRoutes,
    ...categoryRoutes,
    ...seriesRoutes,
    ...listRoutes,
    ...blogRoutes,
    ...genericPageRoutes,
  ];

  if (urls.length > SITEMAP_URL_LIMIT) {
    console.warn(
      `[sitemap] ${urls.length} URLs exceeds the ${SITEMAP_URL_LIMIT}-URL limit for a single ` +
        `sitemap file; Google rejects the whole file. Split it with generateSitemaps() — see the note above.`
    );
  }

  return urls;
}

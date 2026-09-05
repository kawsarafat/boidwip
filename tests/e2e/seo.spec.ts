import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { toBengaliNumerals } from "@/lib/numerals";
import { SITE_NAME } from "@/lib/seo";

/** The indexing contract (audit #12, #14, #16, and the "structured data matches
 *  visible content" essential test).
 *
 *  These are the failures that cost traffic silently. A 404 in the sitemap, a
 *  canonical pointing at the wrong host, a brand appended twice — nothing
 *  crashes, no error appears in a log, and the damage shows up weeks later as a
 *  page that never ranked. So they are asserted against a real production build
 *  over HTTP, which is the only place metadata resolution, `title.template` and
 *  the sitemap route all exist at once.
 *
 *  THE SITEMAP IS THE FIXTURE. Rather than hard-coding a list of URLs to check,
 *  the specs read /sitemap.xml and hold the site to its own claims: every URL it
 *  advertises answers 200, and each page's canonical is exactly the URL the
 *  sitemap listed for it. That is the invariant a hand-written list can only
 *  approximate, and it grows with the catalogue for free.
 *
 *  ORIGIN REWRITING IS DELIBERATE. Sitemap entries are absolute and carry the
 *  host the BUILD baked in, because that is what a sitemap is for. Fetching them
 *  verbatim would send this suite at whatever host that is — from CI, on every
 *  push, at the live site. So the origin is asserted, then dropped, and only the
 *  path is requested against the server under test. */

/** The origin this process EXPECTS the build to have baked in, or null when it
 *  has no way to know.
 *
 *  `NEXT_PUBLIC_SITE_URL` is read by `next build`, not by Playwright: a local
 *  run against a local build cannot see the value that build used. Failing on
 *  that mismatch is what made three of these tests red for a reason with nothing
 *  to do with SEO — and a suite that needs two undocumented environment
 *  variables to go green is a suite nobody runs, which is precisely what
 *  happened to this one. So the production-origin check is hard in CI (where the
 *  fallback below is the truth) and only as strong as what the runner supplies
 *  locally. What is asserted unconditionally, in every environment, is that the
 *  site AGREES WITH ITSELF — see declaredOrigin. */
const EXPECTED_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.CI ? "https://boidwip.vercel.app" : null);
const expectedOrigin = EXPECTED_ORIGIN ? new URL(EXPECTED_ORIGIN).origin : null;

/** How many sitemap URLs get the full page-level treatment (fetch the HTML,
 *  parse the canonical). Every URL is still checked for a 200 — this caps only
 *  the expensive half, so the suite stays a smoke test on a large catalogue. */
const CANONICAL_SAMPLE = 15;

const decodeXml = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeXml(m[1]));

/** `href` out of whichever <link> carries rel="canonical" — attribute order in
 *  the emitted tag is Next's business, not this test's. */
const canonicalOf = (html: string): string | null => {
  const tag = html.match(/<link[^>]*rel="canonical"[^>]*>/i)?.[0];
  return tag?.match(/href="([^"]+)"/i)?.[1] ?? null;
};

const titleOf = (html: string): string =>
  decodeXml(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "");

/** The document with every <script> stripped — the markup a reader sees.
 *
 *  Not cosmetic. Next serialises the router tree into an RSC flight payload of
 *  `self.__next_f.push(...)` script tags, and that tree includes the not-found
 *  boundary for EVERY route. So the raw HTML of the home page, a book page and
 *  a trust page each contain exactly one "৪০৪", whether or not anything 404'd.
 *  A substring search over `await res.text()` therefore reports a soft 404 on
 *  every page on the site, which is how this check once produced a false
 *  positive convincing enough to be investigated as a real defect. Anything
 *  asserting on what RENDERED must look outside <script>. */
const markupOf = (html: string): string =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

/** Serial requests would make a real catalogue take minutes; unbounded
 *  Promise.all would open a socket per URL. Batches of a handful is the boring
 *  middle. */
async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/** Deterministic spread across the list rather than the first N, which would be
 *  all static routes and never reach a book or a chapter. */
const sample = <T,>(items: readonly T[], count: number): T[] => {
  if (items.length <= count) return [...items];
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)]);
};

/** The absolute origin the site advertises for itself, read from its own
 *  sitemap, plus the assertion that it is the expected one when that is knowable.
 *
 *  Every cross-surface check below compares against THIS rather than against an
 *  environment variable, because the failure that costs traffic is the sitemap,
 *  the robots.txt Sitemap: line and the canonical tags disagreeing with each
 *  other — and that disagreement is detectable no matter which host the build
 *  was pointed at. */
async function declaredOrigin(request: APIRequestContext): Promise<string> {
  const xml = await (await request.get("/sitemap.xml")).text();
  const first = locsOf(xml)[0];
  expect(first, "sitemap lists no URL to read an origin from").toBeTruthy();
  const origin = new URL(first).origin;
  if (expectedOrigin) {
    expect(origin, `sitemap advertises ${origin}, expected ${expectedOrigin}`).toBe(expectedOrigin);
  }
  return origin;
}

test.describe("sitemap (#14)", () => {
  test("every advertised URL answers 200 on the production host", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok(), "/sitemap.xml must be served").toBeTruthy();
    expect(res.headers()["content-type"]).toContain("xml");

    const xml = await res.text();
    const locs = locsOf(xml);
    // A sitemap that lists nothing would pass every assertion below.
    expect(locs.length, "sitemap must list at least the static routes").toBeGreaterThan(4);
    const origin = await declaredOrigin(request);

    // No duplicates: two entries for one URL is a self-inflicted duplicate
    // signal, and it is how the trust pages used to appear (once by hand, once
    // through the generic CMS page loop).
    expect(new Set(locs).size, "sitemap contains a duplicate URL").toBe(locs.length);

    for (const loc of locs) {
      expect(new URL(loc).origin, `${loc} is not on the advertised host`).toBe(origin);
    }

    // lastmod is the only hint Google still reads, so a malformed or
    // future-dated one is the whole value of the field thrown away.
    const horizon = Date.now() + 24 * 60 * 60 * 1000;
    for (const lastmod of [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1])) {
      const ms = Date.parse(lastmod);
      expect(Number.isFinite(ms), `unparseable lastmod: ${lastmod}`).toBe(true);
      expect(ms, `lastmod is in the future: ${lastmod}`).toBeLessThan(horizon);
    }

    const statuses = await inBatches(locs, 8, async (loc) => {
      const path = new URL(loc).pathname;
      // Path only: the origin was asserted above, and the server under test is
      // the one that has to answer.
      const page = await request.get(path);
      return { path, status: page.status() };
    });

    const broken = statuses.filter((s) => s.status !== 200);
    expect(broken, `sitemap URLs that did not return 200: ${JSON.stringify(broken)}`).toEqual(
      [],
    );
  });

  test("each page's canonical is the URL the sitemap listed for it", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const locs = sample(locsOf(xml), CANONICAL_SAMPLE);
    expect(locs.length).toBeGreaterThan(0);

    for (const loc of locs) {
      const html = await (await request.get(new URL(loc).pathname)).text();
      const canonical = canonicalOf(html);
      expect(canonical, `${loc} renders no canonical link`).not.toBeNull();
      // .href on both sides so a default port or an escaped character cannot
      // fail a comparison that is really about host and path.
      expect(new URL(canonical!).href, `canonical mismatch for ${loc}`).toBe(new URL(loc).href);
    }
  });
});

/** content of whichever <meta> carries this property/name, order-independent. */
const metaOf = (html: string, key: string): string | null => {
  const tag = html.match(
    new RegExp(`<meta[^>]*(?:property|name)="${key}"[^>]*>`, "i"),
  )?.[0];
  const content = tag?.match(/content="([^"]*)"/i)?.[1];
  return content === undefined ? null : decodeXml(content);
};

test.describe("titles (#12)", () => {
  test("the brand appears exactly once per title surface", async ({ request }) => {
    // The bug: route metadata spelled the brand out AND the layout template
    // appended it, so tabs read "… | বইদ্বীপ | বইদ্বীপ". Counting occurrences
    // catches it from either direction — a route that adds the brand back, or a
    // template that stops adding it.
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const loc of sample(locsOf(xml), 8)) {
      const path = new URL(loc).pathname;
      const html = await (await request.get(path)).text();

      const title = titleOf(html);
      expect(title.length, `${path} has an empty <title>`).toBeGreaterThan(0);
      expect(title.split(SITE_NAME).length - 1, `brand count in ${path}: ${title}`).toBe(1);
      // A formula that ended with the separator produced "… | | বইদ্বীপ".
      expect(title, path).not.toContain("| |");
      expect(title.trim(), path).toBe(title);

      // Open Graph keeps its own template in Next, which is exactly how one
      // surface drifted from the other.
      const ogTitle = metaOf(html, "og:title");
      if (ogTitle !== null) {
        expect(ogTitle.split(SITE_NAME).length - 1, `og:title on ${path}: ${ogTitle}`).toBe(1);
      }
    }
  });
});

test.describe("crawl rules", () => {
  test("robots.txt closes the admin, the API and the preview route", async ({ request }) => {
    const res = await request.get("/robots.txt");
    // Next 16 silently dropped this route when the file lived inside the
    // (frontend) group — a missing robots.txt fails invisibly, so its presence
    // is asserted, not assumed.
    expect(res.ok(), "/robots.txt must be served").toBeTruthy();
    const text = await res.text();

    for (const path of ["/admin", "/api", "/preview", "/search?"]) {
      expect(text, `robots.txt must disallow ${path}`).toContain(`Disallow: ${path}`);
    }
    // Same origin the sitemap advertises for its own entries: robots pointing at
    // one host while the sitemap lists another is a crawler dead end.
    expect(text).toContain(`Sitemap: ${await declaredOrigin(request)}/sitemap.xml`);
  });

  test("a faceted search URL canonicalises to the bare search page", async ({ request }) => {
    // The chosen fix for faceted navigation: a crawl rule above plus one
    // canonical, rather than a noindex that would force the route dynamic.
    const html = await (await request.get("/search?q=%E0%A6%AC%E0%A6%87")).text();
    expect(new URL(canonicalOf(html)!).href).toBe(`${await declaredOrigin(request)}/search`);
  });
});

test.describe("trust pages", () => {
  test("about, contact and privacy-policy are real pages", async ({ request }) => {
    // Each renders a CMS document and calls notFound() when it is missing, so
    // on a fresh database these are three guaranteed 404s — and they are the
    // pages an ad network or a takedown notice looks for first.
    for (const slug of ["about", "contact", "privacy-policy"]) {
      const res = await request.get(`/${slug}`);
      expect(res.status(), `/${slug} must exist`).toBe(200);
      const markup = markupOf(await res.text());
      // A soft 404 (200 with the not-found body) would pass the status check.
      // NotFoundContent opens with the Bengali numeral 404, which appears
      // nowhere else in the RENDERED markup — see markupOf on why the raw HTML
      // is the wrong thing to search.
      expect(markup, `/${slug} rendered the not-found body`).not.toContain("৪০৪");
      // And the positive half: a page that rendered nothing at all would also
      // contain no 404 marker. StaticPageArticle prints the CMS title as the h1.
      expect(markup, `/${slug} rendered no <h1>`).toMatch(/<h1[^>]*>[^<]/);
    }
  });
});

type JsonLdNode = Record<string, unknown>;

/** Every node of every ld+json block on the page, @graph flattened. Written as
 *  a helper because the book page emits one block and the layout may add more;
 *  which block a node lives in is not this test's business. */
async function jsonLdNodes(page: Page): Promise<JsonLdNode[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const nodes: JsonLdNode[] = [];
  for (const block of blocks) {
    // safeJsonLd escapes every "<" to its unicode form, which is inert inside
    // JSON — this parsing back cleanly is itself part of the contract.
    const parsed = JSON.parse(block) as JsonLdNode;
    const graph = parsed["@graph"];
    if (Array.isArray(graph)) nodes.push(...(graph as JsonLdNode[]));
    else nodes.push(parsed);
  }
  return nodes;
}

const nodeOfType = (nodes: JsonLdNode[], type: string): JsonLdNode | undefined =>
  nodes.find((n) => n["@type"] === type);

test.describe("structured data matches visible content", () => {
  test("a book page never claims more than the page shows", async ({ page, request }) => {
    // Both tier branches, because the interesting half of this invariant is
    // what a copyrighted book must NOT claim.
    const queries = [
      "where[rightsTier][in]=public-domain,open-licence,permitted",
      "where[rightsTier][equals]=in-copyright",
    ];
    const slugs: string[] = [];
    for (const query of queries) {
      const res = await request.get(`/api/books?limit=1&depth=0&${query}`);
      const doc = ((await res.json()) as { docs?: JsonLdNode[] }).docs?.[0];
      if (typeof doc?.slug === "string") slugs.push(doc.slug);
    }
    test.skip(slugs.length === 0, "no published book to inspect");

    for (const slug of slugs) {
      await page.goto(`/book/${slug}`);
      const nodes = await jsonLdNodes(page);
      const book = nodeOfType(nodes, "Book");
      expect(book, `/book/${slug} emits no Book node`).toBeTruthy();
      if (!book) continue;

      // innerText, not textContent: textContent would include the JSON-LD
      // script itself, and every assertion below would then be circular.
      const visible = await page.locator("body").innerText();
      const name = String(book.name);

      // The h1 is the title, plus the download promise when there is a file to
      // download. Equality against both allowed forms rather than a substring
      // check, so a stray suffix on either side fails.
      const h1 = (await page.locator("h1").first().innerText()).trim();
      expect([name, `${name} PDF Download`], `h1 vs Book.name on /book/${slug}`).toContain(h1);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(String(book.url), `Book.url on /book/${slug}`).toBe(canonical);
      expect(book["@id"], `Book.@id on /book/${slug}`).toBe(`${canonical}#book`);
      expect(String(book.description ?? ""), `Book.description on /book/${slug}`).not.toBe("");

      /* workExample is the download promise in machine-readable form, and
         .btn-download is the only element in the codebase that offers one (the
         idle button before the wait, the real link after it). They must agree:
         a claimed EBook with no visible download is a rich-result violation,
         and a rights-gated page that claims one is a legal problem. */
      const workExample = book.workExample as JsonLdNode | undefined;
      const ctaCount = await page.locator("a.btn-download, button.btn-download").count();
      if (workExample) {
        expect(ctaCount, `/book/${slug} claims a download but shows none`).toBeGreaterThan(0);
        const action = workExample.potentialAction as JsonLdNode;
        expect(String(action.target), `ReadAction target on /book/${slug}`).toMatch(
          /^https?:\/\//,
        );
        expect(workExample.isAccessibleForFree).toBe(true);
      } else {
        expect(ctaCount, `/book/${slug} shows a download it does not claim`).toBe(0);
      }

      /* aggregateRating must be visible where Google can see it. The implication
         runs one way only, on purpose: stars appear as soon as one review is
         approved, while the aggregate is withheld until there are enough of
         them, so a visible rating without a claim is the intended state. */
      const rating = book.aggregateRating as JsonLdNode | undefined;
      if (rating) {
        const value = Number(rating.ratingValue);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
        expect(Number(rating.ratingCount)).toBeGreaterThan(0);
        // RatingStars prints the same number in Bengali numerals to one place.
        expect(visible, `aggregateRating ${value} is not shown on /book/${slug}`).toContain(
          toBengaliNumerals(value.toFixed(1)),
        );
      }

      // Every breadcrumb name is text the reader can actually read.
      const crumbs = nodeOfType(nodes, "BreadcrumbList");
      expect(crumbs, `/book/${slug} emits no BreadcrumbList`).toBeTruthy();
      for (const item of (crumbs?.itemListElement ?? []) as JsonLdNode[]) {
        expect(visible, `crumb "${String(item.name)}" is not visible on /book/${slug}`).toContain(
          String(item.name),
        );
      }
    }
  });
});

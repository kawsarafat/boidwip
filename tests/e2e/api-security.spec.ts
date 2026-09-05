import { expect, test } from "@playwright/test";

/** The security invariants of the public API surface (audit #3, #5, #6, #9, #10).
 *
 *  Every one of these was a real finding, and every one is invisible to a
 *  browser-driven test: they are properties of what `/api/...` returns to a
 *  client with no cookie, which is the client an attacker uses. Payload mounts
 *  REST for every collection at /api, so an access rule is a live control on a
 *  public surface — these tests are what stop a future collection edit from
 *  quietly reopening one.
 *
 *  DATA-DRIVEN ON PURPOSE. Nothing here hard-codes a book slug: the specs read
 *  the catalogue from the API and assert invariants over whatever is there, so
 *  they are meaningful against the seeded CI database and against a real
 *  deployment. Where an invariant needs content that may not exist (a Tier D
 *  book, a book with chapters), the test skips with a reason rather than passing
 *  vacuously — a green tick that asserted nothing is worse than a skip.
 *
 *  WRITES are gated: the one test that submits a review runs against a local
 *  build (its own throwaway database) or when E2E_ALLOW_WRITES=1 is set
 *  explicitly, so pointing the suite at production does not queue moderation
 *  work for somebody. */

const ALLOW_WRITES = !process.env.E2E_BASE_URL || process.env.E2E_ALLOW_WRITES === "1";

type Doc = Record<string, unknown>;
type Listing = { docs?: Doc[]; totalDocs?: number };

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

/** Every object key anywhere in a parsed response, at any nesting depth.
 *
 *  Field-level access has to be asserted on KEYS, not on a substring of the
 *  response body, and the difference is not pedantry in either direction:
 *
 *  - A substring search false-positives. `not.toContain("hash")` fails on the
 *    category slug `oitihashik-uponnash`, and `not.toContain("rightsEvidence")`
 *    fails on a document whose evidence array is empty — the field NAME is
 *    schema shape, discoverable from any Payload install, while the rows inside
 *    it are a third party's personal data. The old assertion tested the wrong
 *    one of those and went red over a response that leaked nothing.
 *  - A top-level key check false-negatives. A user document populated through
 *    `depth` arrives nested, so `hash` and `salt` would never appear as keys of
 *    a book. Hence the recursive walk. */
const allKeys = (value: unknown, into: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key);
      allKeys(nested, into);
    }
  }
  return into;
};

test.describe("public REST API", () => {
  test("anonymous reads never include a draft", async ({ request }) => {
    // publishedOrAuthenticated returns a WHERE clause, not a UI filter: it is
    // merged into every read, so even a hand-crafted query for drafts comes
    // back empty rather than enumerating unpublished work.
    for (const collection of ["books", "book-chapters", "blog-posts", "pages"]) {
      const res = await request.get(`/api/${collection}?limit=100&depth=0`);
      expect(res.ok(), `${collection} should be publicly readable`).toBeTruthy();
      const { docs = [] } = (await res.json()) as Listing;
      for (const doc of docs) {
        expect(doc._status, `${collection}/${asString(doc.slug)}`).toBe("published");
      }

      // Asking for drafts directly, both ways Payload offers.
      const asked = await request.get(
        `/api/${collection}?limit=100&depth=0&where[_status][equals]=draft`,
      );
      expect(((await asked.json()) as Listing).docs ?? []).toHaveLength(0);

      const draftMode = await request.get(`/api/${collection}?limit=100&depth=0&draft=true`);
      for (const doc of ((await draftMode.json()) as Listing).docs ?? []) {
        expect(doc._status).toBe("published");
      }
    }
  });

  test("permission evidence is never served to an anonymous client", async ({ request }) => {
    // The most sensitive block in the schema: a rights holder's name, their
    // email text and the signed permission document — third-party personal
    // data on an otherwise public document. admin.condition hides it in the
    // editing UI only; field-level read access is what removes it here.
    const res = await request.get("/api/books?limit=100&depth=2");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Listing;
    const keys = allKeys(body);

    // Not one of these has an innocent reason to appear anywhere in a books
    // response, at any depth. `hash` and `salt` would arrive on a user document
    // populated through rightsReviewedBy; the rest are the value-bearing halves
    // of the evidence array.
    for (const field of [
      "rightsBasis",
      "rightsReviewedBy",
      "takedownStatus",
      "emailText",
      "contact",
      "hash",
      "salt",
    ]) {
      expect([...keys], `${field} must not be served to an anonymous client`).not.toContain(field);
    }

    // The array itself: Payload leaves a denied array field as an empty array
    // rather than deleting the key, so what is asserted is that it carries no
    // ROWS. An empty array is exactly as informative as a missing one.
    for (const doc of body.docs ?? []) {
      expect(doc.rightsEvidence ?? [], `evidence rows on ${asString(doc.slug)}`).toEqual([]);
    }

    // The private bucket's collection is closed outright, so even a guessed
    // filename cannot be listed.
    const evidence = await request.get("/api/evidence-files?limit=1");
    expect([401, 403]).toContain(evidence.status());

    const users = await request.get("/api/users?limit=1");
    expect([401, 403]).toContain(users.status());
  });

  test("a permitted-tier book's evidence rows are withheld", async ({ request }) => {
    /* The check above is only as strong as the dataset: a catalogue of nothing
       but public-domain books has empty evidence arrays whether the access rule
       works or not, and asserting `[] === []` proves nothing. `permitted` is the
       one tier that HAS evidence, so it gets its own test that skips with a
       reason rather than passing vacuously — the policy stated at the top of
       this file, applied to the invariant that matters most. */
    const res = await request.get(
      "/api/books?limit=100&depth=2&where[rightsTier][equals]=permitted",
    );
    expect(res.ok()).toBeTruthy();
    const docs = ((await res.json()) as Listing).docs ?? [];
    test.skip(docs.length === 0, "no permitted-tier book in this dataset");

    for (const doc of docs) {
      const where = `${asString(doc.slug)} (permitted)`;
      // Every sub-field of the array carries its own read rule, so nothing
      // survives even if a future Payload leaves the parent array populated.
      expect(doc.rightsEvidence ?? [], `${where} served evidence rows`).toEqual([]);
      expect([...allKeys(doc)], where).not.toContain("emailText");
      expect([...allKeys(doc)], where).not.toContain("contact");
    }
  });

  test("anonymous clients cannot create a review through generic REST", async ({ request }) => {
    // The collection's `create` is closed precisely so a script cannot POST
    // status:"approved", rating:5 and launder itself into the JSON-LD
    // aggregateRating. The /submit endpoint is the sole sanctioned writer.
    const res = await request.post("/api/reviews", {
      data: {
        authorName: "e2e-generic-rest",
        rating: 5,
        body: "This should never be accepted through the generic endpoint.",
        status: "approved",
      },
    });
    expect([401, 403]).toContain(res.status());

    const listed = await request.get("/api/reviews?limit=100&depth=0");
    for (const doc of ((await listed.json()) as Listing).docs ?? []) {
      // Read access returns approved-only for anonymous requests, so a pending
      // or spam row is not enumerable either.
      expect(doc.status).toBe("approved");
      // authorEmail and ipHash are stripped by field-level access.
      expect(doc.authorEmail).toBeUndefined();
      expect(doc.ipHash).toBeUndefined();
    }
  });

  test("the submit endpoint forces pending", async ({ request }) => {
    test.skip(!ALLOW_WRITES, "writes disabled — set E2E_ALLOW_WRITES=1 to run");

    const books = await request.get(
      "/api/books?limit=1&depth=0&where[_status][equals]=published",
    );
    const book = ((await books.json()) as Listing).docs?.[0];
    test.skip(!book, "no published book to review");
    const slug = asString(book?.slug);

    const marker = `e2e-pending-${Date.now()}`;
    const res = await request.post("/api/reviews/submit", {
      data: {
        bookSlug: slug,
        authorName: marker,
        rating: 4,
        body: "A submitted review must land in the moderation queue, never live.",
      },
    });

    // 403 = Turnstile is configured on this deployment and a browserless POST
    // cannot mint a token; 429 = this IP already used its allowance (a retry of
    // this very test will do that). Neither is a failure of the invariant.
    test.skip(res.status() === 403, "Turnstile enabled — cannot submit without a token");
    test.skip(res.status() === 429, "rate limited — the allowance is per IP per window");
    expect(res.ok(), await res.text()).toBeTruthy();

    // The row exists, but nothing public can see it: status was forced server
    // side, and anonymous read is approved-only.
    const listed = await request.get(
      `/api/reviews?limit=100&depth=0&where[authorName][equals]=${encodeURIComponent(marker)}`,
    );
    expect(((await listed.json()) as Listing).docs ?? []).toHaveLength(0);
  });
});

test.describe("rights tiers over the wire (#6)", () => {
  test("an in-copyright book carries no file and no chapters", async ({ request }) => {
    // The legal invariant, asserted where it actually matters. The CMS refuses
    // to publish such a book, but validation only runs on the write path: an
    // import, a migration or a reclassification can produce a row that never
    // passed it. This is the read-side check on live data.
    const res = await request.get(
      "/api/books?limit=100&depth=0&where[rightsTier][equals]=in-copyright",
    );
    expect(res.ok()).toBeTruthy();
    const docs = ((await res.json()) as Listing).docs ?? [];
    test.skip(docs.length === 0, "no in-copyright book in this dataset");

    for (const book of docs) {
      const where = `${asString(book.slug)} (in-copyright)`;
      expect(book.pdf ?? null, `${where} must have no uploaded PDF`).toBeNull();
      expect(book.pdfExternalUrl ?? null, `${where} must have no external PDF`).toBeNull();
      expect(book.epub ?? null, `${where} must have no EPUB`).toBeNull();

      const chapters = await request.get(
        `/api/book-chapters?limit=1&depth=0&where[book][equals]=${String(book.id)}`,
      );
      const { totalDocs = 0 } = (await chapters.json()) as Listing;
      expect(totalDocs, `${where} must have no online chapters`).toBe(0);
    }
  });

  test("only a reading tier has chapters", async ({ request }) => {
    // tierAllowsOnlineReading is stricter than tierAllowsDelivery: `permitted`
    // means the rights holder allowed a PDF, which is not permission to
    // republish the work as indexable HTML on our own domain. The unit suite
    // proves the function; this proves the database agrees with it.
    const res = await request.get("/api/book-chapters?limit=100&depth=1");
    expect(res.ok()).toBeTruthy();
    const chapters = ((await res.json()) as Listing).docs ?? [];
    test.skip(chapters.length === 0, "no chapters in this dataset");

    // depth=1 populates `book` only when the book itself is readable; an
    // unreadable parent comes back as a bare id. Assert over the populated
    // ones and require that there was at least one, so a dataset where nothing
    // populated reports a skip instead of a pass.
    const withBook = chapters.filter((chapter) => typeof chapter.book === "object");
    test.skip(withBook.length === 0, "no chapter has a publicly readable book");

    for (const chapter of withBook) {
      const book = (chapter.book ?? {}) as Doc;
      expect(
        ["public-domain", "open-licence"],
        `chapter ${asString(chapter.slug)} belongs to a non-reading tier`,
      ).toContain(asString(book.rightsTier));
    }
  });
});

test.describe("chapter lookup is scoped to its book (#5)", () => {
  test("a chapter slug does not resolve under a different book", async ({ request }) => {
    // Chapter slugs are unique WITHIN a book by design (compound unique index),
    // so "porichchhed-1" legitimately exists under several books. A lookup by
    // slug alone therefore returns whichever row the database happened to order
    // first — the wrong chapter, or a 404 for one that exists. The fix queries
    // both identifiers; this is the observable consequence.
    const res = await request.get("/api/book-chapters?limit=200&depth=1");
    expect(res.ok()).toBeTruthy();

    // Group the seeded chapters by their book so we can borrow one book's slug
    // and try it against another. Two books each holding a chapter is all the
    // fixture we need, and it has to come from live data: nothing here may
    // assume a particular title exists.
    const byBook = new Map<string, string[]>();
    for (const chapter of ((await res.json()) as Listing).docs ?? []) {
      const bookSlug = asString((chapter.book as Doc | undefined)?.slug);
      const chapterSlug = asString(chapter.slug);
      if (!bookSlug || !chapterSlug) continue;
      byBook.set(bookSlug, [...(byBook.get(bookSlug) ?? []), chapterSlug]);
    }

    const readable = [...byBook.entries()];
    test.skip(readable.length < 2, "need two books with chapters to cross them");

    const [[bookA, chaptersA], [bookB, chaptersB]] = readable;
    const borrowed = chaptersA.find((slug) => !chaptersB.includes(slug));
    test.skip(!borrowed, "the two books share every chapter slug");

    // The positive case first, so a 404 below cannot be explained away by the
    // reader route being missing altogether.
    const own = await request.get(`/book/${bookA}/read/${borrowed}`);
    expect(own.status(), `/book/${bookA}/read/${borrowed} should render`).toBe(200);

    const crossed = await request.get(`/book/${bookB}/read/${borrowed}`);
    expect(crossed.status(), `/book/${bookB}/read/${borrowed} must not resolve`).toBe(404);
  });
});

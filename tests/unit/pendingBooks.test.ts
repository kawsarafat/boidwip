import { describe, expect, it } from "vitest";
import type { Book } from "@/payload-types";
import { toPendingBookSummary } from "@/lib/render";
import { DEFAULT_COVER_IMAGE, countFreePdfs, relationshipId } from "@/lib/types";

/** Item 4's two pure pieces: the relationship-id narrowing every builder shares,
 *  and the projection that turns a title-only DRAFT book into the same
 *  BookSummary a live one renders as.
 *
 *  WHY THESE TWO ARE WORTH A TEST when the code around them is not. Both fail
 *  silently and in public. `relationshipId` reads a field that arrives as a bare
 *  number from one caller and as a populated document from another — verified
 *  against the real database, not inferred — and a version that handles only one
 *  of the two shapes drops every entry from a published তালিকা rather than
 *  erroring anywhere a test would see. `toPendingBookSummary` decides what a
 *  draft's MISSING fields render as, and one of those decisions is load-bearing:
 *  countFreePdfs() reads `rightsTier` to decide whether a page TITLE promises a
 *  free PDF, so a draft whose tier nobody has chosen must never read as
 *  downloadable. */

/** payload-types describes a PUBLISHED book, where `slug` and `rightsTier` are
 *  required strings. A draft has neither: Payload skips all field validation on a
 *  draft write, and a title-only create really does come back with
 *  `slug: null, rightsTier: null` (verified against the live database). The cast
 *  is the honest shape here, not a shortcut around the types. */
function draftBook(overrides: Record<string, unknown> = {}): Book {
  return {
    id: 42,
    title: "খসড়া বই",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    _status: "draft",
    slug: null,
    rightsTier: null,
    authors: null,
    cover: null,
    ...overrides,
  } as unknown as Book;
}

const AUTHOR = {
  id: 1,
  name: "শরৎচন্দ্র চট্টোপাধ্যায়",
  slug: "sarat-chandra-chattopadhyay",
};

describe("relationshipId", () => {
  it("returns a depth-0 id unchanged", () => {
    // What a list hands render.ts: `entry.book` is the bare number 6.
    expect(relationshipId(6)).toBe(6);
  });

  it("reads the id out of a depth-1 populated document", () => {
    // What a blog post hands it, fetched one level deeper.
    expect(relationshipId({ id: 7, title: "দেবদাস", slug: "devdas" })).toBe(7);
  });

  it("does not use truthiness on the id", () => {
    // Postgres serials start at 1, so this is defensive rather than live — but a
    // `value || undefined` here would drop id 0 silently, which is exactly the
    // class of bug this function exists to centralise away.
    expect(relationshipId(0)).toBe(0);
    expect(relationshipId({ id: 0 })).toBe(0);
  });

  it("returns undefined for everything that is not an id", () => {
    // The null is real: Payload writes it for a relationship whose target was
    // deleted. The string is the shape a hand-written API call sends.
    for (const value of [null, undefined, "", "7", {}, { id: "7" }, { id: null }, [], true]) {
      expect(relationshipId(value)).toBeUndefined();
    }
  });
});

describe("toPendingBookSummary rights", () => {
  it("falls back to in-copyright, the one tier that forbids delivery", () => {
    expect(toPendingBookSummary(draftBook()).rightsTier).toBe("in-copyright");
  });

  it("fails closed for a tier value it does not recognise", () => {
    // A tier arriving from an import or a hand-written API call.
    for (const tier of ["", "cc-by", "PUBLIC-DOMAIN", "public domain", 3]) {
      expect(toPendingBookSummary(draftBook({ rightsTier: tier })).rightsTier).toBe(
        "in-copyright",
      );
    }
  });

  it("keeps a tier the editor did choose", () => {
    // Half-filled drafts are the normal case, not the exception: the tier may be
    // set before the synopsis is written.
    const book = toPendingBookSummary(draftBook({ rightsTier: "public-domain" }));
    expect(book.rightsTier).toBe("public-domain");
  });

  it("is never counted as a free PDF, whatever its tier says", () => {
    // THE PROPERTY THAT MATTERS. countFreePdfs feeds the curated-list and blog
    // page TITLES ("৩টি ফ্রি PDF"), so a pending row must not inflate a promise
    // the site cannot keep. It holds for the permissive tier too, because
    // `pdfUrl` is null regardless.
    const pending = [
      toPendingBookSummary(draftBook()),
      toPendingBookSummary(draftBook({ rightsTier: "public-domain" })),
    ];
    expect(countFreePdfs(pending)).toBe(0);
  });
});

describe("toPendingBookSummary projection", () => {
  it("offers nothing to click: no PDF, no buy link, no price", () => {
    const book = toPendingBookSummary(draftBook());
    expect(book.pdfUrl).toBeNull();
    // A draft book's Rokomari URL and price are unreviewed by definition, and an
    // affiliate link to an unchecked URL is a trust failure, not a missed sale.
    expect(book.rokomariUrl).toBeNull();
    expect(book.priceTaka).toBeNull();
    expect(book.priceCheckedAt).toBeNull();
  });

  it("reports no rating rather than a zero one", () => {
    // Already true: reviews attach to a published book page, and this book has
    // none to have been reviewed on.
    const book = toPendingBookSummary(draftBook());
    expect(book.ratingAverage).toBeNull();
    expect(book.ratingCount).toBe(0);
    expect(book.featured).toBe(false);
    expect(book.summary).toBe("");
  });

  it("gives an empty slug rather than the string 'null'", () => {
    // Nothing links to it — the `pending` flag is what stops that — but "null" in
    // an href would 404 loudly instead of quietly.
    expect(toPendingBookSummary(draftBook()).slug).toBe("");
    expect(toPendingBookSummary(draftBook({ slug: "devdas" })).slug).toBe("devdas");
  });

  it("keeps the title and drops a missing titleLatin to null", () => {
    expect(toPendingBookSummary(draftBook()).title).toBe("খসড়া বই");
    expect(toPendingBookSummary(draftBook()).titleLatin).toBeNull();
    expect(toPendingBookSummary(draftBook({ titleLatin: "Khosra Boi" })).titleLatin).toBe(
      "Khosra Boi",
    );
  });
});

describe("toPendingBookSummary authors and cover", () => {
  it("keeps a populated author as a slug/name pair", () => {
    // depth 1 populates `authors` even alongside `select` — verified against the
    // live database, which is why the narrowing lives here and not in the query.
    expect(toPendingBookSummary(draftBook({ authors: [AUTHOR] })).authors).toEqual([
      { slug: AUTHOR.slug, name: AUTHOR.name },
    ]);
  });

  it("drops an author it cannot link or name", () => {
    // A bare id (a depth change), an author with no slug (itself a draft), and one
    // with no name. Each would render as a link to nowhere or as blank text.
    for (const authors of [[3], [{ id: 5, name: "নাম", slug: "" }], [{ id: 6, slug: "s" }]]) {
      expect(toPendingBookSummary(draftBook({ authors })).authors).toEqual([]);
    }
  });

  it("handles a draft with no authors at all", () => {
    expect(toPendingBookSummary(draftBook()).authors).toEqual([]);
    expect(toPendingBookSummary(draftBook({ authors: [] })).authors).toEqual([]);
  });

  it("uses the uploaded cover, and the placeholder when there is none", () => {
    // BookSummary.coverImage is non-nullable, and CoverImage requires a string —
    // so "no cover yet" has to resolve to the placeholder here rather than at the
    // render site.
    const withCover = draftBook({ cover: { id: 9, url: "/api/media/file/cover.jpg" } });
    expect(toPendingBookSummary(withCover).coverImage).toBe("/api/media/file/cover.jpg");
    expect(toPendingBookSummary(draftBook()).coverImage).toBe(DEFAULT_COVER_IMAGE);
    // An upload row that exists but has no URL yet.
    const emptyUpload = draftBook({ cover: { id: 9, url: null } });
    expect(toPendingBookSummary(emptyUpload).coverImage).toBe(DEFAULT_COVER_IMAGE);
  });

  it("always produces an ISO publishDate, falling back to updatedAt", () => {
    // Callers sort and format this; `new Date(undefined)` would give "Invalid
    // Date" and throw on toISOString.
    expect(toPendingBookSummary(draftBook({ publishDate: "2026-03-04T05:06:07.000Z" })).publishDate)
      .toBe("2026-03-04T05:06:07.000Z");
    expect(toPendingBookSummary(draftBook()).publishDate).toBe("2026-02-01T00:00:00.000Z");
    expect(() => toPendingBookSummary(draftBook({ updatedAt: null }))).not.toThrow();
  });
});

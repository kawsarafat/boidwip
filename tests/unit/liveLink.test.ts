import { describe, expect, it } from "vitest";
import { liveLinkState } from "@/lib/liveLink";

/** The admin's Live column, tested here rather than in a browser because one of
 *  its five answers is unreachable from real data without writing a future-dated
 *  document into the production database to look at a pill. */

const NOW = Date.parse("2026-09-05T12:00:00.000Z");
const FUTURE = "2026-10-05T12:00:00.000Z";
const PAST = "2026-08-05T12:00:00.000Z";

describe("liveLinkState", () => {
  it("links a published document to its public path", () => {
    const s = liveLinkState({ slug: "devdas", _status: "published", publishDate: PAST }, "books", NOW);
    expect(s.kind).toBe("live");
    expect(s.kind === "live" && s.href).toBe("/book/devdas");
  });

  it("links a document from a collection with no draft state", () => {
    // No `_status` at all: authors, publishers, categories, series.
    const s = liveLinkState({ slug: "rabindranath-tagore" }, "authors", NOW);
    expect(s.kind).toBe("live");
    expect(s.kind === "live" && s.href).toBe("/author/rabindranath-tagore");
  });

  it("offers a preview link for a draft in a previewable collection", () => {
    for (const collection of ["books", "pages"]) {
      const s = liveLinkState({ id: 4, slug: "x", _status: "draft" }, collection, NOW);
      expect(s.kind).toBe("preview");
      expect(s.kind === "preview" && s.href).toBe(`/preview?collection=${collection}&id=4`);
    }
  });

  it("labels a draft that has no preview route", () => {
    for (const collection of ["lists", "blog-posts"]) {
      expect(liveLinkState({ id: 3, slug: "x", _status: "draft" }, collection, NOW).kind).toBe("draft");
    }
  });

  it("falls back to the draft label when a previewable draft has no id", () => {
    expect(liveLinkState({ slug: "x", _status: "draft" }, "books", NOW).kind).toBe("draft");
  });

  it("labels a published document dated in the future as scheduled", () => {
    const s = liveLinkState({ slug: "x", _status: "published", publishDate: FUTURE }, "books", NOW);
    expect(s.kind).toBe("scheduled");
  });

  it("treats the publish moment itself as live, not scheduled", () => {
    const at = new Date(NOW).toISOString();
    expect(liveLinkState({ slug: "x", _status: "published", publishDate: at }, "books", NOW).kind).toBe("live");
  });

  it("ignores a publishDate that is not a parseable date", () => {
    for (const publishDate of ["", "soon", null, 20261005, {}]) {
      expect(liveLinkState({ slug: "x", _status: "published", publishDate }, "books", NOW).kind).toBe("live");
    }
  });

  it("offers nothing without a usable slug", () => {
    for (const slug of [undefined, null, "", 42, "Not A Slug", "বাংলা"]) {
      const s = liveLinkState({ slug, _status: "published" }, "books", NOW);
      expect(s.kind).toBe("none");
    }
  });

  it("offers nothing for a collection with no public page", () => {
    // Chapters are absent from COLLECTION_URL_PREFIXES on purpose: the URL needs
    // the parent book's slug, which the row does not carry.
    expect(liveLinkState({ slug: "devdas-porichchhed-1" }, "book-chapters", NOW).kind).toBe("none");
    expect(liveLinkState({ slug: "x" }, "media", NOW).kind).toBe("none");
    expect(liveLinkState({ slug: "x" }, undefined, NOW).kind).toBe("none");
  });

  it("survives a row stripped down to nothing", () => {
    // What `admin.enableListViewSelectAPI` would do to every row if it were ever
    // switched on: degrade to the dash, not throw.
    expect(liveLinkState({}, "books", NOW).kind).toBe("none");
    expect(liveLinkState(null, "books", NOW).kind).toBe("none");
    expect(liveLinkState(undefined, "books", NOW).kind).toBe("none");
  });

  it("says the page is only as fresh as the last deployment", () => {
    const s = liveLinkState({ slug: "devdas" }, "books", NOW);
    expect(s.title).toContain("last deployment");
  });
});

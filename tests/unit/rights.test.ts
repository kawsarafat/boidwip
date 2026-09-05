import { describe, expect, it } from "vitest";
import {
  RESERVED_ROUTE_SLUGS,
  RIGHTS_TIERS,
  isReservedRouteSlug,
  isRightsTier,
  isSafeHttpUrl,
  safeJsonLd,
  tierAllowsDelivery,
  tierAllowsOnlineReading,
} from "@/lib/types";

/** The rights model (audit #6) as a truth table.
 *
 *  This is the highest-value unit test in the project: `tierAllowsDelivery` and
 *  `tierAllowsOnlineReading` are the two gates that decide whether a copyrighted
 *  work can be downloaded or republished as HTML, and they are consulted from
 *  eight places (both collections' validation, lib/data.ts, two
 *  generateStaticParams, the book page, the sitemap, the reader route). The rule
 *  they encode was previously hand-written in two places that DISAGREED — the
 *  regression this file exists to catch.
 *
 *  The distinction that must never be flattened: `permitted` (Tier C) means the
 *  rights holder allowed a PDF, which is not permission to republish the same
 *  work as indexable chapters on our own domain. So delivery yes, reader no. */

describe("tier gates", () => {
  it("allows delivery for A, B and C but not for in-copyright", () => {
    expect(tierAllowsDelivery("public-domain")).toBe(true);
    expect(tierAllowsDelivery("open-licence")).toBe(true);
    expect(tierAllowsDelivery("permitted")).toBe(true);
    expect(tierAllowsDelivery("in-copyright")).toBe(false);
  });

  it("allows online reading only for A and B", () => {
    expect(tierAllowsOnlineReading("public-domain")).toBe(true);
    expect(tierAllowsOnlineReading("open-licence")).toBe(true);
    // The whole point of the second function.
    expect(tierAllowsOnlineReading("permitted")).toBe(false);
    expect(tierAllowsOnlineReading("in-copyright")).toBe(false);
  });

  it("keeps reading a strict subset of delivery", () => {
    // If this ever inverts for some tier, one of the two gates has been edited
    // without the other.
    for (const tier of RIGHTS_TIERS) {
      if (tierAllowsOnlineReading(tier)) expect(tierAllowsDelivery(tier)).toBe(true);
    }
  });

  it("fails closed for anything unrecognized", () => {
    // An unknown tier arriving from an import or a hand-written API call must
    // read as in-copyright, not as "not in-copyright, so fine".
    for (const value of ["", "PUBLIC-DOMAIN", "public domain", "cc-by", "unknown", "null"]) {
      expect(tierAllowsDelivery(value)).toBe(false);
      expect(tierAllowsOnlineReading(value)).toBe(false);
    }
  });

  it("narrows only real tiers with isRightsTier", () => {
    for (const tier of RIGHTS_TIERS) expect(isRightsTier(tier)).toBe(true);
    for (const value of [undefined, null, 0, {}, "Permitted", "in copyright"]) {
      expect(isRightsTier(value)).toBe(false);
    }
  });
});

describe("isReservedRouteSlug", () => {
  it("reserves every app namespace, so a Page can never shadow a route", () => {
    // A static segment always beats [slug] in Next's matcher: a Page saved at
    // one of these slugs would appear in the sitemap and render the route's own
    // page forever.
    for (const slug of ["book", "author", "category", "search", "blog", "admin", "api", "preview"]) {
      expect(isReservedRouteSlug(slug)).toBe(true);
    }
  });

  it("reserves the well-known files", () => {
    for (const slug of ["sitemap.xml", "robots.txt", "rss.xml", "favicon.ico"]) {
      expect(isReservedRouteSlug(slug)).toBe(true);
    }
  });

  it("leaves real page slugs alone", () => {
    for (const slug of ["about", "contact", "privacy-policy", "dmca", "boi"]) {
      expect(isReservedRouteSlug(slug)).toBe(false);
    }
  });

  it("has no duplicate entries", () => {
    expect(new Set(RESERVED_ROUTE_SLUGS).size).toBe(RESERVED_ROUTE_SLUGS.length);
  });
});

describe("isSafeHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(isSafeHttpUrl("https://www.rokomari.com/book/1336/shunno")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects the schemes that would execute or leak", () => {
    // React does not sanitize href, and these reach the CMS by hand-paste.
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
      "/relative/path",
      "www.rokomari.com",
      "",
    ]) {
      expect(isSafeHttpUrl(url)).toBe(false);
    }
  });
});

describe("safeJsonLd", () => {
  it("escapes every < so a title can never close the script tag", () => {
    const out = safeJsonLd({ name: "</script><img src=x onerror=alert(1)>" });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c");
  });

  it("still parses back to the same data", () => {
    // The escape is inert inside JSON — that is why it is safe to apply
    // unconditionally.
    const data = { name: "শেষের কবিতা", note: "a < b && c > d", n: 1971 };
    expect(JSON.parse(safeJsonLd(data))).toEqual(data);
  });
});

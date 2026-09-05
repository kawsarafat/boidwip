import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_REL,
  PRICE_FRESH_DAYS,
  affiliateConfigured,
  buyUrl,
  isPriceFresh,
} from "@/lib/affiliate";
import { formatBengaliDate, formatTaka, toBengaliNumerals } from "@/lib/numerals";

/** The revenue layer and the render boundary.
 *
 *  `buyUrl` is where a hand-pasted CMS value becomes an href, so its job is as
 *  much sanitization as decoration: an unsafe or non-Rokomari URL must never
 *  come back decorated with our affiliate id, and an unparseable one must come
 *  back null so the caller renders no button at all.
 *
 *  `isPriceFresh` fails closed by design — a stale ৳ figure that disagrees with
 *  Rokomari's live page reads as a bait-and-switch. Time is faked rather than
 *  computed from Date.now() in the assertion, so the boundary is exact. */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("buyUrl", () => {
  it("appends the configured affiliate params to a Rokomari link", () => {
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID", "boidwip");
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_AFFS", "1234");
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_CMA", "604800");

    const url = new URL(buyUrl("https://www.rokomari.com/book/1336/shunno")!);
    expect(url.searchParams.get("affId")).toBe("boidwip");
    expect(url.searchParams.get("affs")).toBe("1234");
    expect(url.searchParams.get("cma")).toBe("604800");
    expect(url.pathname).toBe("/book/1336/shunno");
  });

  it("keeps existing query params and overwrites only our own", () => {
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID", "boidwip");
    // env is the single source of truth for affId; anything else survives.
    const url = new URL(buyUrl("https://www.rokomari.com/book/1336/x?ref=fb&affId=stale")!);
    expect(url.searchParams.get("ref")).toBe("fb");
    expect(url.searchParams.get("affId")).toBe("boidwip");
  });

  it("degrades to a plain link when no affiliate id is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID", "");
    expect(buyUrl("https://www.rokomari.com/book/1336/shunno")).toBe(
      "https://www.rokomari.com/book/1336/shunno",
    );
    expect(affiliateConfigured()).toBe(false);
  });

  it("does not decorate non-Rokomari hosts", () => {
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID", "boidwip");
    // A publisher's own shop must not receive foreign tracking params.
    expect(buyUrl("https://example.com/shop/boi")).toBe("https://example.com/shop/boi");
    // …and a lookalike host is not Rokomari either.
    expect(buyUrl("https://rokomari.com.evil.test/book/1")).toBe(
      "https://rokomari.com.evil.test/book/1",
    );
  });

  it("decorates a Rokomari subdomain", () => {
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID", "boidwip");
    expect(buyUrl("https://beta.rokomari.com/book/1")).toContain("affId=boidwip");
  });

  it("returns null for missing or unsafe input", () => {
    vi.stubEnv("NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID", "boidwip");
    for (const value of [null, undefined, "", "javascript:alert(1)", "not a url", "/book/1"]) {
      expect(buyUrl(value)).toBeNull();
    }
  });

  it("names the rel attribute in one place", () => {
    // Google requires `sponsored` on paid links; `noopener` because they open
    // in a new tab.
    expect(AFFILIATE_REL.split(" ").sort()).toEqual(["nofollow", "noopener", "sponsored"]);
  });
});

describe("isPriceFresh", () => {
  it("shows a price inside the window and hides it after", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

    expect(isPriceFresh(daysAgo(0))).toBe(true);
    expect(isPriceFresh(daysAgo(PRICE_FRESH_DAYS - 1))).toBe(true);
    expect(isPriceFresh(daysAgo(PRICE_FRESH_DAYS))).toBe(false);
    expect(isPriceFresh(daysAgo(PRICE_FRESH_DAYS + 30))).toBe(false);
  });

  it("fails closed on a missing or unparseable date", () => {
    for (const value of [null, undefined, "", "someday", "not-a-date"]) {
      expect(isPriceFresh(value)).toBe(false);
    }
  });
});

describe("numerals", () => {
  it("converts ASCII digits and passes everything else through", () => {
    expect(toBengaliNumerals(1971)).toBe("১৯৭১");
    expect(toBengaliNumerals("৳ 250.50")).toBe("৳ ২৫০.৫০");
    expect(toBengaliNumerals("PDF")).toBe("PDF");
    expect(toBengaliNumerals(0)).toBe("০");
  });

  it("formats whole taka", () => {
    expect(formatTaka(250)).toBe("৳২৫০");
    // Rokomari list prices are integers; false precision looks wrong.
    expect(formatTaka(249.6)).toBe("৳২৫০");
  });

  it("formats a date in Bengali and returns empty for garbage", () => {
    // Intl output shifts between ICU versions, so assert the two properties
    // that are the point — Bengali digits and a Bengali month name — by code
    // point range rather than pinning the exact string.
    const hasCodePointIn = (text: string, lo: number, hi: number): boolean =>
      Array.from(text).some((ch) => {
        const cp = ch.codePointAt(0) ?? 0;
        return cp >= lo && cp <= hi;
      });

    const formatted = formatBengaliDate("2024-01-12T00:00:00.000Z");
    expect(hasCodePointIn(formatted, 0x09e6, 0x09ef)).toBe(true); // Bengali digits
    expect(hasCodePointIn(formatted, 0x0980, 0x09e5)).toBe(true); // Bengali letters
    expect(hasCodePointIn(formatted, 0x0030, 0x0039)).toBe(false); // no ASCII digits
    expect(formatBengaliDate("not-a-date")).toBe("");
  });
});

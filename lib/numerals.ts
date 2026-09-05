/** Bengali numeral rendering.
 *
 *  THE ONE RULE: conversion happens at the RENDER BOUNDARY only. Everything
 *  stored, computed, sorted, or compared stays ASCII digits — page counts,
 *  prices, ratings, years, chapter numbers. A "১৯৯৮" that leaked into the
 *  database would break numeric sorting, range queries, and JSON-LD (which
 *  must carry machine-readable values). So this function is called in JSX at
 *  the last possible moment, never in lib/data.ts, never in a hook, never in
 *  anything that writes.
 *
 *  JSON-LD is the deliberate exception in the other direction: schema.org
 *  consumers want "1998" and "250", so structured data NEVER goes through
 *  this function even when the visible text next to it does. */

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

/** Convert every ASCII digit in the input to its Bengali equivalent.
 *  Non-digit characters (separators, currency signs, decimal points) pass
 *  through untouched, so `toBengaliNumerals("৳ 250.50")` → `"৳ ২৫০.৫০"`.
 *  Accepts numbers for convenience at call sites (`toBengaliNumerals(book.pageCount)`). */
export function toBengaliNumerals(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BENGALI_DIGITS[Number(d)]);
}

/** Format a date in Bengali for visible UI ("১২ জানুয়ারি ২০২৪").
 *  Uses Intl's bn-BD locale, which handles month names, then the numerals are
 *  already Bengali via the locale's own numbering system. JSON-LD dates must
 *  NOT use this — they stay ISO 8601. */
export function formatBengaliDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Format a Taka price for visible UI: "৳২৫০". Whole-taka values only —
 *  Rokomari list prices are integers, and false precision looks wrong. */
export function formatTaka(amount: number): string {
  return `৳${toBengaliNumerals(Math.round(amount))}`;
}

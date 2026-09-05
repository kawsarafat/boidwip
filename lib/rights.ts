/** Deterministic copyright arithmetic for Bangladesh.
 *
 *  Bangladesh's Copyright Act protects a literary work for the author's life
 *  plus 60 YEARS, counted from the beginning of the calendar year FOLLOWING
 *  the author's death. So a work enters the public domain on 1 January of
 *  (deathYear + 61); equivalently, it is public domain in year Y when
 *  deathYear + 60 < Y.
 *
 *  Worked examples (the test-case table this module is written against):
 *    Rabindranath Thakur   died 1941 → protected through end of 2001 → PD since 2002 ✔
 *    Kazi Nazrul Islam     died 1976 → protected through end of 2036 → in copyright until 1 Jan 2037
 *    Sarat Chandra         died 1938 → PD since 1999 ✔
 *    Jibanananda Das       died 1954 → PD since 2015 ✔
 *    Humayun Ahmed         died 2012 → in copyright until 1 Jan 2073
 *    Bibhutibhushan        died 1950 → PD since 2011 ✔
 *
 *  WHY THIS IS CODE AND NOT AI. The four-tier rights model is the site's
 *  single biggest legal exposure, and the AI-assist layer (later phase) must
 *  NEVER be the thing that decides a tier. AI drafts prose; THIS module does
 *  the arithmetic; a human editor confirms. Joint authorship, posthumous
 *  publication, translations (translator holds a separate copyright!), and
 *  foreign works under different terms are all real complications — which is
 *  why the functions here return advisory results with reasons, and the
 *  Books collection stores an explicit `rightsTier` an editor set, not a
 *  computed one.
 */

import type { RightsTier } from "./types";

/** Bangladesh: life + 60 years, from the year following death. */
export const COPYRIGHT_TERM_YEARS = 60;

/** Is a work by an author who died in `deathYear` in the public domain in
 *  Bangladesh during `inYear` (default: now)? Pure arithmetic, no rounding
 *  tricks: deathYear + 60 < inYear.
 *
 *  Returns false for a missing/invalid deathYear — "we don't know" must never
 *  read as "it's free". A living author (no deathYear) is always protected. */
export function isPublicDomainBD(
  deathYear: number | null | undefined,
  inYear: number = new Date().getFullYear(),
): boolean {
  if (typeof deathYear !== "number" || !Number.isInteger(deathYear)) return false;
  if (deathYear < 1000 || deathYear > inYear) return false;
  return deathYear + COPYRIGHT_TERM_YEARS < inYear;
}

/** First calendar year in which the author's works are public domain in
 *  Bangladesh, or null if deathYear is unknown/invalid. */
export function publicDomainFromYear(deathYear: number | null | undefined): number | null {
  if (typeof deathYear !== "number" || !Number.isInteger(deathYear) || deathYear < 1000) {
    return null;
  }
  return deathYear + COPYRIGHT_TERM_YEARS + 1;
}

export interface RightsAdvice {
  /** The tier the arithmetic suggests. ADVISORY — an editor confirms. */
  suggestedTier: RightsTier;
  /** Human-readable Bengali reason shown in the admin sidebar. */
  reason: string;
  /** True when the suggestion is safe to trust mechanically (single author,
   *  known death year, comfortably past the term). False means "a human must
   *  look at this" — the admin UI renders it as a warning, not a suggestion. */
  confident: boolean;
}

/** Advise a rights tier from author death years. Used by the admin rights
 *  assistant panel; NEVER used to set the field automatically.
 *
 *  Multiple authors: copyright runs from the LAST surviving author's death,
 *  so the maximum death year governs — and if any author is living (null),
 *  the work is protected, full stop.
 *
 *  Translations are handled by the caller passing the TRANSLATOR's death year
 *  too when one exists: a public-domain original under an in-copyright
 *  translation is still in-copyright as published. */
export function adviseRightsTier(
  deathYears: Array<number | null | undefined>,
  inYear: number = new Date().getFullYear(),
): RightsAdvice {
  if (deathYears.length === 0) {
    return {
      suggestedTier: "in-copyright",
      reason: "লেখকের তথ্য নেই — নিরাপদ ধরে নেওয়া হয়েছে যে বইটি কপিরাইটের অধীনে।",
      confident: false,
    };
  }

  const hasLiving = deathYears.some(
    (y) => typeof y !== "number" || !Number.isInteger(y),
  );
  if (hasLiving) {
    return {
      suggestedTier: "in-copyright",
      reason:
        "অন্তত একজন লেখক জীবিত (বা মৃত্যুসাল অজানা) — বইটি কপিরাইটের অধীনে।",
      confident: true,
    };
  }

  const governing = Math.max(...(deathYears as number[]));
  const pdFrom = publicDomainFromYear(governing);

  if (pdFrom !== null && inYear >= pdFrom) {
    const margin = inYear - pdFrom;
    return {
      suggestedTier: "public-domain",
      reason: `সর্বশেষ লেখকের মৃত্যু ${governing} সালে — বাংলাদেশে ${pdFrom} সাল থেকে পাবলিক ডোমেইন (মৃত্যুর পর ${COPYRIGHT_TERM_YEARS} বছর)।`,
      // Freshly-expired works (within 2 years) get a human double-check:
      // death-year records for older authors are sometimes off by a year.
      confident: margin >= 2,
    };
  }

  return {
    suggestedTier: "in-copyright",
    reason: `সর্বশেষ লেখকের মৃত্যু ${governing} সালে — ${pdFrom ?? "?"} সালের ১ জানুয়ারির আগে বইটি কপিরাইটের অধীনে।`,
    confident: true,
  };
}

/** Rokomari affiliate URL construction — the site's revenue layer.
 *
 *  THE DESIGN RULE (plan §8): books store the PLAIN Rokomari product URL
 *  (e.g. https://www.rokomari.com/book/1336/shunno) and the affiliate
 *  parameters are appended HERE, at render time, from environment variables.
 *  Why: the day the affId changes, the program is renegotiated, or a second
 *  affiliate program is added, exactly one module changes — not thousands of
 *  book records. It also means a book record can never ship a stale or
 *  mistyped affiliate id.
 *
 *  Link format Rokomari expects:
 *    https://www.rokomari.com/book/1336/shunno?affId=XXXX&affs=NNNN&cma=604800
 *  where cma is the cookie max-age (7-day cookie = 604800 seconds).
 *
 *  Every rendered affiliate link MUST carry rel="sponsored nofollow noopener"
 *  (Google requires `sponsored` on paid links; `noopener` because they open
 *  in a new tab). That is the component's job — see AFFILIATE_REL below,
 *  exported so no component hand-types it.
 *
 *  Click measurement is @vercel/analytics `track("buy_click", {slug, slot})`
 *  fired from the client component on click — never a /go/ redirect route,
 *  which would add latency, break right-click-copy, and look like cloaking. */

import { isSafeHttpUrl } from "./types";

/** The rel attribute every affiliate anchor must carry. */
export const AFFILIATE_REL = "sponsored nofollow noopener";

/** Where a buy link was clicked from — the analytics dimension that tells us
 *  which of the four placements earns. Fixed vocabulary, not free text. */
export type AffiliateSlot =
  | "post-download" // panel after a PDF download starts (~40% of clicks)
  | "above-fold" // buy button beside the cover on the book page
  | "end-of-page" // closing CTA after the description/review section
  | "sticky-bar" // mobile sticky bottom bar
  | "card-chip" // price chip on a book card in listings
  | "reader"; // buy prompt inside the online reader

function affiliateParams(): URLSearchParams | null {
  const affId = process.env.NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID;
  if (!affId) return null; // unset → plain links, feature degrades silently
  const params = new URLSearchParams({ affId });
  const affs = process.env.NEXT_PUBLIC_ROKOMARI_AFFILIATE_AFFS;
  if (affs) params.set("affs", affs);
  const cma = process.env.NEXT_PUBLIC_ROKOMARI_AFFILIATE_CMA;
  if (cma) params.set("cma", cma);
  return params;
}

/** Build the affiliate buy URL from a stored plain Rokomari product URL.
 *
 *  Returns null when the input is missing or unsafe — callers render no buy
 *  button at all rather than a broken one. Existing query params on the
 *  stored URL are preserved (they shouldn't exist, but a hand-pasted URL
 *  with tracking junk must not eat the affiliate params). If the stored URL
 *  somehow already carries affId/affs/cma they are OVERWRITTEN with ours:
 *  env is the single source of truth. */
export function buyUrl(rokomariUrl: string | null | undefined): string | null {
  if (!rokomariUrl || !isSafeHttpUrl(rokomariUrl)) return null;

  let url: URL;
  try {
    url = new URL(rokomariUrl);
  } catch {
    return null;
  }
  // Only decorate Rokomari links. Anything else (a publisher's own shop,
  // say) passes through untouched rather than getting foreign params.
  if (!/(^|\.)rokomari\.com$/i.test(url.hostname)) return url.toString();

  const params = affiliateParams();
  if (!params) return url.toString();
  params.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

/** True when affiliate credentials are configured — the disclosure line and
 *  "sponsored" rel only make sense when links actually carry the params. The
 *  disclosure itself renders whenever a buy link exists, configured or not,
 *  because intent to earn is what triggers the duty to disclose. */
export function affiliateConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID);
}

/** How long a hand-checked Rokomari price stays displayable. Prices are
 *  entered manually with a "checked at" date; after this window the chip
 *  renders "দাম দেখুন" instead of a number, because a stale ৳ figure that
 *  disagrees with Rokomari's live page reads as a bait-and-switch and burns
 *  exactly the trust a buy button depends on. */
export const PRICE_FRESH_DAYS = 60;

/** True while a price is recent enough to show as a number. Fails closed:
 *  a price with no checked-at date is never shown. */
export function isPriceFresh(priceCheckedAt: string | null | undefined): boolean {
  if (!priceCheckedAt) return false;
  const checked = new Date(priceCheckedAt).getTime();
  if (Number.isNaN(checked)) return false;
  return Date.now() - checked < PRICE_FRESH_DAYS * 24 * 60 * 60 * 1000;
}

/** The Bengali affiliate disclosure line, one string used everywhere so the
 *  wording never drifts between placements. Rendered near the first buy
 *  button on every page that has one. */
export const AFFILIATE_DISCLOSURE =
  "এই পেজের কেনার লিংকগুলো অ্যাফিলিয়েট লিংক। এখান থেকে বই কিনলে বইদ্বীপ একটি ছোট কমিশন পায়, আপনার দাম একই থাকে।";

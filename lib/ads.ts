/** AdSense configuration, shape-checked once instead of read raw wherever
 *  it's needed.
 *
 *  Two env vars drive the whole ad system:
 *    NEXT_PUBLIC_ADSENSE_CLIENT        "ca-pub-xxxxxxxxxxxxxxxx" (site-wide)
 *    NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT  the ad unit's numeric slot id
 *  plus optional per-placement overrides (see adSlotId). With neither set the
 *  site renders no ad markup at all — no empty boxes, no Google script.
 *
 *  The client id is interpolated into a script URL, so it is validated
 *  against the exact shape AdSense issues rather than trusted: a pasted
 *  "pub-1234" (missing prefix) or a whole <script> snippet in the variable
 *  would otherwise produce a request that 404s with nothing on the page to
 *  explain it. */

const CLIENT_RE = /^ca-pub-\d{10,20}$/;
const SLOT_RE = /^\d{5,20}$/;

export function adsenseClient(): string | null {
  const raw = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "").trim();
  return CLIENT_RE.test(raw) ? raw : null;
}

/** Where an ad unit sits. Fixed vocabulary so a typo'd placement is a type
 *  error, not a silently unfilled unit. */
export type AdPlacement =
  | "book-top" // under the book page header
  | "book-bottom" // after the review, before related books
  | "listing" // inside listing grids
  | "reader" // between reader sections
  | "download"; // beside the download wait panel

/** Per-placement slot ids, falling back to the DEFAULT unit. A manual
 *  <ins class="adsbygoogle"> WITHOUT data-ad-slot never fills — Google's
 *  script skips it silently, forever — so a placement with no resolvable
 *  slot renders nothing rather than reserving dead space. */
export function adSlotId(placement: AdPlacement): string | null {
  const key = `NEXT_PUBLIC_ADSENSE_SLOT_${placement.toUpperCase().replace(/-/g, "_")}`;
  const specific = (process.env[key] ?? "").trim();
  if (SLOT_RE.test(specific)) return specific;
  const fallback = (process.env.NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT ?? "").trim();
  return SLOT_RE.test(fallback) ? fallback : null;
}

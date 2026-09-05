"use client";

import { track } from "@vercel/analytics";
import { AFFILIATE_REL, type AffiliateSlot } from "@/lib/affiliate";
import { formatTaka } from "@/lib/numerals";

/** The Rokomari buy link — every placement of it on the site renders through
 *  this one component so the three invariants can never drift apart:
 *
 *  1. rel="sponsored nofollow noopener" on every affiliate anchor (Google
 *     requires `sponsored` on paid links; hand-typing it per call site is how
 *     one placement eventually ships without it).
 *  2. Click tracking via @vercel/analytics `track("buy_click")` with the slug
 *     and the PLACEMENT — the dimension that tells us which of the slots
 *     (above-fold / post-download / sticky-bar / …) actually earns. A plain
 *     onClick, never a /go/ redirect route: a redirect adds latency, breaks
 *     right-click-copy, and looks like cloaking to a crawler.
 *  3. The URL arrives ALREADY decorated by lib/affiliate.ts buyUrl() on the
 *     server. This component never touches env vars, so the affiliate id
 *     stays out of client-bundle string literals except inside the href
 *     itself, where it necessarily lives.
 *
 *  Client component because of the click handler; everything it receives is
 *  three strings and a number, so the flight-payload cost is trivial.
 *
 *  Callers that have no buy URL render nothing — a buy button that goes
 *  nowhere is worse than no button. That check lives at the call site (the
 *  URL is already null there), not here. */
export default function BuyButton({
  href,
  slug,
  slot,
  priceTaka,
  className,
  children,
}: {
  /** Decorated affiliate URL from buyUrl(). */
  href: string;
  /** Book slug, the analytics key. */
  slug: string;
  /** Which placement this button occupies — fixed vocabulary. */
  slot: AffiliateSlot;
  /** Fresh price to show inline, or null to omit (isPriceFresh is the
   *  caller's job — this component shows what it is given). */
  priceTaka?: number | null;
  className?: string;
  /** Override label. Default: "রকমারিতে কিনুন" (+ price when given). */
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={AFFILIATE_REL}
      onClick={() => track("buy_click", { slug, slot })}
      className={className ?? "btn-buy w-full text-base shadow-card sm:w-auto"}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M3 4h2l1.6 8.4a1.5 1.5 0 001.47 1.2h6.9a1.5 1.5 0 001.46-1.14L18 7H6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8.5" cy="16.8" r="1.2" fill="currentColor" />
        <circle cx="14.5" cy="16.8" r="1.2" fill="currentColor" />
      </svg>
      {children ?? (
        <>
          রকমারিতে কিনুন
          {typeof priceTaka === "number" && (
            <span className="font-bold">· {formatTaka(priceTaka)}</span>
          )}
        </>
      )}
    </a>
  );
}

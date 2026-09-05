"use client";

import { useEffect, useRef } from "react";
import { adSlotId, adsenseClient, type AdPlacement } from "@/lib/ads";

// Renders nothing until AdSense is actually approved and configured. Two
// variables have to be present for a position to appear, and BOTH are load-bearing:
//
//   NEXT_PUBLIC_ADSENSE_CLIENT          the publisher id, "ca-pub-xxxxxxxxxxxxxxxx"
//   NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT    the ad unit's slot id, "1234567890"
//                                       (or the per-placement variable, see lib/ads.ts)
//
// A manual <ins class="adsbygoogle"> display unit WITHOUT data-ad-slot never
// fills. Not "fills badly" — Google's script skips it, silently, forever. Every
// placement on this site was in that state: `adSlot` was an optional prop and no
// call site passed one, so six positions reserved layout height, loaded Google's
// script and could never earn a cent. Placements now name themselves and look
// their own slot id up in lib/ads.ts, so a position either has a real unit behind
// it or does not render.
//
// The reserved `minHeight` matters once a position IS configured: it claims the
// space before the ad script resolves, which is what keeps Cumulative Layout
// Shift near zero. CLS is a ranking signal and the most common way an otherwise
// fast page loses its Core Web Vitals pass. It is reserved only when a slot
// exists, so an unconfigured site has no empty gaps in its layout.
//
// WHY THIS IS A CLIENT COMPONENT rather than a server one that emits an
// inline <script>: the previous version rendered
//
//     <script dangerouslySetInnerHTML={{ __html: "(adsbygoogle = ...).push({})" }} />
//
// which is wrong in two independent ways. React does not execute an inline
// <script> it inserts during a client-side navigation, so every ad slot after
// the first page view silently never initialised — a real revenue bug, not a
// theoretical one. And it was one of the reasons script-src needed
// 'unsafe-inline': each slot injected executable inline script into the
// document. An effect does the same work, runs on client navigation as well as
// first paint, and adds no inline script to the page at all.
export default function AdSlot({
  minHeight = 250,
  placement,
  className,
}: {
  minHeight?: number;
  /** Which position on the site this is. Resolves to a slot id through
   *  lib/ads.ts; a placement with no configured unit renders nothing. */
  placement: AdPlacement;
  className?: string;
}) {
  const insRef = useRef<HTMLModElement>(null);
  // AdSense throws "adsbygoogle.push() error: All ins elements ... already
  // have ads in them" if the same slot is pushed twice, which React's StrictMode
  // does by design in development. Guarding on the ref rather than on a state
  // flag keeps that out of the render path entirely.
  const pushed = useRef(false);

  const client = adsenseClient();
  const slotId = adSlotId(placement);
  const enabled = Boolean(client && slotId);

  useEffect(() => {
    if (!enabled || pushed.current || !insRef.current) return;
    // Google marks a filled slot with this attribute. Checking it covers the
    // case where a slot is remounted onto an <ins> the script already claimed.
    if (insRef.current.getAttribute("data-adsbygoogle-status")) return;
    pushed.current = true;
    try {
      const w = window as typeof window & { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      // A blocked or failed ad must never take the article down with it.
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    // NO aria-hidden here, and that is a fix rather than an omission. The ad that
    // lands inside this container is an iframe with links in it, all of them
    // focusable, and focusable content inside an aria-hidden subtree is a WCAG
    // failure outright: a keyboard user tabs into a region a screen reader has
    // been told does not exist. Google's own iframe carries title="Advertisement",
    // so the unit announces itself without this container adding a landmark to
    // every page.
    <div
      style={{ minHeight }}
      className={`w-full overflow-hidden rounded-xl2 ${className ?? ""}`}
      data-ad-placement={placement}
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

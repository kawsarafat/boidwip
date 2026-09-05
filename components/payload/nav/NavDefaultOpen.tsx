"use client";

import React from "react";
import { useNav } from "@payloadcms/ui";

/** Opens the docked sidebar by default on a desktop-width screen.
 *
 *  WHY THIS EXISTS
 *
 *  Payload's NavProvider force-closes the nav whenever its `l` breakpoint
 *  (max-width: 1440px) is true, and only re-reads the stored "open" preference
 *  when the window is WIDER than 1440px. A 1366- or 1440-wide laptop is `l`, so
 *  it always starts collapsed regardless of what the editor last chose — which
 *  is the "the sidebar is closed every time" complaint. There is no config
 *  switch for this; the breakpoint is hard-coded in the provider.
 *
 *  This is a pass-through provider (registered in admin.components.providers, so
 *  it renders INSIDE Payload's RootProvider and therefore inside NavProvider —
 *  which is what lets it call useNav). On mount, once, if the viewport is at
 *  least tablet-desktop width and the nav is currently closed, it opens it.
 *
 *  The setTimeout(…, 0) is load-bearing: NavProvider runs its own breakpoint
 *  effect on mount and force-closes there. Deferring to the next tick means our
 *  open runs AFTER that effect, so it sticks. NavProvider only re-fires that
 *  effect when the breakpoint itself changes, so opening once here holds for the
 *  session; a manual collapse still works and a hard reload re-opens (which is
 *  exactly "open by default, collapse if you want"). Worst case — nav already
 *  open, or a narrow screen — it does nothing. */
export default function NavDefaultOpen({ children }: { children: React.ReactNode }) {
  const { navOpen, setNavOpen } = useNav();

  React.useEffect(() => {
    // Match Payload's own tablet/desktop boundary: below `m` (1024px) the nav is
    // an overlay drawer and opening it on load would cover the page, so only
    // open on genuinely wide screens.
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(min-width: 1025px)").matches) return;

    const timer = window.setTimeout(() => {
      if (!navOpen) setNavOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
    // Mount-only: this is a one-time "default", not a controller that keeps the
    // nav open. Re-running on navOpen changes would fight a deliberate collapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

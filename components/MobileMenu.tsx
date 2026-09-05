"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { CategoryContent } from "@/lib/types";
import { toBengaliNumerals } from "@/lib/numerals";
import { useClientFlag } from "@/lib/useClientFlag";
import { SITE_NAME } from "@/lib/seo";
import SearchBox from "@/components/SearchBox";
import SiteMark from "@/components/SiteMark";

const BROWSE_LINKS = [
  { href: "/new", label: "নতুন বই" },
  { href: "/popular", label: "জনপ্রিয় বই" },
  { href: "/blog", label: "ব্লগ" },
];

const INFO_LINKS = [
  { href: "/about", label: "আমাদের সম্পর্কে" },
  { href: "/contact", label: "যোগাযোগ" },
  { href: "/privacy-policy", label: "প্রাইভেসি পলিসি" },
];

/** How long the slide runs. Duplicated as a number here and as a duration in
 *  the `drawer-in` / `drawer-out` animations in tailwind.config.ts, because the
 *  unmount has to wait for the CSS to finish; if these drift the panel either
 *  vanishes mid-slide or leaves an invisible overlay swallowing taps. */
const TRANSITION_MS = 240;

/** Mobile navigation drawer.
 *
 *  RENDERED THROUGH A PORTAL, and that is the whole reason this component is
 *  more than a conditional <div>. It used to render in place, inside <Header>,
 *  and the panel came out 56px tall on a phone with its content spilling out
 *  below the header strip. The cause is not obvious from either file:
 *
 *    <header> carries `backdrop-blur-md`, and per Filter Effects, an element
 *    with a backdrop-filter becomes the CONTAINING BLOCK for its
 *    position: fixed descendants — exactly as `transform` and `filter` do.
 *    So `fixed inset-0` stopped meaning "the viewport" and started meaning
 *    "the header's 56px box". Measured: 375x56 instead of 375x812.
 *
 *  Nothing in the drawer's own CSS is wrong, which is why this is worth a
 *  comment rather than a fix. Portalling to document.body puts the panel
 *  outside every ancestor that could establish a containing block, so it cannot
 *  come back if the header's blur, or a transform on a parent, changes again.
 *  Do not "simplify" this back to an inline render.
 *
 *  THE SLIDE IS A KEYFRAME ANIMATION, not a transition between two classes.
 *  The obvious version - mount at translate-x-full, then flip a state flag in a
 *  requestAnimationFrame so the transition has a start value - was written
 *  first and left the panel parked off-screen: an rAF callback only runs when
 *  the page is actually being painted, so in a background tab, an occluded
 *  window or a throttled phone the flag never flips and the menu appears to do
 *  nothing. A keyframe needs no second render and no paint to schedule it.
 *  It also fails in the right direction: the panel's resting state, with the
 *  animation stripped out entirely, is on screen rather than translated away.
 *
 *  The rest of the behaviour a real modal drawer owes the reader:
 *   - Escape closes it.
 *   - Body scroll is locked while open, so the swipe scrolls the panel.
 *   - Focus moves in on open, is trapped while open, and returns to the
 *     trigger on close. aria-modal="true" is a promise; the trap is what keeps
 *     it, otherwise Tab walks into the page behind and a screen-reader user is
 *     silently reading content they cannot see. */
export default function MobileMenu({ categories }: { categories: CategoryContent[] }) {
  // Mount gate for the portal: document does not exist during the server
  // render, and this component is in the header of every prerendered page.
  const portalReady = useClientFlag(() => typeof document !== "undefined");
  const [open, setOpen] = useState(false);
  // Which direction to animate. Separate from `open` because `open` owns
  // mount/unmount and the panel has to stay mounted for the length of the exit.
  const [closing, setClosing] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setClosing(true);
    // Returning focus is the half people forget: without it the next Tab
    // starts from the top of the document, not from the menu button. Done
    // immediately rather than after the animation, so a keyboard user is not
    // left with focus on a dying element for a quarter of a second.
    triggerRef.current?.focus();
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, TRANSITION_MS);
  }, []);

  function openMenu() {
    // Cancelling the pending unmount matters when the menu is reopened during
    // its own exit animation: without this the timer fires a moment later and
    // closes the menu the reader just asked for.
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  }

  // Locks scroll and wires the keyboard while the panel is mounted.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    // html already sets scrollbar-gutter: stable, so hiding the scrollbar here
    // does not shift the layout underneath the scrim.
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap. Querying on every Tab rather than caching the list because
      // the panel's contents are not static: the search box can be cleared,
      // which is one fewer focusable node.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Also catches focus having escaped the panel entirely (a browser
      // find-in-page can do that), by pulling it back to an end.
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const drawer = (
    // z-[60] clears the sticky header's z-40 and the BackToTop button. Fixed
    // here resolves against the viewport because body is the containing block,
    // which is the entire point of the portal.
    <div className="fixed inset-0 z-[60] lg:hidden">
      {/* Scrim. A button rather than a div so tapping it is a real,
          keyboard-reachable close action rather than a click handler on
          something with no role. */}
      <button
        type="button"
        aria-label="মেনু বন্ধ করুন"
        onClick={close}
        className={`absolute inset-0 h-full w-full bg-ink/70 backdrop-blur-sm ${
          closing ? "animate-scrim-out" : "animate-scrim-in"
        }`}
      />

      <div
        id="mobile-nav"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="মেনু"
        // h-dvh, not h-full: on a phone the URL bar collapses and expands, and
        // vh-based units are resolved against the LARGEST viewport, so the
        // bottom of a 100vh panel sits under the browser chrome and the last
        // link is unreachable. dvh tracks the visible box.
        className={`absolute right-0 top-0 flex h-dvh w-[88%] max-w-sm flex-col border-l border-rule bg-surface shadow-pop ${
          closing ? "animate-drawer-out" : "animate-drawer-in"
        }`}
      >
        {/* pt tracks the notch: the panel is flush to the top of the screen, so
            without this the title sits under the status bar on an iPhone. */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-rule px-4 pb-3"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          <Link
            href="/"
            onClick={close}
            className="flex items-center gap-2.5"
            aria-label={`${SITE_NAME}, প্রচ্ছদ`}
          >
            <SiteMark id="drawer" className="h-9 w-9 shrink-0 rounded-lg shadow-card" />
            <span className="text-base font-extrabold tracking-tight text-ink">{SITE_NAME}</span>
          </Link>

          <button
            type="button"
            onClick={close}
            aria-label="মেনু বন্ধ করুন"
            // 44×44 — see the note on the open button below.
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-rule text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M4 4L16 16M16 4L4 16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* min-h-0 is what lets this actually scroll inside a flex column;
            without it the panel grows past the viewport instead of the middle
            section scrolling. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {/* autoFocus lands focus on the search field, which is both the most
              likely intent and a valid initial focus target for the dialog. */}
          <SearchBox onNavigate={close} autoFocus />

          <p className="mt-6 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-muted">
            ব্রাউজ করুন
          </p>
          <ul className="mt-2 space-y-1">
            {BROWSE_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-ink transition active:bg-surface-sunken hover:bg-surface-sunken"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-muted">
            বিষয়সমূহ
          </p>
          <ul className="mt-2 space-y-1">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/category/${c.slug}`}
                  onClick={close}
                  className="group flex min-h-[3.25rem] items-center gap-3 rounded-xl2 px-2 py-2 text-ink transition active:bg-surface-sunken hover:bg-surface-sunken"
                >
                  {/* First letter of the category in an accent-tinted tile —
                      a cheap, consistent visual anchor for a list whose
                      entries are otherwise all text. */}
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-sm font-extrabold text-accent"
                  >
                    {Array.from(c.name)[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {toBengaliNumerals(c.bookCount)}টি বই
                    </span>
                  </span>
                  <svg
                    className="h-4 w-4 shrink-0 text-ink-muted/60 transition group-hover:translate-x-0.5 group-hover:text-ink-muted"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M6 3.5L10.5 8L6 12.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-muted">
            তথ্য
          </p>
          <ul className="mt-2 space-y-1">
            {INFO_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-ink-muted transition active:bg-surface-sunken hover:bg-surface-sunken hover:text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Pinned footer rather than the last row of the scroll area: "সব
            অধ্যায়" is the drawer's primary action and should not require
            scrolling past six subjects to reach. */}
        <div
          className="shrink-0 border-t border-rule px-4 pt-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <Link href="/search" onClick={close} className="btn-primary w-full">
            সব বই দেখুন
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="মেনু খুলুন"
        // 44×44 (h-11 w-11), not 40×40. This is the single most important tap
        // target on a phone — it is the only way to reach navigation — and it
        // sits in the corner of the screen, where thumb accuracy is worst.
        // WCAG 2.5.8 asks for 24px as a minimum and both platform guidelines
        // ask for 44; the icon stays 20px, so only the padding grows.
        className="grid h-11 w-11 place-items-center rounded-lg border border-rule text-ink transition hover:bg-surface-sunken"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M3 5H17M3 10H17M3 15H17"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {portalReady && open && createPortal(drawer, document.body)}
    </div>
  );
}

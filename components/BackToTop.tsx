"use client";

import { useEffect, useState } from "react";

/** Back-to-top button, shown only once there is a meaningful distance to go
 *  back up. A chapter page here is long by design (a full set of questions and
 *  answers), and on a phone that is a lot of thumb work to reach the nav again.
 *
 *  Hidden until 900px of scroll rather than always visible, so it never covers
 *  content on a short page where it would save nothing. The scroll listener is
 *  passive: a non-passive one blocks the browser from starting the scroll until
 *  the handler returns, which is exactly the kind of jank this site cannot
 *  afford. */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 900);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  /* The one motion on this site that CSS cannot switch off. globals.css forces
   * `scroll-behavior: auto` under prefers-reduced-motion, but an explicit
   * `behavior: "smooth"` passed to scrollTo() is an argument, not a style — it
   * overrides the property and animates a whole chapter's worth of scrolling
   * past someone who asked the system for no animation. Read the query instead
   * and jump. Checked at click time rather than in an effect: no listener to
   * clean up, and it picks up a mid-session change of the OS setting. */
  function toTop() {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="উপরে ফিরে যান"
      title="উপরে ফিরে যান"
      className="no-print fixed bottom-5 right-4 z-30 grid h-11 w-11 animate-fade-in place-items-center rounded-full border border-rule bg-surface text-ink shadow-pop transition hover:bg-surface-sunken sm:bottom-6 sm:right-6"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M10 16V5M5 10l5-5 5 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";

/** Thin progress bar across the top of the viewport on chapter pages.
 *
 *  These pages are long by design, and on a phone there is no other cue for how
 *  much of a question set is left. It is also the cheapest possible version of
 *  that cue: one fixed 3px element, one transform, no layout.
 *
 *  Written with requestAnimationFrame rather than setting state on every scroll
 *  event. A phone fires scroll far more often than it paints, and re-rendering
 *  on each one is how a progress bar ends up being the thing that makes the page
 *  feel slow. */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      // A page shorter than the viewport has nothing to progress through, and
      // dividing by zero here would put NaN into a transform.
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    }

    function onScroll() {
      if (frame === 0) frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="no-print pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]"
      aria-hidden
    >
      <div
        className="h-full origin-left bg-accent"
        // scaleX rather than width: a transform is composited, a width change
        // relayouts the element on every frame.
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

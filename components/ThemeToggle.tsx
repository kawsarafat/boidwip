"use client";

/** Light/dark switch.
 *
 *  No React state at all, on purpose. Both icons are always in the markup and
 *  CSS picks which one is visible from the `dark` class on <html> — the same
 *  class the beforeInteractive script in layout.tsx has already set before this
 *  ever hydrates. The previous version tracked the theme in useState, which
 *  meant it had to start as `null` to avoid a hydration mismatch and therefore
 *  rendered the WRONG icon until hydration finished.
 *
 *  It is still a client component because the click handler has to touch
 *  document and localStorage, but there is nothing left to re-render. */
export default function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    // Writing this is also what stops the OS-preference listener in
    // layout.tsx from overriding the choice later in the same session.
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Static label rather than "switch to dark"/"switch to light": with no
      // state there is nothing to describe the current theme with, and "change
      // theme" is true either way. Screen readers announce the action, which is
      // the part that matters.
      aria-label="থিম পরিবর্তন করুন"
      title="থিম পরিবর্তন করুন"
      // 44×44 (h-11 w-11), not 40×40: this is one of two icon-only controls in
      // the header, and 44px is the floor both platform guidelines and WCAG
      // 2.5.8 put on a touch target. The icon inside stays 18px — the extra
      // 4px is padding, so nothing about the visual weight of the header
      // changes.
      className="grid h-11 w-11 place-items-center rounded-lg border border-rule text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
    >
      {/* Sun: shown in dark mode, because that is what clicking gets you. */}
      <svg
        className="hidden h-[18px] w-[18px] dark:block"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.9 4.1l-1.4 1.4M5.5 14.5l-1.4 1.4M15.9 15.9l-1.4-1.4M5.5 5.5L4.1 4.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {/* Moon: shown in light mode. */}
      <svg
        className="h-[18px] w-[18px] dark:hidden"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path
          d="M17 11.5A7 7 0 118.5 3a5.5 5.5 0 108.5 8.5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

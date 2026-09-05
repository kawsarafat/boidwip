"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({
  onNavigate,
  className = "",
  autoFocus = false,
}: {
  onNavigate?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    onNavigate?.();
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={className}>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // autoFocus is only ever true inside the mobile drawer, where the
          // person just tapped to open a panel whose first purpose is search.
          // Never on page load, which is the case jsx-a11y/no-autofocus exists
          // for. (No eslint-disable here: eslint-config-next does not enable
          // that rule, and a directive for a rule that never fires is itself
          // reported as an unused directive.)
          autoFocus={autoFocus}
          placeholder="অধ্যায় বা বিষয় খুঁজুন..."
          aria-label="অধ্যায় বা বিষয় খুঁজুন"
          // enterKeyHint changes the mobile keyboard's action key to a search
          // glyph, so the gesture matches what submitting actually does.
          enterKeyHint="search"
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-rule bg-surface pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/80 focus:border-accent"
        />
      </div>
    </form>
  );
}

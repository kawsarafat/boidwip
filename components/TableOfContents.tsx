import type { TocEntry } from "@/lib/types";

/** On-page table of contents for a chapter.
 *
 *  A <details> element, so it costs zero JavaScript and zero layout shift: the
 *  browser handles the toggle, and closed-by-default means a chapter with
 *  twenty questions does not push its own opening paragraph off a phone screen.
 *
 *  Closed rather than open even on desktop, deliberately. Links inside a closed
 *  <details> are still in the DOM and still crawled, so nothing is lost for SEO
 *  by keeping it out of the way of the first thing the reader came to read.
 *
 *  Ids come from withHeadingIds() in lib/render.ts at build time. */
export default function TableOfContents({ items }: { items: TocEntry[] }) {
  if (items.length === 0) return null;

  return (
    <details className="group card my-6 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink transition hover:bg-surface-sunken sm:px-5">
        <span>
          এই অধ্যায়ে যা আছে{" "}
          <span className="font-medium text-ink-muted">
            ({items.length.toLocaleString("bn-BD")} টি অংশ)
          </span>
        </span>
        {/* Rotates on open. group-open is what makes a CSS-only accordion feel
            like a real control instead of a static heading. */}
        <svg
          className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <nav aria-label="অধ্যায়ের সূচিপত্র" className="border-t border-rule px-4 py-3 sm:px-5">
        <ol className="space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={item.id} className={item.level === 3 ? "ps-4" : undefined}>
              <a
                href={`#${item.id}`}
                className="flex gap-2 rounded-md py-1.5 text-ink-muted transition hover:text-accent"
              >
                <span aria-hidden className="shrink-0 font-mono text-xs leading-6 text-ink-muted/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">{item.text}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}

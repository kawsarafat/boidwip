import type { FaqItem } from "@/lib/types";

/** Chapter/book/home FAQ, rendered as a real accordion.
 *
 *  <details>/<summary>, not a client component: the answers are in the HTML on
 *  first paint, which matters because these same items are also emitted as
 *  FAQPage JSON-LD by the page that renders them. Google expects the text it
 *  sees in the structured data to be present in the page content, and content
 *  that only appears after hydration is exactly the pattern that gets a rich
 *  result dropped. A collapsed <details> satisfies that; a JS-built accordion
 *  does not reliably.
 *
 *  THIS COMPONENT OWNS THE SECTION AND THE HEADING. Callers must not wrap it in
 *  another <section>/<h2> pair — the homepage did, which put two `id="faq-
 *  heading"` attributes in one document (invalid, and `aria-labelledby` silently
 *  resolves to whichever came first), nested one region landmark inside
 *  another, and printed the heading text twice. If a page ever needs two FAQ
 *  blocks, give each a distinct `headingId`; that is what the prop is for. */
export default function Faq({
  items,
  heading = "সাধারণ জিজ্ঞাসা",
  headingId = "faq-heading",
  className = "card mt-8 p-5 sm:p-6",
}: {
  items: FaqItem[];
  heading?: string;
  /** Must be unique in the document. Only override when a page renders more
   *  than one Faq. */
  headingId?: string;
  /** Outer <section> classes. The default is the card treatment used on book
   *  and chapter pages; the homepage passes its own measure-width wrapper so it
   *  no longer needs a wrapper element to apply it. */
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={className} aria-labelledby={headingId}>
      <h2 id={headingId} className="section-title">
        {heading}
      </h2>

      <div className="mt-4 divide-y divide-rule">
        {items.map((item) => (
          <details key={item.question} className="group py-1">
            {/* min-h-11 = 44px: the summary is the tap target, and a one-line
                Bengali question at text-sm sat just under the threshold on a
                phone. */}
            <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 py-3 text-sm font-semibold text-ink">
              <span>{item.question}</span>
              {/* The rotate is decorative; globals.css neutralises its
                  transition under prefers-reduced-motion. */}
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-45"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
              >
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-ink-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import type { BookSummary } from "@/lib/types";
import { tierAllowsDelivery } from "@/lib/types";
import { isPriceFresh } from "@/lib/affiliate";
import { formatTaka } from "@/lib/numerals";
import CoverImage from "@/components/CoverImage";
import RatingStars from "@/components/RatingStars";

/** The listing card — every grid on the site (home, category, author,
 *  publisher, series, list, search, related) renders books through this one
 *  component, so a book always looks like the same book everywhere.
 *
 *  Server component on purpose. It takes a BookSummary (see lib/types.ts for
 *  why the projection exists) and paints it; no state, no handlers. The ONE
 *  interactive-looking thing on it, the price chip, is deliberately NOT a
 *  buy link: the whole card is already an anchor to the book page, and HTML
 *  forbids nested anchors — a browser would silently split the DOM and make
 *  half the card dead. The chip tells the reader a price exists; the book
 *  page sells.
 *
 *  What the card shows and in what order mirrors what a reader scans for:
 *  cover → title → author → rating → what-they-can-do (free PDF badge or
 *  price). The summary line is clamped to two lines so rows stay even. */
export default function BookCard({
  book,
  /** Set on above-the-fold cards (home hero row) so the cover loads eagerly. */
  priority = false,
}: {
  book: BookSummary;
  priority?: boolean;
}) {
  const isFree = tierAllowsDelivery(book.rightsTier) && Boolean(book.pdfUrl);
  const showPrice =
    typeof book.priceTaka === "number" && isPriceFresh(book.priceCheckedAt);
  const authorNames = book.authors.map((a) => a.name).join(", ");

  return (
    <Link
      href={`/book/${book.slug}`}
      className="card-interactive group flex h-full flex-col overflow-hidden"
    >
      <div className="relative aspect-cover w-full overflow-hidden bg-surface-sunken">
        <CoverImage
          src={book.coverImage}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
          priority={priority}
        />
        {/* One badge, not two: "free PDF" outranks price as the thing worth
            shouting on a card, and stacking both crowds a small cover. */}
        {isFree ? (
          <span className="absolute left-2 top-2 rounded-md bg-download px-2 py-0.5 text-[0.6875rem] font-bold text-white shadow-card">
            ফ্রি PDF
          </span>
        ) : showPrice ? (
          <span className="absolute left-2 top-2 rounded-md bg-canvas/90 px-2 py-0.5 text-[0.6875rem] font-bold text-ink shadow-card backdrop-blur-sm">
            {formatTaka(book.priceTaka as number)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink transition group-hover:text-accent">
          {book.title}
        </h3>
        {authorNames && (
          <p className="line-clamp-1 text-xs text-ink-muted">{authorNames}</p>
        )}
        <div className="mt-auto pt-1.5">
          <RatingStars rating={book.ratingAverage} count={book.ratingCount} />
        </div>
      </div>
    </Link>
  );
}

/** The grid the cards sit in — exported beside the card so every listing
 *  page uses identical breakpoints instead of five near-copies drifting.
 *
 *  `ordered` renders the grid as an `<ol>` rather than a `<div>`. The series
 *  page needs its cards to BE list items, because the reading order is that
 *  page's entire reason to exist, and it used to get there by wrapping this
 *  grid in an `<ol>` from the outside. That is invalid HTML: an `<ol>` may
 *  contain only `<li>`, so the intervening `<div>` put every `<li>` in
 *  foster-parenting territory, and a parser recovering from it is free to throw
 *  away the ordinal semantics the markup was there to carry. The element that
 *  owns the `<li>` children has to be the list itself — hence a prop here
 *  instead of a wrapper there. */
export function BookGrid({
  children,
  ordered = false,
  label,
}: {
  children: React.ReactNode;
  ordered?: boolean;
  /** Accessible name for the list. Only meaningful with `ordered`. */
  label?: string;
}) {
  const className =
    "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";
  return ordered ? (
    <ol className={className} aria-label={label}>
      {children}
    </ol>
  ) : (
    <div className={className}>{children}</div>
  );
}

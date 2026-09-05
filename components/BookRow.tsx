import Link from "next/link";
import type { BookSummary } from "@/lib/types";
import { tierAllowsDelivery } from "@/lib/types";
import { buyUrl, isPriceFresh, type AffiliateSlot } from "@/lib/affiliate";
import { toBengaliNumerals } from "@/lib/numerals";
import CoverImage from "@/components/CoverImage";
import RatingStars from "@/components/RatingStars";
import BuyButton from "@/components/BuyButton";

/** A book as a wide ROW rather than a card: cover, title, author, rating, an
 *  optional editorial note, and the two things a reader can act on (take the
 *  free PDF, or buy the print copy).
 *
 *  WHY A ROW EXISTS ALONGSIDE BookCard. A card is a cover with a label under
 *  it — it is the right shape when the covers themselves are the content and
 *  the reader is scanning twenty of them. It has no room for prose. The two
 *  places on this site where a book comes WITH AN ARGUMENT — a curated তালিকা
 *  entry ("why this book is on this list") and a blog post's reading list —
 *  need that prose to be the widest thing in the row, and they need a buy
 *  control in reach, because a reader who has just read why they should read a
 *  book is closer to buying it than at any other point on the site.
 *
 *  WHY IT IS SHARED. The list page grew this markup inline first; the blog post
 *  page needed the same row, and a second copy is how the two drift — one gets
 *  the price-freshness gate and the other keeps showing a stale ৳ figure, or one
 *  gets the sponsored rel and the other does not. Both of those are trust
 *  failures, not cosmetic ones. The affiliate invariants live in BuyButton and
 *  the freshness decision lives here, once.
 *
 *  THE COVER WRAPPER IS `relative aspect-cover` AND THAT IS LOAD-BEARING.
 *  CoverImage renders next/image with `fill` for real uploads, which is
 *  `position: absolute; inset: 0`. The list page's own version of this row wrapped
 *  the cover in a plain `block` link with the aspect ratio on the image instead,
 *  so the link had no positioned ancestor and no height: measured in the browser,
 *  that wrapper collapsed to 2px (its borders) while the image sized itself
 *  against the page's containing block at 334x670. It only looked right because
 *  every seeded book falls back to the SVG placeholder, which CoverImage serves
 *  as a static <img>. The first real cover uploaded to a listed book would have
 *  broken the row. */
export default function BookRow({
  book,
  ordinal,
  noteHtml,
  slot,
  headingAs = "h3",
}: {
  book: BookSummary;
  /** 1-based position, rendered before the title. Omit for an unordered set. */
  ordinal?: number;
  /** Sanitized HTML: the editor's reason this book is here. */
  noteHtml?: string | null;
  /** Which placement this row's buy button occupies, for click attribution. */
  slot: AffiliateSlot;
  /** Must sit one level below the heading of the section that contains the
   *  rows. A row is never the page's own subject, so never h1. */
  headingAs?: "h2" | "h3";
}) {
  const Heading = headingAs;
  const isFree = tierAllowsDelivery(book.rightsTier) && Boolean(book.pdfUrl);
  const buyHref = buyUrl(book.rokomariUrl);
  const authorNames = book.authors.map((a) => a.name).join(", ");

  return (
    <article className="flex gap-4 sm:gap-5">
      <Link
        href={`/book/${book.slug}`}
        // The cover is this link's ONLY content, so without a label the link
        // has no accessible name and is announced as its URL. Labelling the
        // LINK rather than the image keeps that true for books with no cover,
        // where a placeholder renders instead.
        aria-label={book.title}
        className="relative block aspect-cover w-20 shrink-0 self-start overflow-hidden rounded-lg border border-rule bg-surface-sunken sm:w-24"
      >
        <CoverImage src={book.coverImage} sizes="96px" className="object-cover" />
      </Link>

      <div className="min-w-0 flex-1">
        <Heading className="text-base font-bold leading-snug text-ink sm:text-lg">
          {typeof ordinal === "number" && (
            <span className="mr-1.5 text-accent">{toBengaliNumerals(ordinal)}.</span>
          )}
          <Link href={`/book/${book.slug}`} className="hover:text-accent">
            {book.title}
          </Link>
        </Heading>

        {authorNames && <p className="mt-0.5 text-sm text-ink-muted">{authorNames}</p>}

        <div className="mt-1.5">
          <RatingStars rating={book.ratingAverage} count={book.ratingCount} size="sm" />
        </div>

        {noteHtml && (
          <div
            className="prose-book mt-2 text-sm leading-relaxed text-ink-muted"
            dangerouslySetInnerHTML={{ __html: noteHtml }}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Not a link to the file: the download lives on the book page behind
              the tier check and the counter, and a second route to it would be a
              second place to keep those honest. This says the file exists. */}
          {isFree && (
            <Link
              href={`/book/${book.slug}`}
              className="chip bg-download/10 font-semibold text-download"
            >
              ফ্রি PDF আছে
            </Link>
          )}
          {buyHref && (
            <BuyButton
              href={buyHref}
              slug={book.slug}
              slot={slot}
              // The freshness gate is the caller's job by BuyButton's contract,
              // and this is the caller. A ৳ figure that disagrees with
              // Rokomari's live page reads as bait-and-switch.
              priceTaka={isPriceFresh(book.priceCheckedAt) ? book.priceTaka : null}
              className="btn-buy px-3 py-1.5 text-xs"
            />
          )}
        </div>
      </div>
    </article>
  );
}

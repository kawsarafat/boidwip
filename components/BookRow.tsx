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
 *  broken the row.
 *
 *  The rank badge added an OUTER wrapper around that box. The `relative
 *  aspect-cover w-20` stayed on the box itself for exactly the reason above —
 *  the outer wrapper is `relative` only so the badge has something to hang off,
 *  and it must not be the thing CoverImage sizes against. */
export default function BookRow({
  book,
  ordinal,
  noteHtml,
  slot,
  headingAs = "h3",
  pending = false,
}: {
  book: BookSummary;
  /** 1-based position, rendered as a badge on the cover's corner. Omit for an
   *  unordered set. The caller must wrap the rows in an <ol> — the badge is
   *  aria-hidden and the list element is what carries the order to a reader. */
  ordinal?: number;
  /** Sanitized HTML: the editor's reason this book is here. */
  noteHtml?: string | null;
  /** Which placement this row's buy button occupies, for click attribution. */
  slot: AffiliateSlot;
  /** Must sit one level below the heading of the section that contains the
   *  rows. A row is never the page's own subject, so never h1. */
  headingAs?: "h2" | "h3";
  /** The book has no page on the site yet — see ReferencedBook in lib/types.ts.
   *  Everything that would navigate becomes plain text, because this site is a
   *  build artefact: `dynamicParams = false` means /book/<unbuilt-slug> hard-404s
   *  rather than degrading into a draft view, and a row that looks like the four
   *  above it and 404s is worse for a reader than a row that says "not yet". */
  pending?: boolean;
}) {
  const Heading = headingAs;
  const isFree = !pending && tierAllowsDelivery(book.rightsTier) && Boolean(book.pdfUrl);
  const buyHref = pending ? null : buyUrl(book.rokomariUrl);
  const authorNames = book.authors.map((a) => a.name).join(", ");

  return (
    <article className="flex gap-4 sm:gap-5">
      {/* The cover and its rank badge. The wrapper exists so the badge can hang
          over the cover's corner: the cover box is `overflow-hidden` (it has to
          be, to clip a real upload to the rounded rectangle), so a badge placed
          inside it would have the overhanging half cut off. */}
      <div className="relative shrink-0 self-start">
        {pending ? (
          // Same box, no link. Kept as a positioned element because CoverImage
          // renders next/image with `fill` — see the note above on what happens to
          // a fill image whose wrapper is not `relative` with a height.
          <div
            aria-hidden
            className="relative block aspect-cover w-20 overflow-hidden rounded-lg border border-rule bg-surface-sunken opacity-70 sm:w-24"
          >
            <CoverImage src={book.coverImage} sizes="96px" className="object-cover" />
          </div>
        ) : (
          <Link
            href={`/book/${book.slug}`}
            // The cover is this link's ONLY content, so without a label the link
            // has no accessible name and is announced as its URL. Labelling the
            // LINK rather than the image keeps that true for books with no cover,
            // where a placeholder renders instead.
            aria-label={book.title}
            className="relative block aspect-cover w-20 overflow-hidden rounded-lg border border-rule bg-surface-sunken sm:w-24"
          >
            <CoverImage src={book.coverImage} sizes="96px" className="object-cover" />
          </Link>
        )}

        {/* The rank as a badge on the cover, rather than the "৫." that used to
            run before the title. A ranked তালিকা is the one place on this site
            where the position IS content, and inline text set it at the same
            weight as the title it was numbering.

            aria-hidden because the number is not extra information: the caller
            wraps these rows in an <ol>, which already carries the order, and a
            screen reader that announces both says "five, five, দেবদাস". */}
        {typeof ordinal === "number" && (
          <span
            aria-hidden
            className="absolute -left-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-accent text-xs font-extrabold text-on-accent shadow-card"
          >
            {toBengaliNumerals(ordinal)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Heading className="text-base font-bold leading-snug text-ink sm:text-lg">
          {pending ? (
            book.title
          ) : (
            <Link href={`/book/${book.slug}`} className="hover:text-accent">
              {book.title}
            </Link>
          )}
        </Heading>

        {authorNames && <p className="mt-0.5 text-sm text-ink-muted">{authorNames}</p>}

        {/* No rating on a pending row rather than an empty rating: reviews attach
            to a book's own page, and this book has none to have been reviewed on. */}
        {!pending && (
          <div className="mt-1.5">
            <RatingStars rating={book.ratingAverage} count={book.ratingCount} size="sm" />
          </div>
        )}

        {noteHtml && (
          /* The editor's reason this book is here, given a rule of its own. It is
             the whole value of a curated তালিকা and it used to sit in the same
             muted grey as the author line directly above it, where it read as one
             more piece of metadata instead of as the argument.

             The `[&>p+p]` spacing is here because this wrapper carries
             `prose-book` (the colour tokens) WITHOUT `prose` (the typography), so
             a two-paragraph note would otherwise run together with no gap. */
          <div
            className="prose-book mt-2.5 border-l-2 border-accent-soft pl-3 text-sm leading-relaxed text-ink-muted [&>p+p]:mt-2"
            dangerouslySetInnerHTML={{ __html: noteHtml }}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Says what a reader can expect instead of leaving the row's action
              area blank, which reads as a broken card. Deliberately not a buy
              link either: a draft book's price and Rokomari URL are unreviewed by
              definition, and an affiliate link pointed at an unchecked URL is a
              trust failure, not a missed sale. */}
          {pending && <span className="chip">বিস্তারিত শীঘ্রই আসছে</span>}
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

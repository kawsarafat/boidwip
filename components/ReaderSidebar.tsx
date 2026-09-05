import Link from "next/link";
import CoverImage from "@/components/CoverImage";
import BuyButton from "@/components/BuyButton";
import AdSlot from "@/components/AdSlot";
import { buyUrl, isPriceFresh } from "@/lib/affiliate";
import { tierAllowsDelivery, type BookContent } from "@/lib/types";
import { toBengaliNumerals } from "@/lib/numerals";

/** The reader's own rail: the book being read, its table of contents, and the
 *  two ways to keep the book.
 *
 *  WHY NOT components/Sidebar. That rail is জনপ্রিয় বই plus a category chip
 *  cloud, which is the right rail for a listing and the wrong one here: a reader
 *  three paragraphs into চ্যাপ্টার ৪ wants the NEXT chapter and the table of
 *  contents, not five other books. The page used to carry a comment claiming a
 *  reading page should therefore have no rail at all, which threw out the
 *  chapter list with the noise. So this rail exists and holds only what a reader
 *  mid-book asks for.
 *
 *  THE CHAPTER LIST IS THE POINT. Every chapter of the book is a real link from
 *  every other chapter, which is also what turns a set of chapter URLs into a
 *  crawlable cluster instead of a chain that has to be walked one prev/next hop
 *  at a time. It caps its own height and scrolls internally so a forty-chapter
 *  novel does not push the buy panel a screen and a half down the rail.
 *
 *  `current` marks the chapter being read (`aria-current="page"`, which is what
 *  a screen reader announces) and is omitted on the reader index, where no
 *  chapter is open. */
export default function ReaderSidebar({
  book,
  current,
}: {
  book: BookContent;
  /** Slug of the chapter on screen, or undefined on the index. */
  current?: string;
}) {
  const buyHref = buyUrl(book.rokomariUrl);
  const canDownload = tierAllowsDelivery(book.rightsTier) && Boolean(book.pdfUrl);
  const index = current ? book.chapters.findIndex((c) => c.slug === current) : -1;
  const authors = book.authors.map((a) => a.name).join(", ");

  return (
    <aside aria-label="বইটি সম্পর্কে" className="space-y-6">
      <div className="sticky-aside space-y-6">
        {/* The book, so the reader always knows what they are inside of. */}
        <section className="card p-5">
          <Link href={`/book/${book.slug}`} className="group flex items-start gap-4">
            <span className="relative block aspect-cover w-16 shrink-0 overflow-hidden rounded-md border border-rule bg-surface-sunken">
              <CoverImage src={book.coverImage} sizes="64px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-3 text-sm font-bold leading-snug text-ink transition group-hover:text-accent">
                {book.title}
              </span>
              {authors && (
                <span className="mt-1 block truncate text-xs text-ink-muted">{authors}</span>
              )}
              <span className="mt-2 block text-xs font-semibold text-accent">
                বইয়ের পাতা দেখুন →
              </span>
            </span>
          </Link>

          {index >= 0 && (
            <p className="mt-4 border-t border-rule pt-3 text-xs text-ink-muted">
              পড়ছেন পরিচ্ছেদ {toBengaliNumerals(index + 1)} / {toBengaliNumerals(book.chapters.length)}
            </p>
          )}
        </section>

        {book.chapters.length > 0 && (
          <section className="card p-5" aria-labelledby="reader-toc-heading">
            <div className="flex items-baseline justify-between gap-2">
              <h2
                id="reader-toc-heading"
                className="text-xs font-bold uppercase tracking-widest text-ink-muted"
              >
                সব পরিচ্ছেদ
              </h2>
              <span className="text-xs text-ink-muted">
                {toBengaliNumerals(book.chapters.length)}টি
              </span>
            </div>

            {/* max-h + overflow-y is what keeps a long novel's rail usable.
                The list is an <ol> because the order is the book's order. */}
            <ol className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto pr-1">
              {book.chapters.map((c, i) => {
                const isCurrent = c.slug === current;
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/book/${book.slug}/read/${c.slug}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={
                        isCurrent
                          ? "flex items-center gap-2.5 rounded-lg border border-accent bg-accent-soft px-2.5 py-2 text-sm font-semibold text-accent"
                          : "group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-sm text-ink transition hover:border-rule hover:bg-surface-sunken"
                      }
                    >
                      <span
                        aria-hidden
                        className={
                          isCurrent
                            ? "grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-bold text-on-accent"
                            : "grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface-sunken text-[11px] font-bold text-ink-muted"
                        }
                      >
                        {toBengaliNumerals(i + 1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate transition group-hover:text-accent">
                        {c.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Keeping the book: the free file first, the printed copy second, both
            phrased as an offer rather than an interruption. Neither renders
            when the book has nothing to offer. */}
        {(canDownload || buyHref) && (
          <section className="card p-5" aria-labelledby="reader-keep-heading">
            <h2
              id="reader-keep-heading"
              className="text-xs font-bold uppercase tracking-widest text-ink-muted"
            >
              বইটি সংগ্রহে রাখুন
            </h2>
            <div className="mt-3 space-y-3">
              {canDownload && (
                /* Links to the book page's download control rather than the
                   file: that flow carries the countdown, the wait ad and the
                   post-download buy panel, and duplicating it here would mean
                   two implementations of the site's most valuable moment. */
                <Link
                  href={`/book/${book.slug}`}
                  className="btn-secondary w-full justify-center text-sm"
                >
                  সম্পূর্ণ PDF ডাউনলোড
                  {typeof book.pdfSizeMB === "number" && (
                    <span className="font-medium text-ink-muted">
                      ({toBengaliNumerals(book.pdfSizeMB)} MB)
                    </span>
                  )}
                </Link>
              )}
              {buyHref && (
                <BuyButton
                  href={buyHref}
                  slug={book.slug}
                  slot="reader"
                  priceTaka={isPriceFresh(book.priceCheckedAt) ? book.priceTaka : null}
                  className="btn-buy w-full justify-center text-sm"
                />
              )}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              কেনার লিংকটি অ্যাফিলিয়েট লিংক। আপনার বাড়তি খরচ হয় না।
            </p>
          </section>
        )}

        <AdSlot placement="reader" minHeight={250} />
      </div>
    </aside>
  );
}

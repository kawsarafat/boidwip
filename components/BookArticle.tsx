import Link from "next/link";
import type { BookContent } from "@/lib/types";
import { getRightsTierLabel, tierAllowsDelivery } from "@/lib/types";
import { AFFILIATE_DISCLOSURE, isPriceFresh } from "@/lib/affiliate";
import { bookH1 } from "@/lib/seo";
import { formatBengaliDate, formatTaka, toBengaliNumerals } from "@/lib/numerals";
import CoverImage from "@/components/CoverImage";
import RatingStars from "@/components/RatingStars";
import BuyButton from "@/components/BuyButton";
import DownloadButton from "@/components/DownloadButton";
import AdSlot from "@/components/AdSlot";
import TableOfContents from "@/components/TableOfContents";
import ShareRow from "@/components/ShareRow";
import Faq from "@/components/Faq";
import TextSourceNote from "@/components/TextSourceNote";

/** The book itself: header, cover, facts, rights-gated actions, synopsis,
 *  review, quotes, chapter list, FAQ.
 *
 *  Extracted from app/(frontend)/book/[slug]/page.tsx so the draft-preview
 *  route renders a book through exactly the same component. The page keeps
 *  everything that is about the book's PLACE on the site — metadata, JSON-LD,
 *  breadcrumbs, related books, the review section, the sidebar — none of
 *  which a preview of an unsaved draft can meaningfully show. The split is
 *  what makes preview trustworthy: separate markup would drift, and an editor
 *  would approve something that isn't what ships.
 *
 *  THE RIGHTS GATE, VISIBLY. lib/render.ts has already nulled pdfUrl and
 *  emptied chapters for a Tier D book before this component ever sees it —
 *  the gate is enforced in data, not in JSX. What THIS component owns is
 *  making the page honest about it: a Tier D page never renders a download
 *  affordance, never says PDF, and leads with the review; a Tier A page leads
 *  with the download. One book model, two genuinely different pages.
 *
 *  `buyHref` arrives ALREADY decorated by lib/affiliate.ts buyUrl() in the
 *  server route — this component never reads env. Null means no buy link
 *  exists, and nothing buy-shaped renders. */

/** True when a review body is worth a section of its own (not just the
 *  empty-string default). */
function hasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

export default function BookArticle({
  book,
  buyHref,
  showAds = true,
  shareUrl = null,
  linkEntities = true,
}: {
  book: BookContent;
  /** Decorated affiliate URL, or null when the book has no buy link. */
  buyHref: string | null;
  /** Off in preview: an impression on a noindex page no reader visits is
   *  exactly what AdSense's invalid-traffic policy exists to catch. */
  showAds?: boolean;
  /** Absolute URL of the live page; null in preview (a draft has no
   *  shareable URL, and offering one that 404s is worse than none). */
  shareUrl?: string | null;
  /** Off in preview, where author/category hubs for a half-filled draft may
   *  not exist yet and the links would 404. */
  linkEntities?: boolean;
}) {
  const canDownload = tierAllowsDelivery(book.rightsTier);
  const isFree = canDownload && Boolean(book.pdfUrl);
  const canRead = book.chapters.length > 0;

  /* The price, or null when it is too old to quote. Computed ONCE for both
     placements on this page: the two used to gate differently, which is how a
     stale figure survived in one of them. isPriceFresh fails closed, so a book
     with no priceCheckedAt simply shows no price. */
  const freshPrice =
    typeof book.priceTaka === "number" && isPriceFresh(book.priceCheckedAt)
      ? book.priceTaka
      : null;

  /* Facts strip: only facts that exist. Bengali numerals at the render
     boundary, per lib/numerals.ts. */
  const facts: Array<{ label: string; value: string }> = [];
  if (book.pageCount) facts.push({ label: "পৃষ্ঠা", value: toBengaliNumerals(book.pageCount) });
  if (book.firstPublishedYear)
    facts.push({ label: "প্রথম প্রকাশ", value: toBengaliNumerals(book.firstPublishedYear) });
  if (book.isbn) facts.push({ label: "ISBN", value: book.isbn });
  facts.push({ label: "ভাষা", value: book.language });
  if (isFree && book.pdfSizeMB)
    facts.push({ label: "PDF সাইজ", value: `${toBengaliNumerals(book.pdfSizeMB)} MB` });

  return (
    <>
      <article className="card overflow-hidden">
        <header className="grid gap-6 p-5 sm:grid-cols-[190px_minmax(0,1fr)] sm:p-8">
          {/* The cover: the one image on this page worth `priority`. On a
              phone it is the largest element in the first viewport, so it is
              the LCP element; left to default it would be loading="lazy" and
              the largest paint would wait for a scroll listener's opinion. */}
          <div className="mx-auto w-44 sm:mx-0 sm:w-full">
            <div className="relative aspect-cover overflow-hidden rounded-lg border border-rule bg-surface-sunken shadow-card">
              <CoverImage
                src={book.coverImage}
                sizes="(max-width: 640px) 176px, 190px"
                className="object-cover"
                priority
                // Described rather than decorative: on the book's OWN page the
                // cover is the artwork of the thing the page is about, and it
                // is not inside a link whose text already names the book.
                alt={`${book.title} বইয়ের প্রচ্ছদ`}
              />
            </div>
          </div>

          <div className="min-w-0">
            {/* Category + rights chips. The rights label is deliberately on
                the page, not buried in a footer: "পাবলিক ডোমেইন" on a download
                page is the site saying out loud why this file is legal. */}
            <div className="flex flex-wrap items-center gap-2">
              {book.primaryCategory &&
                (linkEntities ? (
                  <Link
                    href={`/category/${book.primaryCategory.slug}`}
                    className="chip font-semibold text-accent transition hover:border-accent"
                  >
                    {book.primaryCategory.name}
                  </Link>
                ) : (
                  <span className="chip font-semibold text-accent">
                    {book.primaryCategory.name}
                  </span>
                ))}
              <span className="chip">{getRightsTierLabel(book.rightsTier)}</span>
            </div>

            {/* bookH1(), not a hand-written ternary: the <h1> and the <title>
                have to branch identically, and lib/seo.ts owns that branch.
                Written out here it read `isFree ? title + " PDF Download"` —
                the same rule in two files, which is how a page ends up with a
                download <h1> over a <title> that promises no download. */}
            <h1 className="mt-3 text-[1.6rem] font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
              {bookH1(book)}
            </h1>
            {book.subtitle && (
              <p className="mt-2 text-base leading-relaxed text-ink-muted sm:text-lg">
                {book.subtitle}
              </p>
            )}

            {/* Authors — the strongest internal link on the page. */}
            {book.authors.length > 0 && (
              <p className="mt-3 text-sm text-ink-muted">
                লেখক:{" "}
                {book.authors.map((a, i) => (
                  <span key={a.slug}>
                    {i > 0 && ", "}
                    {linkEntities ? (
                      <Link
                        href={`/author/${a.slug}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {a.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{a.name}</span>
                    )}
                  </span>
                ))}
                {book.publisher && (
                  <>
                    {" · প্রকাশক: "}
                    {linkEntities ? (
                      <Link
                        href={`/publisher/${book.publisher.slug}`}
                        className="text-accent hover:underline"
                      >
                        {book.publisher.name}
                      </Link>
                    ) : (
                      book.publisher.name
                    )}
                  </>
                )}
              </p>
            )}

            {book.series && (
              <p className="mt-1 text-sm text-ink-muted">
                সিরিজ:{" "}
                {linkEntities ? (
                  <Link
                    href={`/series/${book.series.slug}`}
                    className="text-accent hover:underline"
                  >
                    {book.series.name}
                  </Link>
                ) : (
                  book.series.name
                )}
                {book.series.position !== null &&
                  ` (${toBengaliNumerals(book.series.position)} নং বই)`}
              </p>
            )}

            <div className="mt-3">
              <RatingStars rating={book.ratingAverage} count={book.ratingCount} size="md" />
            </div>

            {facts.length > 0 && (
              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {facts.map((f) => (
                  <div key={f.label} className="flex gap-1.5">
                    <dt className="text-ink-muted">{f.label}:</dt>
                    <dd className="font-semibold text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {/* THE ACTION ROW — what this page exists for, above the fold on
                every viewport. Free books lead with the download; every book
                with a Rokomari page gets the buy CTA beside it. */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {isFree && (
                <DownloadButton
                  pdfUrl={book.pdfUrl}
                  pdfSizeMB={book.pdfSizeMB}
                  slug={book.slug}
                  buyHref={buyHref}
                />
              )}
              {canDownload && !book.pdfUrl && (
                <DownloadButton pdfUrl={null} pdfSizeMB={null} slug={book.slug} buyHref={null} />
              )}
              {buyHref && (
                <BuyButton
                  href={buyHref}
                  slug={book.slug}
                  slot="above-fold"
                  priceTaka={freshPrice}
                />
              )}
              {canRead && (
                <Link
                  href={`/book/${book.slug}/read/${book.chapters[0].slug}`}
                  className="btn-secondary w-full sm:w-auto"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path
                      d="M10 4.5C8 3 5.5 2.8 3 3.2v12.6c2.5-.4 5-.2 7 1.2 2-1.4 4.5-1.6 7-1.2V3.2c-2.5-.4-5-.2-7 1.3zm0 0v12.4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  অনলাইনে পড়ুন
                </Link>
              )}
            </div>

            {/* Affiliate disclosure sits with the FIRST buy control, always —
                intent to earn is what triggers the duty to disclose. */}
            {buyHref && <p className="mt-3 text-xs text-ink-muted">{AFFILIATE_DISCLOSURE}</p>}

            {/* The rights line under the actions, in words. Tier B carries its
                licence link (most CC licences require naming the licence);
                Tier C carries the permission attribution it was granted under. */}
            {book.rightsTier === "open-licence" && book.licenceName && (
              <p className="mt-2 text-xs text-ink-muted">
                লাইসেন্স:{" "}
                {book.licenceUrl ? (
                  <a
                    href={book.licenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-accent"
                  >
                    {book.licenceName}
                  </a>
                ) : (
                  book.licenceName
                )}
              </p>
            )}
            {book.rightsTier === "permitted" && book.permissionNote && (
              <p className="mt-2 text-xs text-ink-muted">{book.permissionNote}</p>
            )}

            {shareUrl && (
              <div className="mt-5 border-t border-rule pt-4">
                <ShareRow url={shareUrl} title={book.title} />
              </div>
            )}
          </div>
        </header>

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          {showAds && (
            <div className="mb-6">
              <AdSlot placement="book-top" minHeight={120} />
            </div>
          )}

          <TableOfContents items={book.toc} />

          {/* সারসংক্ষেপ — always present (a required field). */}
          <section aria-labelledby="synopsis-heading">
            <h2 id="synopsis-heading" className="section-title">
              সারসংক্ষেপ
            </h2>
            <div
              className="prose-book prose mt-3 max-w-none prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: book.synopsisHtml }}
            />
          </section>

          {/* The editorial review — for a Tier D book this IS the page. */}
          {hasText(book.reviewHtml) && (
            <section className="mt-8" aria-labelledby="editorial-review-heading">
              <h2 id="editorial-review-heading" className="section-title">
                রিভিউ
              </h2>
              <div
                className="prose-book prose mt-3 max-w-none prose-p:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: book.reviewHtml }}
              />
            </section>
          )}

          {book.whoShouldRead && (
            <section
              className="mt-8 rounded-xl2 border border-accent/30 bg-accent-soft p-5"
              aria-labelledby="who-heading"
            >
              <h2 id="who-heading" className="text-sm font-bold text-ink">
                কাদের জন্য এই বই
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink">{book.whoShouldRead}</p>
            </section>
          )}

          {book.quotes.length > 0 && (
            <section className="mt-8" aria-labelledby="quotes-heading">
              <h2 id="quotes-heading" className="section-title">
                বই থেকে কিছু লাইন
              </h2>
              <div className="mt-3 space-y-3">
                {book.quotes.map((q) => (
                  <blockquote
                    key={q}
                    className="border-s-4 border-accent/40 ps-4 text-base italic leading-relaxed text-ink"
                  >
                    {q}
                  </blockquote>
                ))}
              </div>
            </section>
          )}

          {/* The printed book's own chapter list — plain text, NOT links.
              Distinct from the reader chapter list below, which links to
              pages that actually exist on this site. */}
          {book.printedToc.length > 0 && (
            <section className="mt-8" aria-labelledby="printed-toc-heading">
              <h2 id="printed-toc-heading" className="section-title">
                সূচিপত্র
              </h2>
              <ol className="mt-3 space-y-1.5 text-sm">
                {book.printedToc.map((entry, i) => (
                  <li
                    key={`${entry.title}-${i}`}
                    className="flex items-baseline justify-between gap-3 border-b border-rule/60 pb-1.5"
                  >
                    <span className="text-ink">{entry.title}</span>
                    {entry.page !== null && (
                      <span className="shrink-0 text-xs text-ink-muted">
                        পৃষ্ঠা {toBengaliNumerals(entry.page)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* The online reader's chapter list — real links, Tier A only
              (chapters is empty for everything else by the data-layer gate). */}
          {canRead && (
            <section className="mt-8" aria-labelledby="read-online-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="read-online-heading" className="section-title">
                  অনলাইনে পড়ুন
                </h2>
                {/* The reader hub. Without a link from here it would be reachable
                    only by trimming a chapter off the address bar, which is how
                    the page it replaced came to 404 unnoticed. */}
                <Link
                  href={`/book/${book.slug}/read`}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  সূচিপত্র ও পড়ার পাতা →
                </Link>
              </div>
              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {book.chapters.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/book/${book.slug}/read/${c.slug}`}
                      className="group flex items-center gap-3 rounded-lg border border-rule bg-surface px-3 py-2.5 transition hover:border-accent"
                    >
                      <span
                        aria-hidden
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-sunken text-xs font-bold text-ink-muted"
                      >
                        {toBengaliNumerals(c.order)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink transition group-hover:text-accent">
                        {c.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {showAds && (
            <div className="my-8">
              <AdSlot placement="book-bottom" minHeight={250} />
            </div>
          )}

          {/* End-of-page buy CTA: the reader who reached the bottom read the
              whole review — the second-warmest click on the page.

              The price is gated on isPriceFresh, like every other ৳ figure on
              the site (BookCard, the list pages). It used to be printed
              unconditionally here and in the above-fold button, so a book whose
              price was last checked a year ago quoted that figure as current.
              A number that disagrees with Rokomari at the moment of the click
              is worse than no number: it is the one claim on the page a reader
              can catch us getting wrong. */}
          {buyHref && (
            <div className="mt-8 rounded-xl2 border border-dashed border-ink/20 bg-surface-sunken p-5 text-center sm:p-6">
              <p className="mx-auto max-w-prose text-sm leading-relaxed text-ink-muted">
                বইটি সংগ্রহে রাখতে চান? রকমারিতে ছাপা কপি পাওয়া যাচ্ছে
                {freshPrice !== null && `, ${formatTaka(freshPrice)}`}।
              </p>
              <div className="mt-4 flex justify-center">
                <BuyButton href={buyHref} slug={book.slug} slot="end-of-page" />
              </div>
            </div>
          )}

          {/* Provenance, at the foot of the page the promise was made about.
              The header already names the LICENCE next to the download control,
              so this one does not repeat it. */}
          <TextSourceNote book={book} className="mt-8" />

          <p className="mt-6 text-xs text-ink-muted">
            সর্বশেষ হালনাগাদ:{" "}
            <time dateTime={book.updatedAt}>{formatBengaliDate(book.updatedAt)}</time>
          </p>
        </div>
      </article>

      <Faq items={book.faqItems} />
    </>
  );
}

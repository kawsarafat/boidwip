import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAllBooks, getBookChapter, safeJsonLd } from "@/lib/data";
import { tierAllowsOnlineReading } from "@/lib/types";
import { buyUrl } from "@/lib/affiliate";
import { chapterTitle } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import ReadingProgress from "@/components/ReadingProgress";
import ReaderSidebar from "@/components/ReaderSidebar";
import TextSourceNote from "@/components/TextSourceNote";
import BuyButton from "@/components/BuyButton";
import AdSlot from "@/components/AdSlot";
import ShareRow from "@/components/ShareRow";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The online reader — one chapter of a Tier A/B book as a clean long-form
 *  reading page.
 *
 *  Chapters exist ONLY for books the rights gate lets through: lib/data.ts
 *  empties the chapter list for anything outside Tier A/B (public-domain and
 *  open-licence — `permitted` books get the PDF, not the reader), and
 *  getBookChapter refuses a chapter whose slug is not in that gated list. So
 *  this route cannot serve copyrighted text even if rows exist for it, and the
 *  sitemap applies the same predicate rather than advertising URLs this route
 *  would refuse.
 *
 *  THE BOOK OUTRANKS THE CHAPTER, in the title and on the page. A chapter name
 *  like "প্রথম পরিচ্ছেদ" is shared by every Bengali novel ever printed: it
 *  matches no query on its own and tells a reader arriving from search nothing
 *  about where they have landed. So the h1 is the BOOK, the chapter is a
 *  subordinate line under it, and lib/seo.ts chapterTitle puts the book first
 *  in the <title> as well. What keeps each of these pages distinct is still the
 *  chapter, which is why it stays in both.
 *
 *  IT HAS A RAIL, and the rail is components/ReaderSidebar, not the site-wide
 *  Sidebar. This file used to say "DELIBERATELY NO SIDEBAR" on the grounds that
 *  a rail of জনপ্রিয় বই is noise beside chapter text. That much is true and
 *  still is — but it threw out the table of contents with the noise, leaving a
 *  reader to walk a forty-chapter novel one prev/next hop at a time, and leaving
 *  each chapter linked only to its two neighbours. ReaderSidebar carries the
 *  chapter list, the book, and the two ways to keep it.
 *
 *  Each chapter page canonicalises to ITSELF — chapters are real, distinct,
 *  indexable documents of public-domain text, each a long-tail search entry. */
export const dynamicParams = false;

export async function generateStaticParams() {
  const books = await getAllBooks();
  // Tier gate restated at the prerender boundary, the same way the sitemap
  // restates it. `dynamicParams = false` means THIS list is the set of chapter
  // URLs that exist at all — anything not returned here answers 404 without
  // running the page — so it is the cheapest and most durable place for the
  // rights gate to be true. See tierAllowsOnlineReading in lib/types.ts, which
  // names this function among its callers.
  return books
    .filter((b) => tierAllowsOnlineReading(b.rightsTier))
    .flatMap((b) => b.chapters.map((c) => ({ slug: b.slug, chapter: c.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}): Promise<Metadata> {
  const { slug, chapter: chapterSlug } = await params;
  const result = await getBookChapter(slug, chapterSlug);
  if (!result) return {};
  const { book, chapter } = result;

  const url = `/book/${slug}/read/${chapterSlug}`;
  const title = chapterTitle({ book: book.title, chapter: chapter.title });
  const author = book.authors.map((a) => a.name).join(", ");
  /* The author moved out of the title (it overran the width Google renders) and
   * into the description, where there is room for it and where it still reaches
   * a searcher scanning the snippet. */
  const description = `${book.title}${author ? ` (${author})` : ""} বইয়ের ${chapter.title} পুরোটা বইদ্বীপে অনলাইনে পড়ুন, সম্পূর্ণ বিনামূল্যে।`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // `article`, not `book`: the thing at this URL is one readable text, the
    // same shape as a blog post. The whole book is /book/<slug>/read.
    openGraph: { title, description, url, type: "article", images: [OG_IMAGE] },
  };
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter: chapterSlug } = await params;
  const result = await getBookChapter(slug, chapterSlug);
  if (!result) notFound();
  const { book, chapter } = result;

  const pageUrl = `${SITE_URL}/book/${slug}/read/${chapterSlug}`;
  const buyHref = buyUrl(book.rokomariUrl);

  // Prev/next from the book's ordered chapter list.
  const index = book.chapters.findIndex((c) => c.slug === chapterSlug);
  const prev = index > 0 ? book.chapters[index - 1] : null;
  const next = index < book.chapters.length - 1 ? book.chapters[index + 1] : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Chapter",
        name: chapter.title,
        url: pageUrl,
        position: chapter.order,
        isPartOf: {
          "@type": "Book",
          name: book.title,
          url: `${SITE_URL}/book/${book.slug}`,
          author: book.authors.map((a) => ({ "@type": "Person", name: a.name })),
        },
        inLanguage: "bn",
        isAccessibleForFree: true,
      },
      {
        "@type": "BreadcrumbList",
        // Mirrors the visible trail exactly, including the reader index in the
        // middle. A JSON-LD trail that skips a level Google can see on the page
        // is a mismatch it reports as one.
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: book.title,
            item: `${SITE_URL}/book/${book.slug}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "অনলাইনে পড়ুন",
            item: `${SITE_URL}/book/${book.slug}/read`,
          },
          { "@type": "ListItem", position: 4, name: chapter.title },
        ],
      },
    ],
  };

  return (
    <>
      <ReadingProgress />
      <div className="shell py-6 sm:py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />

        <Breadcrumb
          items={[
            { label: "হোম", href: "/" },
            { label: book.title, href: `/book/${book.slug}` },
            { label: "অনলাইনে পড়ুন", href: `/book/${book.slug}/read` },
            { label: chapter.title },
          ]}
        />

        {/* Same two-column shell as every other page on the site, so the rail
            lands where a returning reader already expects it. The prose keeps
            its own 65ch measure inside the wider column rather than filling it. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <article className="card overflow-hidden">
              <header className="px-5 pt-6 sm:px-8 sm:pt-8">
                {/* ONE h1 holding both names, the book set dominant over the
                    chapter. Two separate headings would have made the chapter a
                    child of a heading the page never states, and a bare chapter h1
                    (what this was) leaves a reader arriving from search looking at
                    "প্রথম পরিচ্ছেদ" with no idea whose. The book is also a link:
                    every chapter should hand the crawler and the reader the parent
                    in the position they are already looking at. */}
                <h1 className="tracking-tight">
                  <Link
                    href={`/book/${book.slug}`}
                    className="block text-[1.6rem] font-extrabold leading-tight text-ink transition hover:text-accent sm:text-4xl"
                  >
                    {book.title}
                  </Link>
                  <span className="mt-2 block text-base font-semibold leading-snug text-ink-muted sm:text-lg">
                    {chapter.title}
                  </span>
                </h1>

                {book.authors.length > 0 && (
                  <p className="mt-3 text-sm text-ink-muted">
                    {book.authors.map((a, i) => (
                      <span key={a.slug}>
                        {i > 0 && ", "}
                        <Link href={`/author/${a.slug}`} className="hover:text-accent hover:underline">
                          {a.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                  <span>
                    পরিচ্ছেদ {toBengaliNumerals(index + 1)} / {toBengaliNumerals(book.chapters.length)}
                  </span>
                  <span aria-hidden>·</span>
                  <span>পড়তে প্রায় {toBengaliNumerals(chapter.readingTimeMinutes)} মিনিট</span>
                  <span aria-hidden>·</span>
                  <Link href={`/book/${book.slug}/read`} className="font-semibold text-accent hover:underline">
                    সব পরিচ্ছেদ
                  </Link>
                </div>
                <div className="mt-5 border-t border-rule pt-4">
                  <ShareRow url={pageUrl} title={`${book.title} - ${chapter.title}`} />
                </div>
              </header>

              <div className="px-5 pb-6 sm:px-8 sm:pb-8">
                {/* The chapter text. `prose` keeps its own ~65ch measure instead of
                    filling the column: the rail widened this page, and a reading
                    measure that grows with the viewport is the one thing a long-form
                    page must not do. prose-book supplies the colours from the theme
                    tokens, so dark mode needs nothing here. */}
                <div
                  className="prose-book prose mt-6 prose-p:leading-loose"
                  dangerouslySetInnerHTML={{ __html: chapter.bodyHtml }}
                />

                <div className="my-8">
                  <AdSlot placement="reader" minHeight={250} />
                </div>

                {/* Prev / next — the reader's primary navigation. One column on
                    phones so each target is a full-width row (two 50%-width cards
                    with Bengali titles line-clamped to nothing legible was the
                    worst of both), two from `sm` where the row has the width to
                    keep the two ends apart. The spacer only exists to hold a grid
                    column open when just one neighbour exists, so it is hidden at
                    the breakpoint where there is only one column anyway. */}
                <nav aria-label="পরিচ্ছেদ নেভিগেশন" className="grid gap-3 sm:grid-cols-2">
                  {prev ? (
                    <Link
                      href={`/book/${book.slug}/read/${prev.slug}`}
                      className="group rounded-lg border border-rule bg-surface p-3 transition hover:border-accent"
                    >
                      <span className="text-xs text-ink-muted">← আগের পরিচ্ছেদ</span>
                      <span className="mt-1 line-clamp-1 block text-sm font-semibold text-ink transition group-hover:text-accent">
                        {prev.title}
                      </span>
                    </Link>
                  ) : (
                    <span aria-hidden className="hidden sm:block" />
                  )}
                  {next ? (
                    <Link
                      href={`/book/${book.slug}/read/${next.slug}`}
                      className="group rounded-lg border border-rule bg-surface p-3 transition hover:border-accent sm:text-right"
                    >
                      <span className="text-xs text-ink-muted">পরের পরিচ্ছেদ →</span>
                      <span className="mt-1 line-clamp-1 block text-sm font-semibold text-ink transition group-hover:text-accent">
                        {next.title}
                      </span>
                    </Link>
                  ) : (
                    <span aria-hidden className="hidden sm:block" />
                  )}
                </nav>

                <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold">
                  <Link href={`/book/${book.slug}/read`} className="text-accent hover:underline">
                    সব পরিচ্ছেদের তালিকা
                  </Link>
                  <Link href={`/book/${book.slug}`} className="text-accent hover:underline">
                    বইয়ের পাতা ও PDF ডাউনলোড
                  </Link>
                </div>

                {/* One quiet buy prompt at the end of the text — the "reader"
                    slot. No sticky bar, no interruption mid-chapter. */}
                {buyHref && (
                  <div className="mt-8 rounded-xl2 border border-dashed border-ink/20 bg-surface-sunken p-5 text-center">
                    <p className="mx-auto max-w-prose text-sm leading-relaxed text-ink-muted">
                      স্ক্রিনে পড়া ক্লান্তিকর লাগছে? বইটির ছাপা কপি সংগ্রহ করুন।
                    </p>
                    <div className="mt-4 flex justify-center">
                      <BuyButton href={buyHref} slug={book.slug} slot="reader" />
                    </div>
                  </div>
                )}
                {/* Provenance under the text itself. `includeLicence` because
                    the reader is the one place a Tier B book is served without
                    the book page's header nearby to name its licence, and most
                    CC licences require naming wherever the work appears. */}
                <TextSourceNote book={book} includeLicence className="mt-8" />
              </div>
            </article>
          </div>

          <ReaderSidebar book={book} current={chapterSlug} />
        </div>
      </div>
    </>
  );
}

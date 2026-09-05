import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAllBooks, getBook, safeJsonLd } from "@/lib/data";
import { tierAllowsOnlineReading, tierAllowsDelivery, readingMinutes } from "@/lib/types";
import { readerIndexTitle } from "@/lib/seo";
import { bengaliGenitive } from "@/lib/bengali";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import ReaderSidebar from "@/components/ReaderSidebar";
import CoverImage from "@/components/CoverImage";
import AdSlot from "@/components/AdSlot";
import TextSourceNote from "@/components/TextSourceNote";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The reader's table of contents — `/book/<slug>/read`.
 *
 *  WHY THIS FILE EXISTS. Every chapter lives under this URL and this URL used to
 *  404: a reader who trimmed the chapter off the address to look for the contents
 *  hit a dead end, and a crawler saw a set of indexable chapter documents hanging
 *  off a parent that answered 404. That is the worst possible shape for a
 *  hierarchy, and because `dynamicParams = false` makes generateStaticParams the
 *  definition of which URLs exist at all, the fix is a real page rather than a
 *  rewrite.
 *
 *  IT IS NOT A DOORWAY. The page carries something no chapter does — the whole
 *  book's structure, its length in words and reading time, and the file/print
 *  routes out — and it is the hub every chapter links back to. A bare list of
 *  links with a keyword-stuffed title would be the doorway version of this; the
 *  chapter counts, word counts and per-chapter reading times are the substance
 *  that keeps it from being one.
 *
 *  The tier gate is restated here for the same reason the chapter route restates
 *  it: this list of params IS the set of URLs the site admits to having. */
export const dynamicParams = false;

export async function generateStaticParams() {
  const books = await getAllBooks();
  // Tier A/B only, and only when chapters actually exist: a book with an empty
  // chapter list has no table of contents to show, so the URL should stay a 404
  // rather than resolve to an empty page.
  return books
    .filter((b) => tierAllowsOnlineReading(b.rightsTier) && b.chapters.length > 0)
    .map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) return {};

  const title = readerIndexTitle(book.title, book.chapters.length);
  const author = book.authors.map((a) => a.name).join(", ");
  const description = `${book.title}${author ? ` (${author})` : ""} বইয়ের ${toBengaliNumerals(book.chapters.length)}টি পরিচ্ছেদ বইদ্বীপে বিনামূল্যে অনলাইনে পড়ুন। যেকোনো পরিচ্ছেদ থেকে শুরু করুন।`;
  const url = `/book/${book.slug}/read`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // Same subject as /book/<slug>, so the same og:type. The two pages differ
    // in what they offer a reader, not in what they are about.
    openGraph: { title, description, url, type: "book", images: [OG_IMAGE] },
  };
}

export default async function ReaderIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBook(slug);
  /* Two conditions, one answer. The tier gate is repeated from
   * generateStaticParams because a build is not the only way this function can
   * be reached (a preview, a future revalidate), and a page that renders public
   * -domain chapter links for a book outside Tier A/B is exactly what the gate
   * exists to prevent. */
  if (!book || !tierAllowsOnlineReading(book.rightsTier) || book.chapters.length === 0) {
    notFound();
  }

  const url = `${SITE_URL}/book/${book.slug}/read`;
  const totalWords = book.chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const totalMinutes = readingMinutes(totalWords);
  const canDownload = tierAllowsDelivery(book.rightsTier) && Boolean(book.pdfUrl);

  const crumbs = [
    { label: "হোম", href: "/" },
    { label: book.title, href: `/book/${book.slug}` },
    { label: "অনলাইনে পড়ুন" },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        /* The page is about the book, so it is a Book node with a
         * hasPart/ItemList of its chapters rather than a bare CollectionPage.
         * `isAccessibleForFree` is the honest claim here: the reader is free,
         * which is the whole reason this hierarchy is indexable. */
        "@type": "Book",
        "@id": `${url}#book`,
        name: book.title,
        url: `${SITE_URL}/book/${book.slug}`,
        inLanguage: "bn",
        isAccessibleForFree: true,
        ...(book.authors.length > 0
          ? { author: book.authors.map((a) => ({ "@type": "Person", name: a.name })) }
          : {}),
      },
      {
        "@type": "ItemList",
        name: `${bengaliGenitive(book.title)} সব পরিচ্ছেদ`,
        // Chapter order is the book's order, not an arbitrary ranking.
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: book.chapters.length,
        itemListElement: book.chapters.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.title,
          url: `${SITE_URL}/book/${book.slug}/read/${c.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.label,
          ...(c.href ? { item: `${SITE_URL}${c.href === "/" ? "" : c.href}` } : {}),
        })),
      },
    ],
  };

  return (
    <div className="shell py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Breadcrumb items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Link
                href={`/book/${book.slug}`}
                aria-label={`${book.title} বইয়ের পাতা`}
                className="relative block aspect-cover w-28 shrink-0 self-center overflow-hidden rounded-lg border border-rule bg-surface-sunken shadow-card sm:self-start"
              >
                <CoverImage src={book.coverImage} sizes="112px" className="object-cover" priority />
              </Link>

              <div className="min-w-0">
                {/* The BOOK is the h1 here, with the page's purpose as the line
                    under it. This URL is the book's reading hub, not a document
                    of its own, so a heading like "সব পরিচ্ছেদ" alone would name
                    the furniture instead of the subject. */}
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
                  {book.title}
                </h1>
                <p className="mt-1.5 text-base font-semibold text-ink-muted">
                  অনলাইনে পড়ুন, সব পরিচ্ছেদ
                </p>

                {book.authors.length > 0 && (
                  <p className="mt-2 text-sm text-ink-muted">
                    {book.authors.map((a, i) => (
                      <span key={a.slug}>
                        {i > 0 && ", "}
                        <Link
                          href={`/author/${a.slug}`}
                          className="font-medium hover:text-accent hover:underline"
                        >
                          {a.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="chip">{toBengaliNumerals(book.chapters.length)}টি পরিচ্ছেদ</span>
                  <span className="chip">প্রায় {toBengaliNumerals(totalMinutes)} মিনিট</span>
                  <span className="chip">সম্পূর্ণ বিনামূল্যে</span>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href={`/book/${book.slug}/read/${book.chapters[0].slug}`}
                    className="btn-primary w-full sm:w-auto"
                  >
                    প্রথম পরিচ্ছেদ থেকে পড়া শুরু করুন
                  </Link>
                  <Link href={`/book/${book.slug}`} className="btn-secondary w-full sm:w-auto">
                    {canDownload ? "বইয়ের পাতা ও PDF ডাউনলোড" : "বইয়ের পাতা দেখুন"}
                  </Link>
                </div>
              </div>
            </div>

            {book.summary && (
              <p className="mt-6 border-t border-rule pt-5 text-sm leading-relaxed text-ink-muted">
                {book.summary}
              </p>
            )}
          </header>

          {/* The contents proper. An <ol> of real links, one row per chapter,
              each carrying its own length so a reader can pick a chapter that
              fits the time they have. This is what the page has that no chapter
              page does, and what keeps it from being a bare link farm. */}
          <section className="mt-8" aria-labelledby="toc-heading">
            <h2 id="toc-heading" className="section-title">
              সূচিপত্র
            </h2>
            <ol className="mt-4 space-y-2">
              {book.chapters.map((c, i) => (
                <li key={c.slug}>
                  <Link
                    href={`/book/${book.slug}/read/${c.slug}`}
                    className="group flex items-center gap-4 rounded-xl2 border border-rule bg-surface px-4 py-3 transition hover:border-accent hover:shadow-card"
                  >
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-sm font-bold text-ink-muted transition group-hover:bg-accent group-hover:text-on-accent"
                    >
                      {toBengaliNumerals(i + 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem] font-semibold text-ink transition group-hover:text-accent">
                        {c.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {toBengaliNumerals(c.wordCount)} শব্দ, প্রায়{" "}
                        {toBengaliNumerals(readingMinutes(c.wordCount))} মিনিট
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-ink-muted transition group-hover:text-accent"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Same footnote as every chapter page carries, for the reader who
              landed on the contents rather than on chapter one. */}
          <TextSourceNote book={book} includeLicence className="mt-8" />

          <div className="mt-10">
            <AdSlot placement="reader" minHeight={250} />
          </div>
        </div>

        <ReaderSidebar book={book} />
      </div>
    </div>
  );
}

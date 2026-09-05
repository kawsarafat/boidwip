import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllBooks, getBook, getRelatedBooks, safeJsonLd } from "@/lib/data";
import { tierAllowsDelivery } from "@/lib/types";
import { buyUrl } from "@/lib/affiliate";
import { bookTitle, bookDescription } from "@/lib/seo";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookArticle from "@/components/BookArticle";
import BookCard, { BookGrid } from "@/components/BookCard";
import ReviewSection from "@/components/ReviewSection";
import { OG_IMAGE, absoluteMediaUrl } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** How many approved reviews a book needs before its aggregateRating is
 *  emitted in JSON-LD. Three friends averaging 5.0 is not an aggregate
 *  rating, and a rich-result star row built on it is the kind of thing a
 *  manual action is made of. */
const MIN_REVIEWS_FOR_AGGREGATE = 5;

/** A path this build did not prerender is a 404, not a live render.
 *
 *  `dynamicParams` defaults to TRUE, and that default quietly undoes the
 *  whole static model: a book URL missing from generateStaticParams gets
 *  rendered at request time, in a serverless function, against Postgres. The
 *  symptom is a site that half-updates — publish a book without a rebuild
 *  and its own URL serves it while every list still shows the previous
 *  build. It also prices every wrong URL like a real page: getBook builds
 *  the entire store before discovering the slug does not exist. Publishing
 *  means rebuilding (lib/payload/revalidate.ts); a page that has not been
 *  rebuilt is honestly missing until it has. */
export const dynamicParams = false;

export async function generateStaticParams() {
  const books = await getAllBooks();
  return books.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) return {};

  const url = `/book/${slug}`;
  const title = bookTitle(book);
  const description = bookDescription(book);
  // A real cover beats the generic OG banner in every share preview; the
  // default cover would be a worse card than the banner, so it falls back.
  const ogImage = book.hasCustomCover
    ? { url: book.coverImage, width: 800, height: 1200 }
    : OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "book",
      images: [ogImage],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();

  const related = await getRelatedBooks(book, 5);
  const pageUrl = `${SITE_URL}/book/${book.slug}`;
  // Decorated ONCE, on the server, and passed down — see lib/affiliate.ts.
  const buyHref = buyUrl(book.rokomariUrl);
  const isFree = tierAllowsDelivery(book.rightsTier) && Boolean(book.pdfUrl);
  const cover = absoluteMediaUrl(SITE_URL, book.coverImage);

  const crumbs = [
    { label: "হোম", href: "/" },
    ...(book.primaryCategory
      ? [{ label: book.primaryCategory.name, href: `/category/${book.primaryCategory.slug}` }]
      : []),
    { label: book.title },
  ];

  /* ── JSON-LD ──────────────────────────────────────────────────────────
     One @graph: Book (+ workExample for the free PDF), BreadcrumbList, and
     FAQPage when FAQ items exist. Machine-readable values stay ASCII —
     never toBengaliNumerals here (lib/numerals.ts).

     aggregateRating is gated at MIN_REVIEWS_FOR_AGGREGATE approved reviews,
     and the values come from the DENORMALISED pair on the book (updated by
     the Reviews afterChange hook) — never computed at render time. */
  const bookNode: Record<string, unknown> = {
    "@type": "Book",
    "@id": `${pageUrl}#book`,
    name: book.title,
    url: pageUrl,
    inLanguage: "bn",
    author: book.authors.map((a) => ({
      "@type": "Person",
      name: a.name,
      url: `${SITE_URL}/author/${a.slug}`,
    })),
    ...(book.publisher
      ? {
          publisher: {
            "@type": "Organization",
            name: book.publisher.name,
            url: `${SITE_URL}/publisher/${book.publisher.slug}`,
          },
        }
      : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.pageCount ? { numberOfPages: book.pageCount } : {}),
    ...(book.firstPublishedYear ? { datePublished: String(book.firstPublishedYear) } : {}),
    // Absolute, via absoluteMediaUrl. This was the bare `book.coverImage`, which
    // on a local install is the relative "/api/media/file/x.jpg": resolvable by a
    // lenient parser, but Google's structured-data docs ask for a crawlable URL
    // and this is the image property a Book rich result is granted on.
    ...(book.hasCustomCover && cover ? { image: cover } : {}),
    description: book.summary,
    ...(book.ratingCount >= MIN_REVIEWS_FOR_AGGREGATE && book.ratingAverage !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: book.ratingAverage,
            ratingCount: book.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    // The free digital edition, as schema.org models it: a workExample
    // whose potentialAction is the download. Emitted ONLY when the file
    // really is offered — the JSON-LD must never promise what the rights
    // gate withholds.
    ...(isFree
      ? {
          workExample: {
            "@type": "Book",
            bookFormat: "https://schema.org/EBook",
            inLanguage: "bn",
            potentialAction: {
              "@type": "ReadAction",
              target: book.pdfUrl,
            },
            isAccessibleForFree: true,
          },
        }
      : {}),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      bookNode,
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.label,
          ...(c.href ? { item: `${SITE_URL}${c.href === "/" ? "" : c.href}` } : {}),
        })),
      },
      ...(book.faqItems.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: book.faqItems.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="shell py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Breadcrumb items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <BookArticle book={book} buyHref={buyHref} shareUrl={pageUrl} />

          {/* Client-fetched, lazily — see the component header. */}
          <ReviewSection bookSlug={book.slug} />

          {related.length > 0 && (
            <section className="mt-10" aria-labelledby="related-heading">
              <h2 id="related-heading" className="section-title">
                আরও বই
              </h2>
              <div className="mt-4">
                <BookGrid>
                  {related.map((b) => (
                    <BookCard key={b.slug} book={b} />
                  ))}
                </BookGrid>
              </div>
            </section>
          )}
        </div>

        <Sidebar excludeSlug={book.slug} />
      </div>
    </div>
  );
}

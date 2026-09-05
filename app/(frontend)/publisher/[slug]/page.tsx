import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishers, getPublisher, getBooksByPublisher, safeJsonLd } from "@/lib/data";
import { toBookSummary, countFreePdfs, isSafeHttpUrl } from "@/lib/types";
import { publisherTitle, publisherHeading, publisherDescription, isThinEntityPage } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookCard, { BookGrid } from "@/components/BookCard";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE, absoluteMediaUrl } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

export const dynamicParams = false;

export async function generateStaticParams() {
  const publishers = await getPublishers();
  return publishers.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const publisher = await getPublisher(slug);
  if (!publisher) return {};

  /* Counted from the books this page renders, not from the denormalised fields,
     so the figures in the snippet are checkable against the grid below. Same
     expression as the page body, for the reason countFreePdfs exists. */
  const books = await getBooksByPublisher(publisher.slug);
  const freePdfCount = countFreePdfs(books);
  const title = publisherTitle({ name: publisher.name, freePdfCount });
  const description = publisherDescription({
    ...publisher,
    bookCount: books.length,
    freePdfCount,
  });
  const url = `/publisher/${publisher.slug}`;
  // Publishers have no bio field; the description word count plays the same
  // role in the thin-page decision. A publisher page with one book and no
  // description is exactly as doorway-shaped as the author equivalent.
  const descWords = publisher.descriptionHtml
    ? publisher.descriptionHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length
    : 0;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: [OG_IMAGE] },
    ...(isThinEntityPage(publisher.bookCount, descWords)
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export default async function PublisherPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const publisher = await getPublisher(slug);
  if (!publisher) notFound();

  const books = await getBooksByPublisher(publisher.slug);
  const url = `${SITE_URL}/publisher/${publisher.slug}`;
  const freeCount = countFreePdfs(books);
  const website =
    publisher.website && isSafeHttpUrl(publisher.website) ? publisher.website : null;
  // Relative locally, already absolute once R2 is configured — see
  // absoluteMediaUrl. A bare SITE_URL prefix broke the production URL.
  const logo = absoluteMediaUrl(SITE_URL, publisher.logo);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}#org`,
        name: publisher.name,
        url,
        ...(logo ? { logo } : {}),
        ...(website ? { sameAs: [website] } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: publisher.name, item: url },
        ],
      },
      ...(books.length > 0
        ? [
            {
              "@type": "ItemList",
              name: `${publisher.name} প্রকাশিত বই`,
              numberOfItems: books.length,
              itemListElement: books.map((b, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: b.title,
                url: `${SITE_URL}/book/${b.slug}`,
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

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: publisher.name }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <div className="flex items-start gap-5">
              {publisher.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={publisher.logo}
                  alt={publisher.name}
                  width={72}
                  height={72}
                  className="h-16 w-16 shrink-0 rounded-lg border border-rule bg-surface object-contain p-1.5"
                />
              )}
              <div className="min-w-0">
                {/* publisherHeading(), not `${publisher.name} এর বই`: the
                    possessive has to be inflected onto the name, and the h1
                    and the <title> should come from one formula — including the
                    free-PDF branch, so freeCount is the count the grid below
                    actually renders rather than the denormalised field. */}
                <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                  {publisherHeading({ name: publisher.name, freePdfCount: freeCount })}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="chip">{toBengaliNumerals(books.length)}টি বই</span>
                  {freeCount > 0 && (
                    <span className="chip">{toBengaliNumerals(freeCount)}টি ফ্রি PDF</span>
                  )}
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chip hover:text-accent"
                    >
                      ওয়েবসাইট ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            {publisher.descriptionHtml && (
              <div
                className="prose-book mt-5 max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: publisher.descriptionHtml }}
              />
            )}
          </header>

          {books.length === 0 ? (
            <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
              এই প্রকাশনীর বইগুলো শীঘ্রই যুক্ত করা হবে।
            </p>
          ) : (
            <section className="mt-8" aria-labelledby="books-heading">
              <h2 id="books-heading" className="section-title">
                সব বই
              </h2>
              <div className="mt-4">
                <BookGrid>
                  {books.map((b, i) => (
                    <BookCard key={b.slug} book={toBookSummary(b)} priority={i === 0} />
                  ))}
                </BookGrid>
              </div>
            </section>
          )}

          <div className="mt-10">
            <AdSlot placement="listing" minHeight={250} />
          </div>
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

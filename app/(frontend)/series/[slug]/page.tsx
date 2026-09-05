import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllSeries, getSeries, getBooksBySeries, safeJsonLd } from "@/lib/data";
import { toBookSummary, countFreePdfs } from "@/lib/types";
import { seriesTitle, seriesHeading, freePdfClause } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookCard, { BookGrid } from "@/components/BookCard";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

export const dynamicParams = false;

export async function generateStaticParams() {
  const series = await getAllSeries();
  return series.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeries(slug);
  if (!series) return {};

  /* bookCount is recomputed from the published set on every build (lib/data.ts
   * countFor), not read from a denormalised field that can lag a publish, so
   * the count in the title is checkable against the grid below it. */
  const title = seriesTitle(series.name, series.bookCount);
  /* The free-PDF promise goes through freePdfClause: this line used to state
   * "ফ্রি PDF" unconditionally, so a series of in-copyright books advertised a
   * download it has none of — the one thing lib/seo.ts is arranged to prevent. */
  const books = await getBooksBySeries(series.slug);
  const description = `${series.name} সিরিজের ${toBengaliNumerals(books.length)}টি বই পড়ার সঠিক ক্রমে। ${freePdfClause(countFreePdfs(books))}রিভিউ ও কেনার লিংক বইদ্বীপে।`;
  const url = `/series/${series.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: [OG_IMAGE] },
  };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const series = await getSeries(slug);
  if (!series) notFound();

  // Already sorted by series position in the data layer — the whole value of
  // a series page is the reading ORDER, so the grid must not re-sort it.
  const books = await getBooksBySeries(series.slug);
  const url = `${SITE_URL}/series/${series.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BookSeries",
        "@id": `${url}#series`,
        name: series.name,
        url,
        inLanguage: "bn",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: series.name, item: url },
        ],
      },
      ...(books.length > 0
        ? [
            {
              "@type": "ItemList",
              // Order carries meaning here, unlike the unordered hub lists.
              itemListOrder: "https://schema.org/ItemListOrderAscending",
              name: `${series.name} সিরিজের বই`,
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

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: series.name }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {seriesHeading(series.name)}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="chip">{toBengaliNumerals(books.length)}টি বই</span>
              <span className="chip">পড়ার ক্রম অনুযায়ী সাজানো</span>
            </div>
            {series.descriptionHtml && (
              <div
                className="prose-book mt-4 max-w-2xl text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: series.descriptionHtml }}
              />
            )}
          </header>

          {books.length === 0 ? (
            <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
              এই সিরিজের বইগুলো শীঘ্রই যুক্ত করা হবে।
            </p>
          ) : (
            /* BookGrid IS the <ol> here. The grid used to sit inside an <ol> the
               page supplied, with the <li> children two levels down — an <ol>
               may contain only <li>, so that was a parse error at every card. */
            <div className="mt-8">
              <BookGrid ordered label={`${series.name} সিরিজের বই ক্রমানুসারে`}>
                {books.map((b, i) => (
                  <li key={b.slug} className="relative list-none">
                    <span
                      aria-hidden
                      className="absolute -left-1 -top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent shadow"
                    >
                      {toBengaliNumerals(b.series?.position ?? i + 1)}
                    </span>
                    <BookCard book={toBookSummary(b)} priority={i === 0} />
                  </li>
                ))}
              </BookGrid>
            </div>
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

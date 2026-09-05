import type { Metadata } from "next";
import { getAllSeries, safeJsonLd } from "@/lib/data";
import { htmlToPlainText } from "@/lib/types";
import { SERIES_INDEX_SUBJECT, seriesIndexTitle, SITE_NAME } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import EntityHubGrid, { type HubCard } from "@/components/EntityHubGrid";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The সিরিজ hub — the last of the five parents that 404'd; see
 *  app/(frontend)/list/page.tsx.
 *
 *  THE BOOK TOTAL IS HONEST HERE, unlike on /category. A book's `series` is a
 *  single relationship (collections/Books.ts), not hasMany, so no book can be
 *  counted by two series and summing bookCount cannot overstate the catalogue.
 *
 *  ORDER IS BY SIZE, not by name. Reading ORDER matters inside a series and is
 *  what /series/<slug> is arranged around; between series it means nothing, so
 *  the longest one leads. */
const SUBLINE_CHARS = 90;

const DESCRIPTION =
  "বাংলা বইয়ের সিরিজগুলো এক জায়গায়: প্রতিটি সিরিজের সব বই ক্রম অনুযায়ী সাজানো, সাথে রিভিউ, দাম ও ফ্রি PDF।";

export async function generateMetadata(): Promise<Metadata> {
  const series = await getAllSeries();
  const title = seriesIndexTitle(series.length);
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/series" },
    openGraph: { title, description: DESCRIPTION, url: "/series", type: "website", images: [OG_IMAGE] },
    ...(series.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SeriesIndexPage() {
  const series = await getAllSeries();

  const ordered = [...series].sort(
    (a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name, "bn"),
  );

  const cards: HubCard[] = ordered.map((s) => ({
    href: `/series/${s.slug}`,
    name: s.name,
    subline: htmlToPlainText(s.descriptionHtml).slice(0, SUBLINE_CHARS) || null,
    chips: s.bookCount > 0 ? [`${toBengaliNumerals(s.bookCount)}টি বই`] : [],
  }));

  const totalBooks = ordered.reduce((sum, s) => sum + s.bookCount, 0);

  const url = `${SITE_URL}/series`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: SERIES_INDEX_SUBJECT,
        description: DESCRIPTION,
        url,
        inLanguage: "bn",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        ...(ordered.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: ordered.length,
                itemListElement: ordered.map((s, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  // #series is the @id /series/<slug> declares for itself.
                  item: {
                    "@type": "BookSeries",
                    "@id": `${SITE_URL}/series/${s.slug}#series`,
                    name: s.name,
                    url: `${SITE_URL}/series/${s.slug}`,
                    numberOfItems: s.bookCount,
                  },
                })),
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: SERIES_INDEX_SUBJECT, item: url },
        ],
      },
    ],
  };

  return (
    <div className="shell py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: SERIES_INDEX_SUBJECT }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {SERIES_INDEX_SUBJECT}
            </h1>
            {ordered.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{toBengaliNumerals(ordered.length)}টি সিরিজ</span>
                <span className="chip">{toBengaliNumerals(totalBooks)}টি বই</span>
              </div>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
              {DESCRIPTION}
            </p>
          </header>

          <EntityHubGrid cards={cards} emptyMessage="সিরিজগুলো শীঘ্রই যোগ হবে।" />

          <div className="mt-10">
            <AdSlot placement="listing" minHeight={250} />
          </div>
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getPublishers, safeJsonLd } from "@/lib/data";
import { htmlToPlainText } from "@/lib/types";
import { PUBLISHER_INDEX_SUBJECT, publisherIndexTitle, SITE_NAME } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import EntityHubGrid, { type HubCard } from "@/components/EntityHubGrid";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The প্রকাশনী hub. Fourth of the five parents that 404'd; see
 *  app/(frontend)/list/page.tsx for the shape of the defect.
 *
 *  THIN PUBLISHERS ARE LISTED HERE TOO, on the same reasoning as /author: their
 *  own pages carry noindex and the sitemap holds those URLs back, but the hub is
 *  how a reader — and a crawler following `follow` links — reaches a publisher
 *  that is real and simply not written up yet.
 *
 *  imageStyle="logo": a wordmark cropped into a circle loses the word. */
const SUBLINE_CHARS = 90;

const DESCRIPTION =
  "বাংলা বইয়ের প্রকাশনীগুলোর তালিকা: প্রতিটি প্রকাশকের পরিচিতি আর এই সাইটে থাকা তাদের সব বই এক জায়গায়, রিভিউ, দাম ও ফ্রি PDF সহ।";

export async function generateMetadata(): Promise<Metadata> {
  const publishers = await getPublishers();
  const title = publisherIndexTitle(publishers.length);
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/publisher" },
    openGraph: { title, description: DESCRIPTION, url: "/publisher", type: "website", images: [OG_IMAGE] },
    ...(publishers.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function PublisherIndexPage() {
  const publishers = await getPublishers();

  const ordered = [...publishers].sort(
    (a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name, "bn"),
  );

  const cards: HubCard[] = ordered.map((p) => ({
    href: `/publisher/${p.slug}`,
    name: p.name,
    subline: htmlToPlainText(p.descriptionHtml).slice(0, SUBLINE_CHARS) || null,
    chips: p.bookCount > 0 ? [`${toBengaliNumerals(p.bookCount)}টি বই`] : [],
    image: p.logo,
    freePdfCount: p.freePdfCount,
  }));

  const totalBooks = ordered.reduce((sum, p) => sum + p.bookCount, 0);
  const totalFreePdfs = ordered.reduce((sum, p) => sum + p.freePdfCount, 0);

  const url = `${SITE_URL}/publisher`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: PUBLISHER_INDEX_SUBJECT,
        description: DESCRIPTION,
        url,
        inLanguage: "bn",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        ...(ordered.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: ordered.length,
                itemListElement: ordered.map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  // #org is the @id /publisher/<slug> declares for itself, so
                  // both documents describe one Organization.
                  item: {
                    "@type": "Organization",
                    "@id": `${SITE_URL}/publisher/${p.slug}#org`,
                    name: p.name,
                    url: `${SITE_URL}/publisher/${p.slug}`,
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
          { "@type": "ListItem", position: 2, name: PUBLISHER_INDEX_SUBJECT, item: url },
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

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: PUBLISHER_INDEX_SUBJECT }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {PUBLISHER_INDEX_SUBJECT}
            </h1>
            {ordered.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{toBengaliNumerals(ordered.length)}টি প্রকাশনী</span>
                <span className="chip">{toBengaliNumerals(totalBooks)}টি বই</span>
                {totalFreePdfs > 0 && (
                  <span className="chip bg-download/10 font-semibold text-download">
                    {toBengaliNumerals(totalFreePdfs)}টি ফ্রি PDF
                  </span>
                )}
              </div>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
              {DESCRIPTION}
            </p>
          </header>

          <EntityHubGrid
            cards={cards}
            imageStyle="logo"
            emptyMessage="প্রকাশনীগুলো শীঘ্রই যোগ হবে।"
          />

          <div className="mt-10">
            <AdSlot placement="listing" minHeight={250} />
          </div>
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

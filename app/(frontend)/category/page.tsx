import type { Metadata } from "next";
import { getCategories, safeJsonLd } from "@/lib/data";
import { CATEGORY_INDEX_SUBJECT, categoryIndexTitle, SITE_NAME } from "@/lib/seo";
import { bengaliGenitive } from "@/lib/bengali";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import EntityHubGrid, { type HubCard } from "@/components/EntityHubGrid";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The বিষয় hub. One of the four siblings of /list that 404'd while every
 *  /category/<slug> under it resolved; see app/(frontend)/list/page.tsx.
 *
 *  FLAT, NOT A TREE. Categories have a parent, so this could nest. It does not:
 *  the tree is two levels deep at most and a reader scanning for a genre wants
 *  the biggest genres first, not "প্রেমের উপন্যাস" hidden inside "উপন্যাস". A
 *  subcategory's card names its parent on the subline instead, which is the
 *  information nesting would have carried, without pushing the small genres off
 *  the first screen.
 *
 *  NO NOINDEX ARM PER CATEGORY. Unlike authors and publishers, category pages
 *  are not held to the thin-page rule anywhere in this codebase (the sitemap
 *  lists them all), so this hub has nothing to hold back either. */
const DESCRIPTION =
  "বিষয় অনুযায়ী বাংলা বই খুঁজুন: উপন্যাস, গল্প, কবিতা, ইতিহাস, ধর্ম আর আরও অনেক বিভাগ। প্রতিটি বিষয়ে বইয়ের রিভিউ, দাম ও ফ্রি PDF এক জায়গায়।";

export async function generateMetadata(): Promise<Metadata> {
  const categories = await getCategories();
  const title = categoryIndexTitle(categories.length);
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/category" },
    openGraph: { title, description: DESCRIPTION, url: "/category", type: "website", images: [OG_IMAGE] },
    ...(categories.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CategoryIndexPage() {
  const categories = await getCategories();

  const ordered = [...categories].sort(
    (a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name, "bn"),
  );

  const cards: HubCard[] = ordered.map((c) => ({
    href: `/category/${c.slug}`,
    name: c.name,
    // "উপন্যাসের উপবিভাগ" — inflected by bengaliGenitive rather than by
    // splicing on a suffix, the same helper /category/<slug> uses for its
    // ItemList name.
    subline: c.parent ? `${bengaliGenitive(c.parent.name)} উপবিভাগ` : null,
    chips: c.bookCount > 0 ? [`${toBengaliNumerals(c.bookCount)}টি বই`] : [],
  }));

  const url = `${SITE_URL}/category`;
  /* Books, not categories: a book in both "উপন্যাস" and "প্রেমের উপন্যাস" would
     be counted twice by a sum of bookCount, and a header chip that overstates
     the catalogue is worse than no chip. So the only total shown is the number
     of subjects, which this page can count honestly. */

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: CATEGORY_INDEX_SUBJECT,
        description: DESCRIPTION,
        url,
        inLanguage: "bn",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        ...(ordered.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: ordered.length,
                // Flat name/url ListItems, not `item` nodes with an @id: a
                // category page declares no @id of its own, so inventing one
                // here would assert a node identity nothing else confirms.
                itemListElement: ordered.map((c, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  name: c.name,
                  url: `${SITE_URL}/category/${c.slug}`,
                })),
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: CATEGORY_INDEX_SUBJECT, item: url },
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

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: CATEGORY_INDEX_SUBJECT }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {CATEGORY_INDEX_SUBJECT}
            </h1>
            {ordered.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{toBengaliNumerals(ordered.length)}টি বিষয়</span>
              </div>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
              {DESCRIPTION}
            </p>
          </header>

          <EntityHubGrid cards={cards} emptyMessage="বিষয়গুলো শীঘ্রই যোগ হবে।" />

          <div className="mt-10">
            <AdSlot placement="listing" minHeight={250} />
          </div>
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

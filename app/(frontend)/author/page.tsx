import type { Metadata } from "next";
import { getAuthors, safeJsonLd } from "@/lib/data";
import { AUTHOR_INDEX_SUBJECT, authorIndexTitle, SITE_NAME } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import EntityHubGrid, { type HubCard } from "@/components/EntityHubGrid";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The লেখক hub — the parent /author/<slug> did not have. See the note on
 *  app/(frontend)/list/page.tsx for the shape of the defect; this is one of the
 *  four siblings that had it.
 *
 *  ORDERED BY BOOK COUNT, then by name. An alphabetical hub buries the author
 *  with nine books under one with a single stub, and Bengali collation in
 *  localeCompare is not something to depend on for the primary order. The name
 *  is the tie-break only, where the result is stable rather than meaningful.
 *
 *  THIN AUTHORS ARE STILL LISTED. Their own pages carry noindex (lib/seo.ts) and
 *  the sitemap holds those URLs back, but a reader browsing the hub should see
 *  every author the catalogue has — and the links are `follow`, which is how a
 *  crawler reaches a page that is not yet worth ranking. */
const DESCRIPTION =
  "বাংলা সাহিত্যের লেখকদের তালিকা: প্রত্যেকের পরিচিতি, জীবনকাল আর এই সাইটে থাকা তাদের সব বই এক জায়গায়, রিভিউ ও ফ্রি PDF সহ।";

export async function generateMetadata(): Promise<Metadata> {
  const authors = await getAuthors();
  const title = authorIndexTitle(authors.length);
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/author" },
    openGraph: { title, description: DESCRIPTION, url: "/author", type: "website", images: [OG_IMAGE] },
    ...(authors.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Lifespan, or a bare birth year, or nothing — the same three arms as
 *  /author/<slug>, so the card and the page it opens agree. An en dash, not a
 *  hyphen and not an em dash: it is a range, and AGENTS.md's em-dash rule covers
 *  public strings. */
function lifespan(birthYear: number | null, deathYear: number | null): string | null {
  if (birthYear && deathYear) {
    return `${toBengaliNumerals(birthYear)}–${toBengaliNumerals(deathYear)}`;
  }
  if (birthYear) return `জন্ম ${toBengaliNumerals(birthYear)}`;
  return null;
}

export default async function AuthorIndexPage() {
  const authors = await getAuthors();

  const ordered = [...authors].sort(
    (a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name, "bn"),
  );

  const cards: HubCard[] = ordered.map((a) => ({
    href: `/author/${a.slug}`,
    name: a.name,
    subline: lifespan(a.birthYear, a.deathYear),
    chips: a.bookCount > 0 ? [`${toBengaliNumerals(a.bookCount)}টি বই`] : [],
    image: a.photo,
    freePdfCount: a.freePdfCount,
  }));

  const url = `${SITE_URL}/author`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: AUTHOR_INDEX_SUBJECT,
        description: DESCRIPTION,
        url,
        inLanguage: "bn",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        ...(ordered.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: ordered.length,
                itemListElement: ordered.map((a, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  // The same @id the author's own page declares, so the two
                  // documents describe one Person rather than two.
                  item: {
                    "@type": "Person",
                    "@id": `${SITE_URL}/author/${a.slug}#person`,
                    name: a.name,
                    url: `${SITE_URL}/author/${a.slug}`,
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
          { "@type": "ListItem", position: 2, name: AUTHOR_INDEX_SUBJECT, item: url },
        ],
      },
    ],
  };

  const totalBooks = ordered.reduce((sum, a) => sum + a.bookCount, 0);
  const totalFreePdfs = ordered.reduce((sum, a) => sum + a.freePdfCount, 0);

  return (
    <div className="shell py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: AUTHOR_INDEX_SUBJECT }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            {/* AUTHOR_INDEX_SUBJECT, not a literal: lib/seo.ts builds the
                <title> from the same constant, so the h1 cannot drift from it. */}
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {AUTHOR_INDEX_SUBJECT}
            </h1>
            {ordered.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{toBengaliNumerals(ordered.length)}জন লেখক</span>
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

          <EntityHubGrid cards={cards} emptyMessage="লেখকদের পরিচিতি শীঘ্রই যোগ হবে।" />

          <div className="mt-10">
            <AdSlot placement="listing" minHeight={250} />
          </div>
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

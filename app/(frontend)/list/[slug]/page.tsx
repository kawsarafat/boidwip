import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLists, getList, safeJsonLd } from "@/lib/data";
import { countFreePdfs } from "@/lib/types";
import { curatedListTitle, freePdfClause } from "@/lib/seo";
import { AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import { toBengaliNumerals, formatBengaliDate } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookRow from "@/components/BookRow";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

export const dynamicParams = false;

export async function generateStaticParams() {
  const lists = await getLists();
  return lists.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) return {};

  /* Bare of the site name: the layout's title template appends " | বইদ্বীপ"
     once, to <title> and og:title alike. The count comes from the entries, and
     curatedListTitle declines to add one when the editor already wrote a number
     into the title. */
  const freePdfCount = countFreePdfs(list.entries.map((e) => e.book));
  const title = curatedListTitle(list.title, list.entries.length, freePdfCount);
  const description = `${list.title}: ${toBengaliNumerals(list.entries.length)}টি বাছাই করা বই, প্রতিটির সাথে কেন পড়বেন তার ব্যাখ্যা। ${freePdfClause(freePdfCount)}রিভিউ ও কেনার লিংকসহ।`;
  const url = `/list/${list.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article", images: [OG_IMAGE] },
  };
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) notFound();

  const url = `${SITE_URL}/list/${list.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: list.title,
        url,
        inLanguage: "bn",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: list.entries.length,
        itemListElement: list.entries.map((e, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: e.book.title,
          url: `${SITE_URL}/book/${e.book.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: list.title, item: url },
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

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: list.title }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {list.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="chip">{toBengaliNumerals(list.entries.length)}টি বই</span>
              <span className="chip">{formatBengaliDate(list.publishDate)}</span>
            </div>
            {list.descriptionHtml && (
              <div
                className="prose-book mt-4 max-w-2xl text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: list.descriptionHtml }}
              />
            )}
          </header>

          {/* Numbered rows rather than a cover grid: the editor's note on WHY
              each book is here is the whole point of a curated list, and a
              card grid has no room for it. The row itself is BookRow, shared
              with the blog post page — see the note there on why one copy. */}
          <ol className="mt-8 space-y-5">
            {list.entries.map((entry, i) => (
              <li key={entry.book.slug} className="card p-4 sm:p-5">
                <BookRow
                  book={entry.book}
                  ordinal={i + 1}
                  noteHtml={entry.noteHtml}
                  slot="card-chip"
                  // The page h1 is the list's title, so a book is one level in.
                  headingAs="h2"
                />
              </li>
            ))}
          </ol>

          {/* Below the rows, not above them: the disclosure has to be findable
              beside the buy links (FTC and Google both ask for it near the
              link, not buried in a footer), and a paid-link notice as the first
              thing under an editorial list undercuts the list. */}
          <p className="mt-5 text-xs leading-relaxed text-ink-muted">
            {AFFILIATE_DISCLOSURE}
          </p>

          <div className="mt-10">
            <AdSlot placement="listing" minHeight={250} />
          </div>
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

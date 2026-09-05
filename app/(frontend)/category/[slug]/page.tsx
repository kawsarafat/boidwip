import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getCategory, getBooksByCategory, safeJsonLd } from "@/lib/data";
import { toBookSummary, countFreePdfs, tierAllowsDelivery } from "@/lib/types";
import { categoryTitle, categoryHeading, freePdfClause, CATEGORY_INDEX_SUBJECT } from "@/lib/seo";
import { bengaliGenitive } from "@/lib/bengali";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookCard, { BookGrid } from "@/components/BookCard";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

export const dynamicParams = false;

/** Whether a book on this listing carries a file a reader can actually take.
 *  Used to order the grid; the COUNT of these comes from countFreePdfs in
 *  lib/types.ts, which is the expression every hub title branches on. */
const hasFreePdf = (b: { rightsTier: string; pdfUrl: string | null }): boolean =>
  tierAllowsDelivery(b.rightsTier) && Boolean(b.pdfUrl);

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};

  /* The books are read here as well as in the page body. Both calls hit the
   * per-worker store lib/data.ts already holds, so this costs a filter, not a
   * query — and it is what lets the title stop promising a free PDF on a genre
   * that has none. */
  const books = await getBooksByCategory(category.slug);
  const freeCount = countFreePdfs(books);
  const title = categoryTitle(category.name, books.length, freeCount);
  const owner = bengaliGenitive(category.name);
  /* One sentence, not two arms. The free-PDF promise is the only part that
     branches, and freePdfClause owns that branch so a genre with no downloadable
     book cannot advertise one here. */
  const description = `${owner} ${toBengaliNumerals(books.length)}টি বাংলা বই: ${freePdfClause(freeCount)}রিভিউ, রেটিং, দাম ও কেনার লিংক বইদ্বীপে।`;
  const url = `/category/${category.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: [OG_IMAGE] },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const books = await getBooksByCategory(category.slug);
  const url = `${SITE_URL}/category/${category.slug}`;
  const freeCount = countFreePdfs(books);
  const heading = categoryHeading(category.name);

  // Free-PDF books lead the grid: the reader who typed "<genre> বই PDF" into
  // Google should not have to scroll past ten buy-only cards to find one.
  const sorted = [...books.filter(hasFreePdf), ...books.filter((b) => !hasFreePdf(b))];

  const crumbs = [
    { label: "হোম", href: "/" },
    // The subject hub sits between home and the genre. It 404'd until now,
    // which is why the trail started at the root.
    { label: CATEGORY_INDEX_SUBJECT, href: "/category" },
    ...(category.parent
      ? [{ label: category.parent.name, href: `/category/${category.parent.slug}` }]
      : []),
    { label: category.name },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: heading,
        url,
        inLanguage: "bn",
        about: category.name,
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
      ...(sorted.length > 0
        ? [
            {
              "@type": "ItemList",
              // Inflects "উপন্যাসের বই" -> "উপন্যাসের বইয়ের", rather than
              // splicing the suffix on by hand and hard-coding what বই does.
              name: `${bengaliGenitive(heading)} তালিকা`,
              numberOfItems: sorted.length,
              itemListElement: sorted.map((b, i) => ({
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

      <Breadcrumb items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {heading}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="chip">{toBengaliNumerals(books.length)}টি বই</span>
              {freeCount > 0 && (
                <span className="chip">{toBengaliNumerals(freeCount)}টি ফ্রি PDF</span>
              )}
            </div>
            {category.descriptionHtml && (
              <div
                className="prose-book mt-4 max-w-2xl text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: category.descriptionHtml }}
              />
            )}
          </header>

          {sorted.length === 0 ? (
            <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
              এই বিভাগের বইগুলো শীঘ্রই যুক্ত করা হবে।
            </p>
          ) : (
            <div className="mt-8">
              {/* BookCard's title is an h3, so without an h2 for the grid every
                  category page jumps h1 -> h3. Hidden rather than visible: the
                  h1 already names the category and the chips give the count.
                  Same fix as SearchClient's results region. */}
              <h2 className="sr-only">এই বিভাগের বইয়ের তালিকা</h2>
              <BookGrid>
                {sorted.map((b, i) => (
                  <BookCard key={b.slug} book={toBookSummary(b)} priority={i === 0} />
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

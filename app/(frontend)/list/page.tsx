import type { Metadata } from "next";
import Link from "next/link";
import { getLists, safeJsonLd } from "@/lib/data";
import { countFreePdfs, htmlToPlainText } from "@/lib/types";
import { LIST_SUBJECT, listIndexTitle, SITE_NAME } from "@/lib/seo";
import { toBengaliNumerals, formatBengaliDate } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import CoverImage from "@/components/CoverImage";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The তালিকা hub: the parent of every /list/<slug>.
 *
 *  WHY IT EXISTS AT ALL. It did not, and /list returned 404 while every list
 *  under it resolved — the same broken hierarchy /book/<slug>/read was written
 *  to fix. A reader who trimmed a slug off the address to see the other lists
 *  got a dead end, the footer's three list links were the only path into the
 *  whole structure, and a crawler found several strong pages hanging off
 *  nothing. Four sibling hubs had the identical hole; see /author, /category,
 *  /publisher and /series.
 *
 *  WHAT IT IS ARRANGED TO WIN. "বই পড়ার তালিকা" and its variants are the
 *  highest-volume query this site can answer, and a hub ranks for that only if
 *  it is more than a column of links: the covers are the content here, so each
 *  card leads with the books it holds and the count is checkable against them.
 *
 *  NO `dynamicParams` / `generateStaticParams` — there is no [slug]. Like /blog
 *  and /popular, this is one static page built from the store. */

/** How many covers a card shows before it stops. Five fits the narrowest card
 *  at the overlap below without the fan reaching the title, and a list's first
 *  few entries are the ones an editor puts their best books in. */
const COVER_STRIP_LIMIT = 5;

/** Characters of the editor's description a card carries. Cut on a word
 *  boundary by the two-line clamp in CSS; this bound only stops a 900-word
 *  description from shipping in the HTML of every card. */
const EXCERPT_CHARS = 220;

const DESCRIPTION =
  "বিষয়, লেখক আর পড়ার মুড ধরে সাজানো বাছাই করা বইয়ের তালিকা। প্রতিটি তালিকায় প্রতিটি বই কেন পড়বেন তার ব্যাখ্যা, সাথে রিভিউ, ফ্রি PDF ও কেনার লিংক।";

/** generateMetadata rather than a const, for the same reason /blog is: the count
 *  in the title only exists after the lists are read.
 *
 *  AN EMPTY HUB ASKS NOT TO BE INDEXED. Same rule as a thin author page — the
 *  page still renders and is still linked, it just does not ask Google to rank a
 *  heading over nothing. sitemap.ts holds the URL back under the same condition,
 *  so the tag and the sitemap cannot disagree. */
export async function generateMetadata(): Promise<Metadata> {
  const lists = await getLists();
  const title = listIndexTitle(lists.length);
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/list" },
    openGraph: {
      title,
      description: DESCRIPTION,
      url: "/list",
      type: "website",
      images: [OG_IMAGE],
    },
    ...(lists.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ListIndexPage() {
  const lists = await getLists();

  /* Counted from the entries actually rendered, not from a stored field, so
     every figure on the page is checkable against what is under it. */
  const totalBooks = lists.reduce((sum, l) => sum + l.entries.length, 0);
  const totalFreePdfs = lists.reduce(
    (sum, l) => sum + countFreePdfs(l.entries.map((e) => e.book)),
    0,
  );

  const url = `${SITE_URL}/list`;

  /* A CollectionPage whose mainEntity is an ItemList OF ItemLists. The @id of
     each inner item is the one the list's own page declares (`…#list`), so the
     two documents describe the same node instead of two unrelated lists — the
     same joining-up /blog does with isPartOf. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: LIST_SUBJECT,
        description: DESCRIPTION,
        url,
        inLanguage: "bn",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        ...(lists.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: lists.length,
                itemListElement: lists.map((l, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  item: {
                    "@type": "ItemList",
                    "@id": `${SITE_URL}/list/${l.slug}#list`,
                    name: l.title,
                    url: `${SITE_URL}/list/${l.slug}`,
                    numberOfItems: l.entries.length,
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
          { "@type": "ListItem", position: 2, name: LIST_SUBJECT, item: url },
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

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: LIST_SUBJECT }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            {/* LIST_SUBJECT, not a literal: the h1 and the <title> are one
                decision, and lib/seo.ts builds the title from this constant. */}
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {LIST_SUBJECT}
            </h1>
            {lists.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{toBengaliNumerals(lists.length)}টি তালিকা</span>
                <span className="chip">{toBengaliNumerals(totalBooks)}টি বই</span>
                {/* Promised only when the lists actually hold one: the same rule
                    the title formulas follow. A "ফ্রি PDF" chip over buy-only
                    books is the thin-affiliate shape. */}
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

          {lists.length === 0 ? (
            <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
              তালিকাগুলো শীঘ্রই প্রকাশিত হবে।
            </p>
          ) : (
            /* A grid of two, not the single column /blog uses. A তালিকা card is
               mostly covers and a short line, so a full-width row would leave
               half the line empty on a desktop; a blog card is a paragraph and
               would not. Ordered newest first, which the chip states. */
            <ol className="mt-6 grid gap-5 sm:grid-cols-2">
              {lists.map((l) => {
                const freePdfCount = countFreePdfs(l.entries.map((e) => e.book));
                const strip = l.entries.slice(0, COVER_STRIP_LIMIT);
                const hidden = l.entries.length - strip.length;
                const excerpt = htmlToPlainText(l.descriptionHtml).slice(0, EXCERPT_CHARS);

                return (
                  <li key={l.slug}>
                    <article className="card-interactive relative flex h-full flex-col p-4 sm:p-5">
                      {/* The covers, overlapping into a fan. Decorative here:
                          the card's own link already names the list, and every
                          book is named on the page one click away, so a
                          screen reader gets the list title once instead of five
                          titles it cannot act on. */}
                      <div aria-hidden className="flex items-end">
                        {/* No z-index: these are all `relative`, and positioned
                            elements with z-index auto paint in DOM order, so
                            each cover already lands on top of the one before it
                            and the fan reads left to right like the list does. */}
                        {strip.map((e, i) => (
                          <div
                            // Position, not slug: a pending book may not have one
                            // yet, and two empty slugs would collide.
                            key={e.book.slug || `pending-${i}`}
                            className="relative -ml-5 aspect-cover w-14 shrink-0 overflow-hidden rounded-md border border-rule bg-surface-sunken shadow-card first:ml-0 sm:-ml-6 sm:w-16"
                          >
                            <CoverImage
                              src={e.book.coverImage}
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                        {hidden > 0 && (
                          <span className="ml-2 text-xs font-semibold text-ink-muted">
                            +{toBengaliNumerals(hidden)}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-4 text-lg font-bold leading-snug text-ink">
                        {/* The stretched link: the whole card is clickable and
                            the anchor stays one element for assistive tech. */}
                        <Link href={`/list/${l.slug}`} className="after:absolute after:inset-0">
                          {l.title}
                        </Link>
                      </h2>

                      {excerpt && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                          {excerpt}
                        </p>
                      )}

                      {/* mt-auto: the meta row sits on the card's floor, so two
                          cards of different description lengths still line their
                          chips up in the same grid row. */}
                      <div className="mt-auto pt-4 flex flex-wrap items-center gap-2">
                        <span className="chip">{toBengaliNumerals(l.entries.length)}টি বই</span>
                        {freePdfCount > 0 && (
                          <span className="chip bg-download/10 font-semibold text-download">
                            {toBengaliNumerals(freePdfCount)}টি ফ্রি PDF
                          </span>
                        )}
                        <span className="ml-auto text-xs text-ink-muted">
                          {formatBengaliDate(l.publishDate)}
                        </span>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
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

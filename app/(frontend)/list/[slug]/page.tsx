import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getLists, getList, safeJsonLd } from "@/lib/data";
import { countFreePdfs, htmlToPlainText } from "@/lib/types";
import { curatedListTitle, freePdfClause, LIST_SUBJECT } from "@/lib/seo";
import { AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import { toBengaliNumerals, formatBengaliDate } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookRow from "@/components/BookRow";
import CoverImage from "@/components/CoverImage";
import ShareRow from "@/components/ShareRow";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** How many covers the header fan shows. Six reaches the full width of the
 *  narrowest card at the overlap used below without the last cover being a
 *  sliver, and the first few entries are where an editor puts their best. */
const HERO_COVER_LIMIT = 6;

/** Below this many entries the jump index is not offered. Four rows fit on one
 *  phone screen, so a table of contents over them is furniture that costs a tap
 *  and saves nothing. */
const JUMP_NAV_MIN = 5;

/** Other lists offered at the foot of the page. Two, matching the hub's own
 *  two-up grid, and deliberately fewer than the blog's three: the books above
 *  are the links this page most wants followed. */
const RELATED_LIMIT = 2;

/** Characters of a related list's description a card carries. The two-line
 *  clamp does the visible cutting; this only stops a long description shipping
 *  in full inside every page that links to it. */
const RELATED_EXCERPT_CHARS = 160;

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
  const freePdfCount = countFreePdfs(list.entries.map((e) => e.book));
  const heroCovers = list.entries.slice(0, HERO_COVER_LIMIT);

  /* Compared by DAY, not by timestamp. Every list is written and published in
     one sitting, so an exact comparison would put a "হালনাগাদ" chip on every
     page from the moment it went live — a freshness claim that means nothing is
     worse than none, both for a reader deciding whether to trust the prices and
     for a crawler weighing the same signal. */
  const showUpdated = list.updatedAt.slice(0, 10) !== list.publishDate.slice(0, 10);

  /* Other lists, for the foot of the page. getLists() is the same per-worker
     cache generateStaticParams read, so this is a filter and not a query. A
     তালিকা used to be a dead end: the only ways out were a book page or the
     browser's back button, which is how a hub full of otherwise strong pages
     ends up with every one of them one click deep and none of them linked to
     each other. */
  const otherLists = (await getLists())
    .filter((l) => l.slug !== list.slug)
    .slice(0, RELATED_LIMIT);

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
        // A PENDING ENTRY KEEPS ITS position AND name BUT CARRIES NO url. The
        // book has no page in this build, so a url here would be a structured
        // -data link to a 404 — the one thing that turns a rich result into a
        // manual action. Dropping the whole ListItem instead would be worse:
        // numberOfItems would disagree with the array, and the positions of
        // every entry after it would no longer match what the reader sees.
        itemListElement: list.entries.map((e, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: e.book.title,
          ...(e.pending ? {} : { url: `${SITE_URL}/book/${e.book.slug}` }),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          // /list is the parent, and it exists now. The trail used to jump
          // straight from the root to a list title.
          { "@type": "ListItem", position: 2, name: LIST_SUBJECT, item: `${SITE_URL}/list` },
          { "@type": "ListItem", position: 3, name: list.title, item: url },
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

      <Breadcrumb
        items={[
          { label: "হোম", href: "/" },
          { label: LIST_SUBJECT, href: "/list" },
          { label: list.title },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card overflow-hidden">
            {/* The covers of the first few entries, rising out of a tinted band.
                Decorative and aria-hidden: every one of these books is named,
                linked and described a few hundred pixels below, so a screen
                reader gains nothing from six cover labels it cannot act on.

                `overflow-hidden` on the band plus `translate-y` on the covers is
                what crops them at the band's bottom edge — they read as a shelf
                the title sits on rather than as six clipped images. */}
            {heroCovers.length > 0 && (
              <div
                aria-hidden
                className="relative flex items-end overflow-hidden border-b border-rule bg-surface-sunken px-5 pt-6 sm:px-7 sm:pt-7"
              >
                {/* No z-index needed: these are all `relative`, and positioned
                    elements with z-index auto paint in DOM order, so each cover
                    lands on top of the one before it and the fan reads left to
                    right like the list does. */}
                {heroCovers.map((entry, i) => (
                  <div
                    // Position, not slug: a pending book may not have one yet,
                    // and two empty slugs would collide as React keys.
                    key={entry.book.slug || `pending-${i}`}
                    className="relative -ml-6 aspect-cover w-16 shrink-0 translate-y-4 overflow-hidden rounded-t-md border border-rule bg-surface shadow-card first:ml-0 sm:-ml-7 sm:w-20"
                  >
                    <CoverImage
                      src={entry.book.coverImage}
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="p-5 sm:p-7">
              {/* Says what KIND of page this is before it says which one. A
                  reader arriving cold from a search result for a book title
                  needs to know they have landed on a curated list. */}
              <p className="eyebrow">{LIST_SUBJECT}</p>
              <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {list.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="chip">{toBengaliNumerals(list.entries.length)}টি বই</span>
                {/* Promised only when the entries actually hold one — the same
                    rule the title formula follows. A "ফ্রি PDF" chip over
                    buy-only books is the thin-affiliate shape. */}
                {freePdfCount > 0 && (
                  <span className="chip bg-download/10 font-semibold text-download">
                    {toBengaliNumerals(freePdfCount)}টি ফ্রি PDF
                  </span>
                )}
                <span className="chip">{formatBengaliDate(list.publishDate)}</span>
                {showUpdated && (
                  <span className="chip">
                    হালনাগাদ {formatBengaliDate(list.updatedAt)}
                  </span>
                )}
              </div>
              {list.descriptionHtml && (
                /* `prose` alongside `prose-book`, which this wrapper was missing.
                   prose-book only declares the --tw-prose-* colour tokens; the
                   typography that CONSUMES them comes from the plugin's `prose`
                   class, so without it a two-paragraph description rendered with
                   no gap between the paragraphs and no bullets on its lists. */
                <div
                  className="prose-book prose prose-sm mt-4 max-w-2xl"
                  dangerouslySetInnerHTML={{ __html: list.descriptionHtml }}
                />
              )}
            </div>
          </header>

          {/* A jump index, for the long lists this page type exists to hold. Ten
              rows with a paragraph of argument each is four or five phone
              screens, and a reader who came for one title had no way to reach it
              except scrolling past the other nine.

              Plain anchors, so it costs no JavaScript, and every row below now
              carries an id — which also makes a single entry linkable, the thing
              a reader passing "number 4 on this list" to a friend actually
              wants. */}
          {list.entries.length >= JUMP_NAV_MIN && (
            <nav aria-labelledby="list-jump-heading" className="card mt-6 p-4 sm:p-5">
              <h2
                id="list-jump-heading"
                className="text-xs font-bold uppercase tracking-widest text-ink-muted"
              >
                একনজরে
              </h2>
              <ol className="mt-3 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {list.entries.map((entry, i) => (
                  <li key={entry.book.slug || `pending-${i}`}>
                    <a
                      href={`#boi-${i + 1}`}
                      className="flex gap-2.5 py-1.5 text-sm leading-snug text-ink-muted transition hover:text-accent"
                    >
                      <span
                        aria-hidden
                        className="w-4 shrink-0 text-right text-xs font-extrabold leading-5 text-accent"
                      >
                        {toBengaliNumerals(i + 1)}
                      </span>
                      <span className="min-w-0">{entry.book.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Numbered rows rather than a cover grid: the editor's note on WHY
              each book is here is the whole point of a curated list, and a
              card grid has no room for it. The row itself is BookRow, shared
              with the blog post page — see the note there on why one copy. */}
          <ol className="mt-6 space-y-5">
            {list.entries.map((entry, i) => (
              // Keyed on the slug when there is one, on position otherwise: a
              // pending book may have no slug yet (see toPendingBookSummary),
              // and two of them would collide on "" — React would then reuse one
              // row's DOM for the other. The prefix keeps a numeric position from
              // ever colliding with a real slug.
              // The id is what makes a single entry linkable — the thing a
              // reader passing "number 4 on this list" to a friend actually
              // wants — and what the jump nav above targets.
              //
              // NO scroll-mt here, deliberately, and measured: globals.css
              // already sets `html { scroll-padding-top: var(--anchor-offset) }`,
              // which clears the sticky header for every anchor on the site. A
              // scroll-margin on the target ADDS to that padding rather than
              // replacing it — with both, this row landed 232px below the
              // viewport top instead of 116px, leaving a screen-third of empty
              // canvas above the row the reader just asked for.
              <li
                key={entry.book.slug || `pending-${i}`}
                id={`boi-${i + 1}`}
                className="card p-4 sm:p-5"
              >
                <BookRow
                  book={entry.book}
                  ordinal={i + 1}
                  noteHtml={entry.noteHtml}
                  slot="card-chip"
                  // The page h1 is the list's title, so a book is one level in.
                  headingAs="h2"
                  pending={entry.pending}
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

          {/* A curated list is the most shareable page type here — it is what one
              reader passes to another when asked what to read — and this page had
              no way to do it. `url` is the absolute one built above, so the
              sharer links are real hrefs in the HTML rather than something
              assembled from window.location after hydration. */}
          <div className="mt-6 border-t border-rule pt-5">
            <ShareRow url={url} title={list.title} />
          </div>

          <div className="mt-10">
            <AdSlot placement="listing" minHeight={250} />
          </div>

          {/* The way out. A reader who reached the foot of a তালিকা has read the
              argument for every book on it; the next thing they want is another
              list, and until now the only ways off this page were a book link or
              the back button. Two cards, and the block disappears rather than
              rendering an empty heading when this is the only list on the site. */}
          {otherLists.length > 0 && (
            <section aria-labelledby="more-lists-heading" className="mt-10">
              <h2 id="more-lists-heading" className="section-title">
                আরও তালিকা
              </h2>
              <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                {otherLists.map((other) => {
                  const excerpt = htmlToPlainText(other.descriptionHtml).slice(
                    0,
                    RELATED_EXCERPT_CHARS,
                  );
                  const strip = other.entries.slice(0, 3);

                  return (
                    <li key={other.slug}>
                      <article className="card-interactive relative flex h-full flex-col p-4 sm:p-5">
                        {/* Decorative, like the fan on the hub's cards: the
                            stretched link below already names the list, and a
                            screen reader reading three cover labels it cannot
                            act on is noise before the name it can. */}
                        <div aria-hidden className="flex items-end">
                          {strip.map((e, i) => (
                            <div
                              key={e.book.slug || `pending-${i}`}
                              className="relative -ml-5 aspect-cover w-12 shrink-0 overflow-hidden rounded-md border border-rule bg-surface-sunken shadow-card first:ml-0 sm:w-14"
                            >
                              <CoverImage
                                src={e.book.coverImage}
                                sizes="56px"
                                className="object-cover"
                              />
                            </div>
                          ))}
                        </div>

                        <h3 className="mt-3.5 text-base font-bold leading-snug text-ink">
                          {/* Stretched link: the whole card is the target and it
                              stays one anchor for assistive tech. */}
                          <Link
                            href={`/list/${other.slug}`}
                            className="after:absolute after:inset-0"
                          >
                            {other.title}
                          </Link>
                        </h3>

                        {excerpt && (
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                            {excerpt}
                          </p>
                        )}

                        {/* mt-auto so two cards with descriptions of different
                            lengths still line their chips up on one row. */}
                        <div className="mt-auto pt-3.5">
                          <span className="chip">
                            {toBengaliNumerals(other.entries.length)}টি বই
                          </span>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

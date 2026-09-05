import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBlogPosts, getBlogPost, safeJsonLd } from "@/lib/data";
import { countFreePdfs } from "@/lib/types";
import { AFFILIATE_DISCLOSURE } from "@/lib/affiliate";
import { formatBengaliDate, toBengaliNumerals } from "@/lib/numerals";
import { SITE_NAME } from "@/lib/seo";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import TableOfContents from "@/components/TableOfContents";
import ReadingProgress from "@/components/ReadingProgress";
import BookRow from "@/components/BookRow";
import AdSlot from "@/components/AdSlot";
import ShareRow from "@/components/ShareRow";
import { OG_IMAGE, absoluteMediaUrl } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** How many other posts the footer offers. Three fills one row and keeps the
 *  block from competing with the books above it, which are the links this page
 *  most wants followed. */
const RELATED_LIMIT = 3;

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};

  // Bare: the layout's title template appends " | বইদ্বীপ" once, to <title>,
  // og:title and twitter:title alike.
  const title = post.title;
  const url = `/blog/${post.slug}`;
  const ogImage = post.coverImage
    ? { url: post.coverImage, width: 1200, height: 630 }
    : OG_IMAGE;
  return {
    title,
    description: post.summary,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: post.summary,
      url,
      type: "article",
      /* The two dates belong in the tags, not only in the JSON-LD: og:article
         is what a social preview and several aggregators read, and an article
         with no publish time is shown undated wherever the JSON-LD is not
         parsed. Both are ISO strings from the data layer. */
      publishedTime: post.publishDate,
      modifiedTime: post.updatedAt,
      images: [ogImage],
    },
    twitter: { card: "summary_large_image", title, description: post.summary },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const freeCount = countFreePdfs(post.books.map((r) => r.book));
  /* Only the referenced books that have a page in THIS build. A pending book is
     a draft the post names (see ReferencedBook in lib/types.ts), so it has a
     title worth showing a reader but no URL worth handing a crawler. */
  const linkableBooks = post.books.filter((r) => !r.pending);
  const coverAbsolute = absoluteMediaUrl(SITE_URL, post.coverImage);

  /* Compared by DAY, not by timestamp. A post is written and published in one
     sitting, so an exact comparison would put a "হালনাগাদ" chip on every post
     from the moment it went live, and a freshness claim that is true of
     everything tells a reader nothing. The JSON-LD above already carries the
     exact dateModified for a crawler; this chip is for the reader deciding
     whether the prices and links below are still worth trusting. */
  const showUpdated = post.updatedAt.slice(0, 10) !== post.publishDate.slice(0, 10);

  /* Other posts, for the "আরও পড়ুন" block. getBlogPosts() is the same
     per-worker cache generateStaticParams read, so this is a filter rather than
     a query. Without it a post is a dead end: every route into the blog is
     one-way (index to post) and nothing links post to post, which is how a set
     of otherwise fine articles ends up crawled once and never revisited. */
  const related = (await getBlogPosts())
    .filter((p) => p.slug !== post.slug)
    .slice(0, RELATED_LIMIT);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#post`,
        headline: post.title,
        description: post.summary,
        url,
        inLanguage: "bn",
        datePublished: post.publishDate,
        dateModified: post.updatedAt,
        /* Depth, stated rather than inferred. These are the two properties that
           distinguish a researched piece from a stub without the body being
           parsed, and both are computed in lib/render.ts from the rich text, so
           neither can flatter the post. timeRequired is ISO 8601 duration. */
        wordCount: post.wordCount,
        timeRequired: `PT${post.readingTimeMinutes}M`,
        ...(coverAbsolute ? { image: coverAbsolute } : {}),
        /* The site is the author. There is no per-post byline field, and an
           `author` naming the Organization is both true and required: Google
           treats a missing author on an Article type as a structured-data error,
           and inventing a person to satisfy it would be worse than either. */
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        isPartOf: {
          "@type": "Blog",
          "@id": `${SITE_URL}/blog#blog`,
          name: `${SITE_NAME} ব্লগ`,
          url: `${SITE_URL}/blog`,
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        /* `mentions`, not `about`: the post is about its own subject, and these
           books are the works it discusses. It is the property that ties the
           prose to the catalogue pages in the graph, which is the whole reason a
           book site runs a blog. Pending books are left out entirely rather than
           listed without a url: unlike an ItemList there is no position here for
           an entry to hold, so a Book with only a name adds nothing a crawler can
           use and one with a url would point at a 404. */
        ...(linkableBooks.length > 0
          ? {
              mentions: linkableBooks.map((r) => ({
                "@type": "Book",
                name: r.book.title,
                url: `${SITE_URL}/book/${r.book.slug}`,
              })),
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "ব্লগ", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <ReadingProgress />
      <div className="shell py-6 sm:py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />

        <Breadcrumb
          items={[
            { label: "হোম", href: "/" },
            { label: "ব্লগ", href: "/blog" },
            { label: post.title },
          ]}
        />

        {/* The site's standard two-column shell, which this page used to opt out
            of with a bare `max-w-3xl` centred column. A post is the one page type
            here that arrives cold from search, so it is the page that most needs
            somewhere to go next; it was the only one with no rail. The prose
            keeps its own measure below rather than filling the wider column. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <article>
              {/* Title, cover, contents and body as ONE unbroken panel rather
                  than four blocks with the page canvas showing between them.
                  The old shape put the header in a card, the cover in a second
                  rounded box below it and the prose on the bare canvas, so the
                  article read as three unrelated widgets and the body — the
                  thing the page exists for — was the only part with no surface
                  under it at all.

                  `overflow-hidden` is what lets the cover run full-bleed to the
                  panel's edges and still be clipped by its corner radius, so no
                  child needs a radius of its own. */}
              <div className="card overflow-hidden">
                <header className="p-5 sm:p-7">
                  {/* Says what KIND of page this is before it says which one, the
                      same way the তালিকা header does. A post arrives cold from
                      search more often than any other page here. */}
                  <p className="eyebrow">ব্লগ</p>
                  <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
                    {post.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="chip">{formatBengaliDate(post.publishDate)}</span>
                    {showUpdated && (
                      <span className="chip">
                        হালনাগাদ {formatBengaliDate(post.updatedAt)}
                      </span>
                    )}
                    <span className="chip">
                      {toBengaliNumerals(post.readingTimeMinutes)} মিনিটের পড়া
                    </span>
                    {post.books.length > 0 && (
                      <span className="chip">
                        {toBengaliNumerals(post.books.length)}টি বই
                      </span>
                    )}
                    {/* The reserved download blue, as on every other count of
                        free files across the site. A plain grey chip here made
                        the one promise a reader scans for look like metadata. */}
                    {freeCount > 0 && (
                      <span className="chip bg-download/10 font-semibold text-download">
                        {toBengaliNumerals(freeCount)}টি ফ্রি PDF
                      </span>
                    )}
                  </div>
                  {/* The lede: the same sentence as the meta description, so a
                      reader arriving from a SERP sees the promise they clicked
                      restated at the top of the page rather than having to infer
                      it from the first paragraph. Set on the body's own measure
                      and one step up in size, which is what makes it read as a
                      standfirst instead of as a first paragraph. */}
                  {post.summary && (
                    <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-muted sm:text-lg">
                      {post.summary}
                    </p>
                  )}
                </header>

                {post.coverImage && (
                  /* A fixed 16:9 box with next/image rather than the bare <img>
                     this page used to ship. That <img> had no width or height, so
                     the whole article below it jumped down the moment the file
                     arrived — a Cumulative Layout Shift on the largest element of
                     the page, and CLS is a ranking signal, not just a nuisance.
                     `priority` because this is the LCP element; left to itself
                     next/image would lazy-load the one image the score is measured
                     against.

                     Full-bleed inside the panel now, so it gets rules top and
                     bottom instead of a border and a radius of its own — the
                     panel's `overflow-hidden` does the clipping. */
                  <div className="relative aspect-[16/9] w-full border-y border-rule bg-surface-sunken">
                    <Image
                      src={post.coverImage}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 700px"
                      className="object-cover"
                      priority
                    />
                  </div>
                )}

                <div className="p-5 sm:p-7">
                  {post.toc.length > 0 && (
                    /* The `[&>details]:my-0` cancels the margins TableOfContents
                       carries for the chapter page, where it sits between two
                       blocks on the open canvas. Here the panel's own padding is
                       the spacing, and leaving both would put 44px between the
                       cover and the contents box. */
                    <div className="mb-6 max-w-prose [&>details]:my-0">
                      <TableOfContents
                        items={post.toc}
                        // Not "অধ্যায়". A post's sections are not chapters, and
                        // the shared component's default says so.
                        label="এই লেখায় যা আছে"
                        navLabel="এই লেখার সূচিপত্র"
                      />
                    </div>
                  )}

                  {/* `prose` ALONGSIDE `prose-book`, which this body was missing
                      and which is the whole defect behind "the main body needs
                      redesigning". prose-book declares only the --tw-prose-*
                      colour tokens; the typography that CONSUMES them is the
                      plugin's `prose` class. Measured in the browser before the
                      fix: h2 rendered at 16px/weight 400 — identical to body
                      text — and every paragraph had zero top and bottom margin,
                      so a CMS-written article arrived as one undifferentiated
                      slab. With `prose` the same markup gives 24px/700 headings
                      with real space above them, and the h2 left rule from
                      globals.css finally has a heading worth marking.

                      max-w-prose, not max-w-2xl: 68ch is the project's declared
                      reading measure (tailwind.config.ts sets it in characters
                      precisely because Bengali glyphs are wider than Latin ones
                      at the same size), where max-w-2xl was a pixel width
                      inherited from the old centred layout. */}
                  <div
                    className="prose-book prose max-w-prose prose-p:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
                  />
                </div>
              </div>

              <div className="mt-8">
                <AdSlot placement="listing" minHeight={250} />
              </div>
              {/* The books the post argues for, as ROWS rather than the cover
                  grid this section used to be. A grid gave a reader who had just
                  read why they should read a book nothing to do about it: no
                  price, no buy link, no sign that a free PDF existed — the one
                  moment on the site where intent is highest was the one place
                  with no affordance. BookRow is shared with the curated-list
                  page, so the price-freshness gate and the sponsored rel cannot
                  be present on one and missing on the other. */}
              {post.books.length > 0 && (
                <section className="mt-10" aria-labelledby="post-books-heading">
                  <h2 id="post-books-heading" className="section-title">
                    এই লেখায় যে বইগুলো
                  </h2>
                  <ul className="mt-4 space-y-4">
                    {post.books.map((ref, i) => (
                      // Position fallback because a pending book may have no slug
                      // yet, and two of them would collide on "".
                      <li key={ref.book.slug || `pending-${i}`} className="card p-4 sm:p-5">
                        {/* Unordered on purpose. A তালিকা's order is the
                            editor's ranking and is numbered; a post's related-books
                            field is just the set the prose happens to name, and
                            numbering it would assert a ranking nobody chose. */}
                        <BookRow book={ref.book} slot="card-chip" pending={ref.pending} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs leading-relaxed text-ink-muted">
                    {AFFILIATE_DISCLOSURE}
                  </p>
                </section>
              )}

              <div className="mt-8 border-t border-rule pt-5">
                <ShareRow url={url} title={post.title} />
              </div>

              {related.length > 0 && (
                <section className="mt-10" aria-labelledby="related-posts-heading">
                  <h2 id="related-posts-heading" className="section-title">
                    আরও পড়ুন
                  </h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                    {related.map((p) => (
                      <li key={p.slug}>
                        <article className="card-interactive relative h-full p-4">
                          <h3 className="text-sm font-bold leading-snug text-ink">
                            {/* The stretched link: the whole card is clickable
                                but the anchor stays one element for assistive
                                tech, as on the blog index. */}
                            <Link
                              href={`/blog/${p.slug}`}
                              className="after:absolute after:inset-0"
                            >
                              {p.title}
                            </Link>
                          </h3>
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-muted">
                            {p.summary}
                          </p>
                          <p className="mt-2 text-xs text-ink-muted">
                            {formatBengaliDate(p.publishDate)}
                          </p>
                        </article>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          </div>

          <Sidebar />
        </div>
      </div>
    </>
  );
}

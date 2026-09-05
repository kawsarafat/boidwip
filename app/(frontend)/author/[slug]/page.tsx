import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthors, getAuthor, getBooksByAuthor, safeJsonLd } from "@/lib/data";
import { toBookSummary, countFreePdfs } from "@/lib/types";
import {
  authorTitle,
  authorHeading,
  authorDescription,
  isThinEntityPage,
  AUTHOR_INDEX_SUBJECT,
} from "@/lib/seo";
import { bengaliGenitive } from "@/lib/bengali";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookCard, { BookGrid } from "@/components/BookCard";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE, absoluteMediaUrl } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

// A slug this build did not prerender is a 404, not a request-time render —
// same reasoning as book/[slug]/page.tsx.
export const dynamicParams = false;

export async function generateStaticParams() {
  const authors = await getAuthors();
  return authors.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) return {};

  /* The counts come from the books, not from the denormalised fields, so the
     numbers in the title and description are checkable against the grid the
     reader lands on. countFreePdfs is the SAME expression the page body uses
     below: the <title> and the <h1> both branch on whether this page may say
     "PDF Download" at all, and two spellings of one filter is how they come to
     disagree. The extra getBooksByAuthor call is a filter over lib/data.ts's
     per-worker cache, not a second query. */
  const books = await getBooksByAuthor(author.slug);
  const freePdfCount = countFreePdfs(books);
  const title = authorTitle({ name: author.name, freePdfCount });
  const description = authorDescription({
    ...author,
    bookCount: books.length,
    freePdfCount,
  });
  const url = `/author/${author.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // `profile` rather than the site-wide `website`: this page's subject is a
    // person, which is what the JSON-LD already says with its Person node.
    openGraph: { title, description, url, type: "profile", images: [OG_IMAGE] },
    // The quality floor (plan §9.6): a page with one book and a two-line bio
    // is doorway-shaped. It renders and is linked — readers can use it — it
    // just does not ask Google to rank it until it is worth ranking.
    //
    // Deliberately author.bookCount and not books.length, even though countFor
    // proves them equal: app/(frontend)/sitemap.ts holds this page out of the
    // sitemap using this same expression, and a sitemap listing a URL whose meta
    // says noindex is the two arguing with each other. Same field, one answer.
    ...(isThinEntityPage(author.bookCount, author.bioWordCount)
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = await getAuthor(slug);
  if (!author) notFound();

  const books = await getBooksByAuthor(author.slug);
  const url = `${SITE_URL}/author/${author.slug}`;
  const freeCount = countFreePdfs(books);
  const photo = absoluteMediaUrl(SITE_URL, author.photo);

  const years =
    author.birthYear && author.deathYear
      ? `${toBengaliNumerals(author.birthYear)}–${toBengaliNumerals(author.deathYear)}`
      : author.birthYear
        ? `জন্ম ${toBengaliNumerals(author.birthYear)}`
        : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${url}#person`,
        name: author.name,
        url,
        // absoluteMediaUrl, not a bare SITE_URL prefix: an uploaded photo's url
        // is relative locally and already absolute once R2 is configured, so the
        // prefix produced "https://boidwip.vercel.app/https://cdn…/x.jpg" in
        // production — a photo Google fetches and fails.
        ...(photo ? { image: photo } : {}),
        ...(author.birthYear ? { birthDate: String(author.birthYear) } : {}),
        ...(author.deathYear ? { deathDate: String(author.deathYear) } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "হোম", item: SITE_URL },
          // The hub between home and the author. It exists now (it used to
          // 404), and a two-step trail that skipped it told Google this page
          // hung directly off the domain root.
          {
            "@type": "ListItem",
            position: 2,
            name: AUTHOR_INDEX_SUBJECT,
            item: `${SITE_URL}/author`,
          },
          { "@type": "ListItem", position: 3, name: author.name, item: url },
        ],
      },
      ...(books.length > 0
        ? [
            {
              "@type": "ItemList",
              // bengaliGenitive, not `${author.name} এর বই`: a possessive
              // written as a loose word is the Bengali equivalent of
              // "Tagore 's books", and this string is the machine-readable
              // name of the list.
              name: `${bengaliGenitive(author.name)} বই`,
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

      <Breadcrumb
        items={[
          { label: "হোম", href: "/" },
          { label: AUTHOR_INDEX_SUBJECT, href: "/author" },
          { label: author.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            <div className="flex items-start gap-5">
              {author.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.photo}
                  alt={author.name}
                  width={88}
                  height={88}
                  className="h-20 w-20 shrink-0 rounded-full border border-rule object-cover sm:h-22 sm:w-22"
                />
              )}
              <div className="min-w-0">
                {/* authorHeading(), not a hand-written ternary. This line used
                    to read `${author.name} এর বই PDF Download` — the same
                    branch as the <title> written a second time, in a second
                    file, with the possessive spelled as a loose word. */}
                <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                  {authorHeading({ name: author.name, freePdfCount: freeCount })}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  {years && <span className="chip">{years}</span>}
                  <span className="chip">{toBengaliNumerals(books.length)}টি বই</span>
                  {freeCount > 0 && (
                    <span className="chip">{toBengaliNumerals(freeCount)}টি ফ্রি PDF</span>
                  )}
                </div>
              </div>
            </div>

            {author.bioHtml && (
              <div
                className="prose-book mt-5 max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: author.bioHtml }}
              />
            )}
          </header>

          {books.length === 0 ? (
            <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
              এই লেখকের বইগুলো শীঘ্রই যুক্ত করা হবে।
            </p>
          ) : (
            <section className="mt-8" aria-labelledby="books-heading">
              <h2 id="books-heading" className="section-title">
                সব বই
              </h2>
              <div className="mt-4">
                <BookGrid>
                  {books.map((b, i) => (
                    <BookCard key={b.slug} book={toBookSummary(b)} priority={i === 0} />
                  ))}
                </BookGrid>
              </div>
            </section>
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

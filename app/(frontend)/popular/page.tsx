import type { Metadata } from "next";
import { getPopularBooks } from "@/lib/data";
import { countFreePdfs } from "@/lib/types";
import { listingTitle, freePdfClause } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookCard, { BookGrid } from "@/components/BookCard";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

/** /popular — the site's most-read books.
 *
 *  WHY THIS IS generateMetadata AND NOT A CONST. The title has to carry the
 *  number of books on the page, and a `const TITLE` cannot: the count only
 *  exists after getPopularBooks has run. The page used to emit the bare
 *  "জনপ্রিয় বাংলা বই", which is a phrase a dozen sites carrying the same
 *  catalogue also emit, and nothing in the SERP entry told a searcher this one
 *  had six books with free PDFs rather than a listicle. The count is the
 *  distinguishing token, it is checkable against the grid, and it dates itself
 *  honestly because it is regenerated on every build.
 *
 *  THE LIMIT IS SHARED. `LIMIT` is read by generateMetadata and by the page, so
 *  the number in the title is the number of rows rendered. Two literals would
 *  have drifted the first time someone widened the page. */
const LIMIT = 40;

/** The subject, bare: the layout's title template appends " | বইদ্বীপ" once, and
 *  Google drops that suffix when the line does not fit. See /about. */
const SUBJECT = "জনপ্রিয় বাংলা বই";

export async function generateMetadata(): Promise<Metadata> {
  const books = await getPopularBooks(LIMIT);
  const freePdfCount = countFreePdfs(books);
  const title = listingTitle(SUBJECT, books.length, freePdfCount);
  const description = `পাঠকদের কাছে সবচেয়ে জনপ্রিয় ${toBengaliNumerals(books.length)}টি বাংলা বই: ${freePdfClause(freePdfCount)}রিভিউ, রেটিং ও কেনার লিংক বইদ্বীপে।`;

  return {
    title,
    description,
    alternates: { canonical: "/popular" },
    openGraph: {
      title,
      description,
      url: "/popular",
      type: "website",
      images: [OG_IMAGE],
    },
  };
}

export default async function PopularBooksPage() {
  const books = await getPopularBooks(LIMIT);
  const freeCount = countFreePdfs(books);

  return (
    <div className="shell py-6 sm:py-8">
      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: "জনপ্রিয় বই" }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header>
            {/* The h1 is the title's subject, exactly. It used to read
                "জনপ্রিয় বই" under a title that said "জনপ্রিয় বাংলা বই" — a
                page whose heading and title name two different things spends
                its strongest on-page signal disagreeing with itself. The count
                goes in the chips below rather than inside the heading, where it
                would read as part of the subject's name. */}
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {SUBJECT}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              পাঠকদের কাছে সবচেয়ে জনপ্রিয় বইগুলো একসাথে। প্রতিটি বইয়ের পাতায় রিভিউ,
              রেটিং এবং (যেখানে অনুমতি আছে) ফ্রি PDF ডাউনলোড পাবেন।
            </p>
            {books.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip">{toBengaliNumerals(books.length)}টি বই</span>
                {freeCount > 0 && (
                  <span className="chip">{toBengaliNumerals(freeCount)}টি ফ্রি PDF</span>
                )}
              </div>
            )}
          </header>

          {books.length === 0 ? (
            <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
              বইগুলো শীঘ্রই যুক্ত করা হবে।
            </p>
          ) : (
            <div className="mt-6">
              {/* BookCard's title is an h3, so without an h2 for the grid this
                  page jumps h1 -> h3. No visible label: the h1 and the count
                  chips already name the list. See SearchClient's results
                  region, which carries the same heading for the same reason. */}
              <h2 className="sr-only">বইয়ের তালিকা</h2>
              <BookGrid>
                {books.map((b, i) => (
                  <BookCard key={b.slug} book={b} priority={i < 2} />
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

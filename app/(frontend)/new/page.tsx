import type { Metadata } from "next";
import { getRecentBooks } from "@/lib/data";
import { countFreePdfs } from "@/lib/types";
import { listingTitle, freePdfClause } from "@/lib/seo";
import { toBengaliNumerals } from "@/lib/numerals";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import BookCard, { BookGrid } from "@/components/BookCard";
import AdSlot from "@/components/AdSlot";
import { OG_IMAGE } from "@/lib/og";

/** /new — the newest additions.
 *
 *  generateMetadata rather than a const, and one shared LIMIT, for the reasons
 *  spelled out in app/(frontend)/popular/page.tsx: the count in the title is the
 *  token that distinguishes this listing, and it can only be known after the
 *  query runs. */
const LIMIT = 40;

// Bare: the layout's title template appends the site name once. See /about.
const SUBJECT = "নতুন যুক্ত হওয়া বই";

export async function generateMetadata(): Promise<Metadata> {
  const books = await getRecentBooks(LIMIT);
  const freePdfCount = countFreePdfs(books);
  const title = listingTitle(SUBJECT, books.length, freePdfCount);
  const description = `বইদ্বীপে সর্বশেষ যুক্ত হওয়া ${toBengaliNumerals(books.length)}টি বাংলা বই, নতুনটি আগে: ${freePdfClause(freePdfCount)}রিভিউ, রেটিং ও কেনার লিংক।`;

  return {
    title,
    description,
    alternates: { canonical: "/new" },
    openGraph: {
      title,
      description,
      url: "/new",
      type: "website",
      images: [OG_IMAGE],
    },
  };
}

export default async function NewBooksPage() {
  const books = await getRecentBooks(LIMIT);
  const freeCount = countFreePdfs(books);

  return (
    <div className="shell py-6 sm:py-8">
      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: "নতুন বই" }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {SUBJECT}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              সাইটে সর্বশেষ যুক্ত হওয়া বইগুলো, নতুনটি আগে। প্রতিটি বইয়ের পাতায় রিভিউ,
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
              {/* Visually hidden but really present: BookCard's title is an h3,
                  so without an h2 for the grid this page jumps h1 -> h3. The
                  region needs no visible label — the h1 and the chips above
                  already say what the list is — but the outline does need the
                  level. Same fix as the results region in SearchClient. */}
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

import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllBooks, getCategories } from "@/lib/data";
import { toBookSummary } from "@/lib/types";
import { toBengaliNumerals } from "@/lib/numerals";
import SearchClient from "@/components/SearchClient";
import { OG_IMAGE } from "@/lib/og";

export const metadata: Metadata = {
  title: "বই খুঁজুন",
  description:
    "বইদ্বীপের সব বাংলা বই নাম, লেখক বা বিভাগ দিয়ে খুঁজুন, বাংলা বা Banglish দুইভাবেই। ফ্রি PDF ফিল্টারসহ।",
  alternates: { canonical: "/search" },
  openGraph: {
    // Bare, like the title above: the layout's openGraph title template appends
    // the site name. It used to be spelled out here, which was the one place on
    // the site where og:title carried the brand and <title> did not.
    title: "বই খুঁজুন",
    url: "/search",
    type: "website",
    images: [OG_IMAGE],
  },
};

// Server component: reads everything from Payload (via lib/data.ts) at
// build time, then hands plain data down to the client component that
// handles the interactive filtering. Suspense is required here because the
// client component reads the ?q= URL param via useSearchParams.
//
// toBookSummary is the load-bearing line. This is the only page that hands
// EVERY published book to a client component, and props crossing that
// boundary are serialized into the RSC payload inside the HTML. Passing
// getAllBooks() straight through would ship each book's whole rendered
// synopsis, chapters, TOC and FAQ list to the browser — none of which the
// search UI reads — and it would grow with every book published. The
// projection is a plain map over the same build-time data, so the page stays
// static and the payload stops scaling with the size of the site.
//
// bookCategories is a separate slug->slugs record rather than a field on the
// summary: category membership is only needed HERE, and widening BookSummary
// would ship it to every listing page's payload too.
//
// THE HEADING AND THE INTRO ARE RENDERED HERE, NOT IN SearchClient. A component
// that reads useSearchParams cannot be prerendered, so Next emits its Suspense
// boundary as an empty hole in the static HTML. When the h1 lived inside the
// client component, this route's <main> was empty in the served document: no
// heading, no sentence, nothing — on a URL the sitemap advertises and that
// canonicalises to itself. Everything above the input is static text about the
// catalogue, so it belongs on the server side of that boundary and is now in the
// HTML whether or not the script runs.
export default async function SearchPage() {
  const [books, categories] = await Promise.all([getAllBooks(), getCategories()]);

  const bookCategories: Record<string, string[]> = {};
  for (const b of books) {
    bookCategories[b.slug] = b.categories.map((c) => c.slug);
  }

  // Only categories that actually contain books — a filter chip that can
  // only ever return zero results reads as a broken filter.
  const usedCategorySlugs = new Set(Object.values(bookCategories).flat());
  const usableCategories = categories
    .filter((c) => usedCategorySlugs.has(c.slug))
    .map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <div className="shell max-w-6xl py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">বই খুঁজুন</h1>
      <p className="mt-2 text-sm text-ink-muted">
        বইয়ের নাম, লেখকের নাম বাংলা বা Banglish-এ লিখে খুঁজুন। মোট{" "}
        {toBengaliNumerals(books.length)}টি বই রয়েছে।
      </p>

      {/* The fallback reserves the height of the input row and the chip row, so
          hydration does not shove the results grid down the page. */}
      <Suspense fallback={<div className="mt-5 h-12 max-w-xl rounded-xl2 border border-rule bg-surface" />}>
        <SearchClient
          books={books.map(toBookSummary)}
          categories={usableCategories}
          bookCategories={bookCategories}
        />
      </Suspense>
    </div>
  );
}

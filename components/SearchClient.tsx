"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BookSummary, EntityRef } from "@/lib/types";
import { tierAllowsDelivery } from "@/lib/types";
import type { SearchKeys } from "@/lib/search";
import { matchesTokens, searchKeys, searchTokens } from "@/lib/search";
import BookCard, { BookGrid } from "@/components/BookCard";
import { toBengaliNumerals } from "@/lib/numerals";

/** How long the URL waits behind the input. Long enough that typing a title
 *  produces one history-replacing navigation rather than thirty, short enough
 *  that copying the address bar right after typing gets the right link. */
const URL_DEBOUNCE_MS = 300;

interface Props {
  /** BookSummary, not BookContent. This is the only component on the public
   *  site that receives the WHOLE book list across the server/client
   *  boundary, so every field named in that type is shipped to the browser
   *  once per book inside the page's RSC payload. Keep it at the fields the
   *  search and the cards actually use — see BookSummary in lib/types.ts. */
  books: BookSummary[];
  categories: EntityRef[];
  /** book slug -> category slugs, for the category filter. Sent as a plain
   *  record because a Map does not survive RSC serialization. */
  bookCategories: Record<string, string[]>;
}

/** Client-side search over the whole (static) book list.
 *
 *  THE PAGE HEADING IS NOT IN HERE, and that is the point. This component reads
 *  `useSearchParams`, which makes it un-prerenderable: Next renders the Suspense
 *  boundary it sits in as EMPTY in the static HTML and fills it in on the client.
 *  With the h1 and the intro inside here, `/search` shipped a document whose
 *  <main> was literally empty — a page in the sitemap, canonical to itself,
 *  with no heading and no text for anything that does not run JavaScript. The
 *  server component owns the shell now; this owns the parts that need state.
 *
 *  There is no search API and there should not be one AT THIS SIZE: the entire
 *  index is a few hundred short records, it is already in the page as props,
 *  and adding a request-time endpoint would break the "every public route is
 *  prerendered" rule for no gain a visitor could feel. The number that would
 *  change this is roughly a thousand books — past that the RSC payload, not the
 *  matching, is what gets expensive, and the answer is a generated index file
 *  or a real endpoint rather than a bigger prop.
 *
 *  Matching covers what a reader might actually type:
 *  - the Bengali title, author names — the normal case;
 *  - titleLatin — the "Banglish" case. Someone who wants হাজার বছর ধরে will
 *    often type "hajar bochor dhore" on an English keyboard; without the
 *    transliteration field that search returns nothing on a site whose whole
 *    catalogue is in Bengali script;
 *  - the same title with a zero-width joiner in it, with ASCII digits where the
 *    catalogue has Bengali ones, or with শ where the book has স. All of that is
 *    lib/search.ts's job, and it is worth reading the header there: every rule
 *    is a real way Bengali search returns nothing for a book on the screen.
 *
 *  TWO PASSES, STRICT THEN LOOSE. The strict key only removes things a reader
 *  cannot see; the loose key also merges letters Bengali spells differently and
 *  pronounces identically. Running loose only when strict found nothing is what
 *  keeps its false positives out of the searches that did not need it — a
 *  reader who types an exact title gets the exact title, not eleven near-misses
 *  underneath it.
 *
 *  THE URL CARRIES THE STATE. Every filter is in the query string, so a result
 *  set can be linked, bookmarked and reloaded, and Back steps through searches
 *  instead of leaving the page. `replace` rather than `push`, and debounced:
 *  one history entry per keystroke would make Back useless. `scroll: false`
 *  because a reader mid-list has not asked to be returned to the top. */
export default function SearchClient({ books, categories, bookCategories }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // `?category=` comes from outside and is not to be trusted: an unknown slug
  // would filter every book out and leave a reader staring at "০টি ফলাফল" with
  // a chip row that shows nothing selected.
  const knownCategories = useMemo(() => new Set(categories.map((c) => c.slug)), [categories]);

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(() => {
    const slug = searchParams.get("category");
    return slug && categories.some((c) => c.slug === slug) ? slug : null;
  });
  const [freeOnly, setFreeOnly] = useState(() => searchParams.get("free") === "1");

  /** The query string this component's state describes. */
  const target = useMemo(() => {
    const params = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    if (categoryFilter) params.set("category", categoryFilter);
    if (freeOnly) params.set("free", "1");
    return params.toString();
  }, [query, categoryFilter, freeOnly]);

  /** The last query string WE navigated to. Without this the two effects below
   *  fight: the write lands, the read sees a new `searchParams` and copies it
   *  back into state, and any keystroke that arrived in between is lost. */
  const lastWritten = useRef<string | null>(null);

  // State -> URL.
  useEffect(() => {
    if (target === searchParams.toString()) return;
    const id = setTimeout(() => {
      lastWritten.current = target;
      router.replace(target ? `/search?${target}` : "/search", { scroll: false });
    }, URL_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [target, searchParams, router]);

  // URL -> state, for the navigations this component did NOT make: the header
  // search box (which pushes /search?q=... to this same page, so the input would
  // otherwise keep its old value), Back, Forward, and a pasted link.
  useEffect(() => {
    const current = searchParams.toString();
    if (current === lastWritten.current) return;
    lastWritten.current = null;
    setQuery(searchParams.get("q") ?? "");
    const slug = searchParams.get("category");
    setCategoryFilter(slug && knownCategories.has(slug) ? slug : null);
    setFreeOnly(searchParams.get("free") === "1");
  }, [searchParams, knownCategories]);

  // Both keys for every book, built once for the whole list rather than per
  // keystroke: normalizing the fields of every book on every character typed is
  // wasted work on the slow phones this site is aimed at. Only the query is
  // normalized inside the render below, and it is one short string.
  const haystacks = useMemo(() => {
    const map = new Map<string, SearchKeys>();
    for (const b of books) {
      map.set(
        b.slug,
        searchKeys([b.title, b.titleLatin ?? "", ...b.authors.map((a) => a.name)].join(" "))
      );
    }
    return map;
  }, [books]);

  const { matches, fuzzy } = useMemo(() => {
    // Filters first, so the loose fallback below is scoped to the shelf the
    // reader is actually looking at.
    const scoped = books.filter((b) => {
      if (freeOnly && !(tierAllowsDelivery(b.rightsTier) && Boolean(b.pdfUrl))) return false;
      if (categoryFilter && !(bookCategories[b.slug] ?? []).includes(categoryFilter)) return false;
      return true;
    });

    // Every whitespace-separated word must match somewhere, so "রবীন্দ্রনাথ
    // উপন্যাস" narrows instead of returning everything that matches either.
    const tokens = searchTokens(query);
    if (tokens.strict.length === 0) return { matches: scoped, fuzzy: false };

    const strict = scoped.filter((b) =>
      matchesTokens(haystacks.get(b.slug)?.strict ?? "", tokens.strict)
    );
    if (strict.length > 0) return { matches: strict, fuzzy: false };

    const loose = scoped.filter((b) =>
      matchesTokens(haystacks.get(b.slug)?.loose ?? "", tokens.loose)
    );
    return { matches: loose, fuzzy: loose.length > 0 };
  }, [query, books, haystacks, categoryFilter, freeOnly, bookCategories]);

  const filtersActive = Boolean(categoryFilter || freeOnly || query.trim());

  return (
    <>
      <div className="relative mt-5 max-w-xl">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          id="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="যেমন: হাজার বছর ধরে, himu, রবীন্দ্রনাথ..."
          aria-label="বই খুঁজুন"
          enterKeyHint="search"
          className="h-12 w-full rounded-xl2 border border-rule bg-surface pl-11 pr-4 text-ink shadow-card outline-none transition placeholder:text-ink-muted/80 focus:border-accent"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={freeOnly}
          onClick={() => setFreeOnly((v) => !v)}
          className={`chip ${freeOnly ? "chip-active" : "hover:border-ink/20 hover:text-ink"}`}
        >
          শুধু ফ্রি PDF
        </button>

        {categories.map((c) => {
          const active = categoryFilter === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setCategoryFilter(active ? null : c.slug)}
              className={`chip ${active ? "chip-active" : "hover:border-ink/20 hover:text-ink"}`}
            >
              {c.name}
            </button>
          );
        })}

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategoryFilter(null);
              setFreeOnly(false);
            }}
            className="chip text-warn hover:border-warn"
          >
            ফিল্টার মুছুন
          </button>
        )}
      </div>

      {/* Visually hidden but really present: BookCard's title is an h3, so
          without an h2 for the results region this page alone jumps h1 -> h3. */}
      <h2 className="sr-only">ফলাফল</h2>

      {/* aria-live so a screen reader hears the count change as the filter
          narrows, which is the only feedback a non-visual user gets here. The
          fuzzy note lives INSIDE the live region on purpose: "these are
          approximate matches" is exactly the part a non-visual reader must not
          have to discover by looking. */}
      <p aria-live="polite" className="mt-6 text-sm text-ink-muted">
        {toBengaliNumerals(matches.length)}টি ফলাফল
        {fuzzy && "। হুবহু মিল পাওয়া যায়নি, কাছাকাছি বানানের ফলাফল দেখানো হচ্ছে।"}
      </p>

      {matches.length === 0 ? (
        <div className="mt-4 rounded-xl2 border border-dashed border-ink/20 p-8 text-center">
          <p className="text-sm font-medium text-ink">কোনো ফলাফল পাওয়া যায়নি।</p>
          <p className="mt-1 text-sm text-ink-muted">
            বানান দেখে নিন, Banglish-এ লিখে দেখুন, অথবা ফিল্টার মুছে আবার চেষ্টা করুন।
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <BookGrid>
            {matches.map((b) => (
              <BookCard key={b.slug} book={b} />
            ))}
          </BookGrid>
        </div>
      )}
    </>
  );
}

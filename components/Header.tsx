import Link from "next/link";
import { getCategories } from "@/lib/data";
import { SITE_NAME } from "@/lib/seo";
import SearchBox from "@/components/SearchBox";
import MobileMenu from "@/components/MobileMenu";
import SiteMark from "@/components/SiteMark";
import ThemeToggle from "@/components/ThemeToggle";

/** How many categories the desktop strip shows. The strip is one row and
 *  must never grow to two (a two-line strip pushes --header-h out of sync with
 *  the real header height, breaking every anchor offset on the site), so it
 *  takes the top N by book count and ends with a "সব বিষয়" overflow link to
 *  /category.
 *
 *  That overflow link is new. The comment above promised it before the link
 *  existed, so /category — a hub with its own page — was reachable only from
 *  the footer, and a strip that silently dropped the 8th category told nobody.
 *
 *  FIVE, and the number is measured rather than chosen. The row also gained
 *  তালিকা and সব বিষয়, and it has to survive the NARROWEST desktop width:
 *  `lg` is 1024px, where scrollbar-gutter leaves the shell 961px of content
 *  box. At 1024px with the five seeded categories the row needs 921px — 40px
 *  of slack. Bengali category names in this store measure 64–129px, so a sixth
 *  name would overflow; it goes behind সব বিষয় instead.
 *
 *  The failure mode is NOT flex wrapping. `flex` defaults to flex-wrap: nowrap,
 *  so the items stay on one line either way — what actually breaks is the TEXT
 *  inside a shrunk link wrapping to two lines, which grows the row. That is why
 *  STRIP_LINK carries whitespace-nowrap: with it, an over-full strip overflows
 *  horizontally (visible, harmless) instead of silently making the header 20px
 *  taller than the variable that describes it. */
const STRIP_LIMIT = 5;

/** One class string for every item in the strip, because a nav row whose
 *  entries drift apart in padding or weight reads as broken rather than as
 *  styled — and there are now six copies of it. */
const STRIP_LINK =
  "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink";

/** Sticky site header.
 *
 *  Two rows on desktop, one on mobile. The desktop second row lists the top
 *  categories as real <a>s on every page of the site, which is deliberate:
 *  it is the internal-linking backbone. Crawlers reach every major category
 *  hub from any page, and readers switch category without going home first.
 *
 *  Zero JavaScript except the theme toggle and the mobile drawer. A hover
 *  dropdown for the category list would have needed a client component on
 *  every page to close on Escape and outside-click properly; a visible strip
 *  is both cheaper and easier to use.
 *
 *  The combined height is declared once as --header-h in globals.css and used
 *  there for scroll-padding-top, so an in-page #link never lands behind this. */
export default async function Header() {
  const categories = await getCategories();
  const strip = [...categories]
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, STRIP_LIMIT);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-canvas/85 backdrop-blur-md">
      <div className="shell flex h-14 items-center gap-3 lg:h-16">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label={`${SITE_NAME}, প্রচ্ছদ`}
        >
          <SiteMark id="header" className="h-9 w-9 shrink-0 rounded-lg shadow-card" />
          <span className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            {SITE_NAME}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <SearchBox className="hidden lg:block lg:w-64" />
          <ThemeToggle />
          <MobileMenu categories={categories} />
        </div>
      </div>

      {/* Category strip, desktop only. Mobile gets the same links in the drawer. */}
      <nav aria-label="বিষয় মেনু" className="hidden border-t border-rule/70 lg:block">
        <ul className="shell flex items-center gap-1 py-1">
          <li>
            <Link href="/new" className={STRIP_LINK}>
              নতুন বই
            </Link>
          </li>
          <li>
            <Link href="/popular" className={STRIP_LINK}>
              জনপ্রিয়
            </Link>
          </li>
          {/* তালিকা sits with the other PAGE TYPES rather than among the
              subjects, because that is what it is: /list is a hub of curated
              lists, not a category of books. It is here at all because "বই পড়ার
              তালিকা" is the highest-volume query this site can answer and the
              hub was previously reachable from the footer alone — one link, on
              the least-weighted part of every page. */}
          <li>
            <Link href="/list" className={STRIP_LINK}>
              তালিকা
            </Link>
          </li>
          <li aria-hidden className="mx-1 h-4 w-px bg-rule" />
          {strip.map((c) => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}`} className={STRIP_LINK}>
                {c.name}
              </Link>
            </li>
          ))}
          {/* The end of the truncated run, and the only header path to
              /category. Rendered unconditionally rather than only when the
              strip actually overflows: with five categories seeded and a limit
              of five nothing is dropped today, but the link is how a reader gets
              the full subject list either way, and a nav item that appears the
              day a sixth category is added is a layout change nobody
              triggered. `font-semibold` is the whole difference from a category
              above it — enough to read as the run's tail, not enough to compete
              with the accent link on the right. */}
          <li>
            <Link href="/category" className={`${STRIP_LINK} font-semibold`}>
              সব বিষয়
            </Link>
          </li>
          <li className="ml-auto">
            <Link
              href="/search"
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-accent transition hover:bg-surface-sunken"
            >
              সব বই খুঁজুন
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

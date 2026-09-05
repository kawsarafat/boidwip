import Link from "next/link";
import { getCategories } from "@/lib/data";
import { SITE_NAME } from "@/lib/seo";
import SearchBox from "@/components/SearchBox";
import MobileMenu from "@/components/MobileMenu";
import SiteMark from "@/components/SiteMark";
import ThemeToggle from "@/components/ThemeToggle";

/** How many categories the desktop strip shows. The strip is one row and
 *  must never wrap (a two-row strip pushes --header-h out of sync with the
 *  real header height, breaking every anchor offset), so it takes the top N
 *  by book count and ends with a "সব বিষয়" overflow link. */
const STRIP_LIMIT = 7;

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
            <Link
              href="/new"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
            >
              নতুন বই
            </Link>
          </li>
          <li>
            <Link
              href="/popular"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
            >
              জনপ্রিয়
            </Link>
          </li>
          <li aria-hidden className="mx-1 h-4 w-px bg-rule" />
          {strip.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
              >
                {c.name}
              </Link>
            </li>
          ))}
          <li className="ml-auto">
            <Link
              href="/search"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-accent transition hover:bg-surface-sunken"
            >
              সব বই খুঁজুন
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

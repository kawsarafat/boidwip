import Link from "next/link";
import { getCategories, getLists, getSiteSettings } from "@/lib/data";
import { SITE_NAME } from "@/lib/seo";
import SiteMark from "@/components/SiteMark";

/** The browse column. The five hub indexes lead it, ahead of /new and /popular:
 *  each is the parent of a whole URL namespace, and until they existed all five
 *  404'd, so every deep /author/<slug> and /list/<slug> hung off nothing a
 *  crawler could climb to. Putting them in the footer is what makes every page
 *  on the site one click from every hub. */
const BROWSE_LINKS = [
  { href: "/list", label: "বই পড়ার তালিকা" },
  { href: "/author", label: "লেখক" },
  { href: "/publisher", label: "প্রকাশনী" },
  { href: "/series", label: "সিরিজ" },
  { href: "/new", label: "নতুন বই" },
  { href: "/popular", label: "জনপ্রিয় বই" },
  { href: "/search", label: "সব বই খুঁজুন" },
  { href: "/blog", label: "ব্লগ" },
];

const INFO_LINKS = [
  { href: "/about", label: "আমাদের সম্পর্কে" },
  { href: "/contact", label: "যোগাযোগ" },
  { href: "/privacy-policy", label: "প্রাইভেসি পলিসি" },
  { href: "/rss.xml", label: "RSS ফিড" },
];

/** How many categories / lists the footer columns carry. Enough to give
 *  every page a link into both hub structures (which is what stops deep book
 *  pages from being orphans in the crawl graph) without the footer becoming
 *  a sitemap. */
const COLUMN_LIMIT = 6;

/** Site footer.
 *
 *  Four columns: brand, categories, curated lists + browse, info. /about,
 *  /contact and /privacy-policy being reachable from every page is an
 *  explicit AdSense review expectation; the category and list columns give
 *  every page a path into both hub structures. */
export default async function Footer() {
  const [categories, lists, settings] = await Promise.all([
    getCategories(),
    getLists(),
    getSiteSettings(),
  ]);

  const topCategories = [...categories]
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, COLUMN_LIMIT);
  const topLists = lists.slice(0, 3);

  return (
    <footer className="no-print mt-20 border-t border-rule bg-surface">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <SiteMark id="footer" className="h-9 w-9 shrink-0 rounded-lg" />
            <span className="text-xl font-extrabold tracking-tight text-ink">{SITE_NAME}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
            {settings.siteDescription}
          </p>
          {settings.socialLinks.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {settings.socialLinks.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chip hover:border-accent hover:text-accent"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="বিষয়সমূহ">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">বিষয়সমূহ</p>
          <ul className="mt-3 space-y-2 text-sm">
            {topCategories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/category/${c.slug}`}
                  className="text-ink-muted transition hover:text-accent"
                >
                  {c.name}
                </Link>
              </li>
            ))}
            {/* The overflow link. COLUMN_LIMIT hides the smaller subjects, and
                /category is the only page that shows all of them. */}
            <li>
              <Link href="/category" className="font-semibold text-accent transition hover:underline">
                সব বিষয় দেখুন
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="বই খুঁজুন">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">বই খুঁজুন</p>
          <ul className="mt-3 space-y-2 text-sm">
            {BROWSE_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-muted transition hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
            {topLists.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/list/${l.slug}`}
                  className="text-ink-muted transition hover:text-accent"
                >
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="তথ্য">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">তথ্য</p>
          <ul className="mt-3 space-y-2 text-sm">
            {INFO_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-muted transition hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-rule">
        <div className="shell flex flex-col gap-2 py-5 text-center text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}। সর্বস্বত্ব সংরক্ষিত।
          </p>
          {/* The rights posture, stated plainly on every page: what this site
              hosts and what it only points at. Worth having for readers, and
              it is exactly the clarity a takedown reviewer looks for. */}
          <p>{settings.footerNote}</p>
        </div>
      </div>
    </footer>
  );
}

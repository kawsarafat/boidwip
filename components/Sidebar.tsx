import Link from "next/link";
import { getPopularBooks, getCategories } from "@/lib/data";
import AdSlot from "@/components/AdSlot";
import CoverImage from "@/components/CoverImage";
import RatingStars from "@/components/RatingStars";

/** Right-hand rail on desktop, a stacked block below the article on mobile.
 *  Never hidden at any breakpoint: these are real internal links and a reader
 *  on a phone is the majority case, not the exception.
 *
 *  Two sections: জনপ্রিয় বই (cover thumbnails — unlike the old chapter rail,
 *  a book COVER carries real information at thumbnail size, it is how people
 *  recognise books) and a category chip cloud, which gives every page that
 *  mounts the rail a link into every category hub.
 *
 *  It does NOT repeat the header's nav links; the header, drawer and footer
 *  already carry those three copies.
 *
 *  `excludeSlug` is passed from a book page so the popular list never links
 *  the reader to the page they are already on. */
export default async function Sidebar({ excludeSlug }: { excludeSlug?: string }) {
  const [popular, categories] = await Promise.all([
    getPopularBooks(5, excludeSlug),
    getCategories(),
  ]);

  return (
    <aside aria-label="আরও দেখুন" className="space-y-6">
      {/* .sticky-aside is inert below lg by definition (see globals.css), so
          there is no variant to remember here. */}
      <div className="sticky-aside space-y-6">
        {popular.length > 0 && (
          <section className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">
              জনপ্রিয় বই
            </h2>
            <ul className="mt-4 space-y-4">
              {popular.map((b) => (
                <li key={b.slug}>
                  <Link href={`/book/${b.slug}`} className="group flex items-start gap-3">
                    <span className="relative block aspect-cover w-11 shrink-0 overflow-hidden rounded-md border border-rule bg-surface-sunken">
                      <CoverImage src={b.coverImage} sizes="44px" className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-medium leading-snug text-ink transition group-hover:text-accent">
                        {b.title}
                      </span>
                      {b.authors.length > 0 && (
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          {b.authors.map((a) => a.name).join(", ")}
                        </span>
                      )}
                      <span className="mt-1 block">
                        <RatingStars rating={b.ratingAverage} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/popular"
              className="mt-4 inline-block text-sm font-semibold text-accent hover:underline"
            >
              সব দেখুন →
            </Link>
          </section>
        )}

        {categories.length > 0 && (
          <section className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">
              বিষয়সমূহ
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="chip hover:border-accent hover:text-accent"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <AdSlot placement="listing" minHeight={250} />
      </div>
    </aside>
  );
}

import Link from "next/link";
import { getCategories } from "@/lib/data";

/** The visible content of a 404, shared by BOTH not-found entry points.
 *
 *  There are two of them and they are not interchangeable, which is the whole
 *  reason this component exists:
 *
 *   - app/(frontend)/not-found.tsx handles a `notFound()` thrown by a page in
 *     that route group, and inherits the group layout's <html>, header and
 *     footer.
 *   - app/global-not-found.tsx handles every URL that matches no route at all,
 *     and has to render its own complete document because this app has three
 *     root layouts and Next cannot pick one for an unmatched URL.
 *
 *  Keeping the markup here means the two shells can differ (they must) while the
 *  page a reader sees cannot. Two copies of this JSX would drift, and the copy
 *  that drifts is the one nobody visits on purpose.
 *
 *  Async on purpose: a 404 that only says "not found" is a dead end, and the
 *  most common way to reach one here is a stale or mistyped book URL, where the
 *  reader still knows what KIND of book they wanted. The category list is read
 *  from the CMS at build time like every other page, so this stays fully
 *  static. */
export default async function NotFoundContent() {
  const categories = await getCategories();

  return (
    <div className="shell max-w-3xl py-16 text-center sm:py-24">
      <p className="text-6xl font-extrabold tracking-tight text-ink-muted/50">৪০৪</p>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        পাতাটি খুঁজে পাওয়া যায়নি
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
        যে পাতাটি খুঁজছেন সেটি হয়তো সরিয়ে ফেলা হয়েছে, অথবা লিংকটিতে ভুল আছে।
        খোঁজার পাতা থেকে বইটি খুঁজে নিতে পারেন, অথবা নিচের বিভাগগুলো ঘুরে দেখুন।
      </p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/search" className="btn-primary">
          বই খুঁজুন
        </Link>
        <Link href="/" className="btn-secondary">
          হোমপেজে ফিরুন
        </Link>
      </div>

      {categories.length > 0 && (
        <nav className="mt-12" aria-labelledby="nf-categories-heading">
          <h2
            id="nf-categories-heading"
            className="text-xs font-bold uppercase tracking-widest text-ink-muted"
          >
            বিভাগসমূহ
          </h2>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="chip hover:border-accent hover:text-accent"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts, safeJsonLd } from "@/lib/data";
import { formatBengaliDate, toBengaliNumerals } from "@/lib/numerals";
import { BLOG_SUBJECT, blogIndexTitle, SITE_NAME } from "@/lib/seo";
import Breadcrumb from "@/components/Breadcrumb";
import Sidebar from "@/components/Sidebar";
import { OG_IMAGE } from "@/lib/og";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

/** The standing description. Bare of the site name: the layout's title template
 *  appends it once. See /about. */
const DESCRIPTION =
  "বই নিয়ে বইদ্বীপের লেখালেখি: পড়ার তালিকা, লেখক পরিচিতি, বই আলোচনা ও পাঠ-পরামর্শ, সাথে প্রতিটি বইয়ের রিভিউ ও কেনার লিংক।";

/** generateMetadata rather than a const, for the same reason /popular is: the
 *  count in the title only exists after the posts are read, and a hand-written
 *  number is one nobody updates on the ninth post. */
export async function generateMetadata(): Promise<Metadata> {
  const posts = await getBlogPosts();
  const title = blogIndexTitle(posts.length);
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/blog" },
    openGraph: {
      title,
      description: DESCRIPTION,
      url: "/blog",
      type: "website",
      images: [OG_IMAGE],
    },
  };
}

export default async function BlogIndexPage() {
  const posts = await getBlogPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    // The same @id the posts point at with isPartOf, so the graph joins up
    // instead of describing two unrelated Blogs.
    "@id": `${SITE_URL}/blog#blog`,
    name: `${SITE_NAME} ব্লগ`,
    description: DESCRIPTION,
    url: `${SITE_URL}/blog`,
    inLanguage: "bn",
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(posts.length > 0
      ? {
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            description: p.summary,
            url: `${SITE_URL}/blog/${p.slug}`,
            datePublished: p.publishDate,
          })),
        }
      : {}),
  };

  return (
    <div className="shell py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: "ব্লগ" }]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header className="card p-5 sm:p-7">
            {/* BLOG_SUBJECT, not a literal "ব্লগ": the heading and the title are
                one decision, and this page's used to be two — an h1 of "ব্লগ"
                under a <title> of "ব্লগ" named nothing a reader searches for. */}
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {BLOG_SUBJECT}
            </h1>
            {posts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{toBengaliNumerals(posts.length)}টি লেখা</span>
                <span className="chip">নতুনটি আগে</span>
              </div>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
              পড়ার তালিকা, লেখক পরিচিতি, বই আলোচনা ও পাঠ-পরামর্শ। প্রতিটি লেখায় আলোচিত
              বইয়ের রিভিউ, ফ্রি PDF ও কেনার লিংক একসাথে।
            </p>
          </header>

          {posts.length === 0 ? (
            <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
              লেখাগুলো শীঘ্রই প্রকাশিত হবে।
            </p>
          ) : (
            /* An <ol>, because the order is the meaning: newest first, which the
               chip above states. It used to be a bare <div> of <article>s, so
               nothing told assistive tech this was one sequence of n items. */
            <ol className="mt-6 space-y-5">
              {posts.map((p) => (
                <li key={p.slug}>
                  <article className="card-interactive relative p-5 sm:p-6">
                    <h2 className="text-lg font-bold leading-snug text-ink">
                      {/* The stretched link: the whole card is clickable but the
                          anchor stays a single element for assistive tech. */}
                      <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0">
                        {p.title}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">
                      {p.summary}
                    </p>
                    <p className="mt-3 text-xs text-ink-muted">
                      {formatBengaliDate(p.publishDate)}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>

        <Sidebar />
      </div>
    </div>
  );
}

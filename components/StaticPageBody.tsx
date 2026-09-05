import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { getPage } from "@/lib/data";
import type { StaticPage } from "@/lib/types";

/** The rendered body of a CMS "Page" (about, contact, privacy policy, and any
 *  other one-off page an editor adds).
 *
 *  Split in two so the draft-preview route can render a page it fetched itself:
 *  StaticPageBody looks the page up in the published build-time store, which by
 *  definition cannot contain a draft, while StaticPageArticle is just markup and
 *  works for either. Same reason ChapterArticle exists — one set of markup, so a
 *  preview cannot show something different from what ships. */

export function StaticPageArticle({
  page,
  showBreadcrumb = true,
}: {
  page: StaticPage;
  showBreadcrumb?: boolean;
}) {
  return (
    <div className="shell max-w-3xl py-10">
      {showBreadcrumb && (
        <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: page.title }]} />
      )}
      <article className="card p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{page.title}</h1>
        <p className="mt-3 text-xs text-ink-muted">
          সর্বশেষ হালনাগাদ:{" "}
          <time dateTime={page.updatedAt}>
            {new Date(page.updatedAt).toLocaleDateString("bn-BD", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </p>
        <div
          className="prose-book prose mt-6 max-w-none prose-p:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
        />
      </article>
    </div>
  );
}

export default async function StaticPageBody({ slug }: { slug: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return <StaticPageArticle page={page} />;
}

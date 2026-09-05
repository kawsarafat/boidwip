import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPages, getPage } from "@/lib/data";
import { isReservedRouteSlug } from "@/lib/types";
import StaticPageBody from "@/components/StaticPageBody";
import { OG_IMAGE } from "@/lib/og";

/** CMS-managed static pages at the top level of the domain: /<slug>.
 *
 *  Two exclusion lists keep this catch-all honest:
 *
 *  - RESERVED_PAGE_SLUGS: about/contact/privacy-policy have dedicated static
 *    routes (app/(frontend)/about etc.) that Next.js matches before falling
 *    through to this dynamic segment — excluded only to avoid prerendering an
 *    unreachable duplicate.
 *  - isReservedRouteSlug: the English route namespaces (book, author,
 *    publisher, category, series, list, search, new, popular, blog) are real
 *    routes on this site. A CMS page must never be able to shadow one; the
 *    collection validates against the same list on save, and this filter is
 *    the render-side belt to that admin-side braces. */
const RESERVED_PAGE_SLUGS = ["about", "contact", "privacy-policy"];

// A slug this build did not prerender is a 404 rather than a request-time
// render. This route catches every unmatched top-level path on the domain, so
// the default (true) would turn every typo URL into a Postgres query.
export const dynamicParams = false;

export async function generateStaticParams() {
  const pages = await getPages();
  return pages
    .filter((p) => !RESERVED_PAGE_SLUGS.includes(p.slug) && !isReservedRouteSlug(p.slug))
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  // Bare. The layout's title template appends " | বইদ্বীপ" to whatever a route
  // supplies, for <title> and og:title alike, so naming the site here produced
  // it twice.
  const title = page.title;
  return {
    title,
    alternates: { canonical: `/${page.slug}` },
    // Explicitly set rather than left out: a page that defines no openGraph
    // block AT ALL keeps the root layout's site-wide default og:title, which
    // would describe the site instead of this page. (Defining the block and
    // omitting the title would inherit this page's own resolved title, but
    // relying on that is a subtlety a future edit should not have to know.)
    openGraph: {
      title,
      url: `/${page.slug}`,
      type: "website",
      images: [OG_IMAGE],
    },
  };
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  return <StaticPageBody slug={slug} />;
}

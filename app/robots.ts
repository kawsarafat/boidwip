import type { MetadataRoute } from "next";

/** Deliberately at the `app` root rather than inside app/(frontend), unlike
 *  every other route in this project.
 *
 *  Next 16 silently did not emit /robots.txt at all when this file sat inside
 *  the (frontend) route group — no error, no warning, the route was simply
 *  absent from the build manifest while sitemap.ts in the same directory
 *  worked fine. Since a missing robots.txt fails invisibly (search engines
 *  just fall back to crawling everything, including /admin), it is not
 *  something to leave to a quirk. Do not "tidy" this back into the group
 *  without checking that /robots.txt still appears in the build output. */
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Payload's admin panel, its REST API, and the draft-preview route.
      // None has any business in a search index, and all three are behind
      // auth anyway. /preview additionally sets robots noindex in its
      // metadata and an X-Robots-Tag header in next.config.ts, because a
      // crawled draft is the one preview failure that cannot be undone.
      //
      // "/search?" is the faceted-navigation rule, and it is a crawl rule
      // rather than a noindex because a noindex is not available here. The
      // search page is statically prerendered with a literal `export const
      // metadata`; emitting `noindex` for /search?q=x but not for /search
      // would mean reading searchParams in generateMetadata, which makes the
      // route dynamic and breaks the "every public route is prerendered" rule
      // the whole site is built on. What the query URLs get instead is
      // `alternates.canonical: "/search"` on the page plus this line, which is
      // the pairing Google's own faceted-navigation guidance describes.
      //
      // The trailing "?" is load-bearing: it matches only URLs that carry a
      // query string, so /search itself — a real landing page, linked from the
      // drawer and listed in the sitemap — stays crawlable. Nothing on the
      // site links to a query URL with an anchor anyway (the header box and
      // the filter chips navigate through the router), so this exists for the
      // links readers share, which is exactly where thin duplicates of one
      // result set come from.
      disallow: ["/admin", "/api", "/preview", "/search?"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

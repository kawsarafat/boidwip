/** The one description of the fallback social card, used by every page's
 *  `openGraph.images`. Served by app/(frontend)/og.png/route.tsx.
 *
 *  WHY A ROUTE HANDLER AND AN EXPLICIT URL, rather than Next's opengraph-image
 *  file convention, which is the obvious way to do this and was how it used to
 *  work:
 *
 *  The convention emits a content-hashed URL (/opengraph-image-4usi79?a1b2...)
 *  that no other file can write down, and it is only merged into a page's tags
 *  when that page does NOT define its own `openGraph` object. Every page here
 *  defines one, deliberately - see the note in app/(frontend)/[slug]/page.tsx
 *  about openGraph.title inheritance. So the convention's image was never
 *  merged anywhere except the homepage, and the hardcoded `/opengraph-image`
 *  written in its place 404s, because that bare path is not a route Next ever
 *  serves. The result was no share image at all on every subject hub, every
 *  /type listing, all three static pages and every chapter without an uploaded
 *  cover, plus no Twitter card anywhere including the homepage.
 *
 *  That failed silently in the worst way: the tags were present and looked
 *  right in the HTML, so only fetching the URL revealed it. If you change this
 *  path, fetch it - a 200 and `content-type: image/png` is the check.
 *
 *  The path is relative on purpose. `metadataBase` in app/(frontend)/layout.tsx
 *  resolves it, so this stays correct across localhost, previews and the real
 *  domain. JSON-LD is the exception: it has no metadataBase, so the chapter
 *  Article node builds an absolute URL from SITE_URL by hand.
 *
 *  width/height/alt are here because a scraper given the dimensions up front
 *  can reserve the space and lay the card out on its first fetch instead of
 *  waiting on the download. */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Boidwip, Free Bengali Book PDFs, Reviews & Online Reading",
};

/** `og:type` HAS THE SAME NON-MERGE PROBLEM AS THE IMAGE ABOVE, so every page
 *  spells it out even though app/(frontend)/layout.tsx already declares
 *  `type: "website"`.
 *
 *  Next replaces a parent's `openGraph` object wholesale rather than merging it
 *  field by field (`title` is the one exception, because it goes through a
 *  template). Since every page here defines its own `openGraph` — it has to, for
 *  the image and the url — the root's `type` reached exactly one page, the
 *  homepage. Nineteen of the thirty URLs in the sitemap shipped with no
 *  `og:type` at all: the three static pages, every /category, every /author,
 *  both listing hubs, /blog, /search and the whole reader.
 *
 *  A missing `og:type` degrades rather than breaks — consumers assume
 *  "website" — which is why it survived so long. It is still wrong: the
 *  property is one of Open Graph's four required ones, and the site was
 *  inconsistent about it (a book page said "book", a list said "article", a
 *  category said nothing), which is the part that reads as an oversight to
 *  anything validating the markup. */

/** Absolute form, for the contexts that cannot use metadataBase (JSON-LD). */
export function absoluteOgImage(siteUrl: string): string {
  return `${siteUrl}${OG_IMAGE.url}`;
}

/** An uploaded media URL made absolute for JSON-LD, or null when there is
 *  nothing to point at.
 *
 *  WHY THE ALREADY-ABSOLUTE TEST. Payload's media `url` is RELATIVE
 *  (`/api/media/file/cover.jpg`) on a local install and ABSOLUTE
 *  (`https://<r2-host>/cover.jpg`) the moment NEXT_PUBLIC_R2_PUBLIC_URL is set —
 *  same field, same code path, two shapes depending only on the environment.
 *  Three JSON-LD nodes (blog post `image`, author `image`, publisher `logo`)
 *  prefixed it with SITE_URL unconditionally, which is right locally and in
 *  production emits `https://boidwip.vercel.app/https://cdn.example/cover.jpg`;
 *  a fourth (the book page's `image`) emitted the bare relative path instead.
 *  An image URL that 404s is not a cosmetic flaw — Google validates the image
 *  before granting a rich result and drops the enclosing node when it cannot
 *  fetch one. Neither arm is a call site's business to know, so it lives here.
 *
 *  Anchored `^https?://` rather than a substring test: a filename that merely
 *  contains "http" is still a relative path. */
export function absoluteMediaUrl(
  siteUrl: string,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `${siteUrl}${path}`;
}

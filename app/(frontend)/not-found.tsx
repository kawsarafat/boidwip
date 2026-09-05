import NotFoundContent from "@/components/NotFoundContent";

/** Rendered when a page inside this route group calls `notFound()`. It inherits
 *  this group's layout, so it needs no <html>, no header and no footer - only the
 *  page body.
 *
 *  IT DOES NOT HANDLE UNMATCHED URLS, and assuming it did was the bug. A
 *  not-found file inside a route group is scoped to that group's segments; the
 *  global 404 for a URL matching no route at all is resolved at the app root, and
 *  this app has three root layouts and no app/layout.tsx, so there is no single
 *  layout Next could compose one from. It fell through to Next's built-in default
 *  instead: an English "This page could not be found" on a bare <html> with no
 *  lang, no styles and no navigation. See app/global-not-found.tsx, which is what
 *  actually covers that case now.
 *
 *  Worth knowing why the gap was almost total rather than an edge case: all three
 *  dynamic routes set `dynamicParams = false`, so an unlisted param never runs
 *  the page component and never reaches the `notFound()` call inside it. A
 *  mistyped chapter slug - the single most likely 404 on this site - was resolved
 *  by the router, not by this file. */
export default function NotFound() {
  return <NotFoundContent />;
}

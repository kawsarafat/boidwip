import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./(frontend)/globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import NotFoundContent from "@/components/NotFoundContent";
import { bodyFont } from "@/lib/fonts";
import { themeInitScript } from "@/lib/themeScript";

/** The 404 for every URL that matches no route at all.
 *
 *  WHY THIS FILE EXISTS AT ALL, because app/(frontend)/not-found.tsx looks like
 *  it should already cover this and does not. Next resolves the global 404 - the
 *  one an unmatched URL gets - at the APP ROOT, and it needs a root layout to
 *  render that page inside. This app has no app/layout.tsx: (frontend), (payload)
 *  and (preview) each supply their own <html>, so there are three root layouts and
 *  an unmatched URL belongs to none of them. With no single layout to compose from,
 *  Next fell all the way through to its built-in default 404 - 7 KB of English
 *  "This page could not be found" on a bare <html> with no lang attribute, no
 *  stylesheet, no header and no way back into the site. The styled Bengali 404 in
 *  the route group was never reached by it and was effectively dead code.
 *
 *  `global-not-found` is Next's own answer to exactly this case (its docs name
 *  "multiple root layouts" as the reason it exists). It is handled at the routing
 *  level and skips rendering any layout, which is why this file must return a
 *  COMPLETE document, <html> and <body> included, and must import the global
 *  stylesheet and the font itself. It is still experimental, so it is switched on
 *  by `experimental.globalNotFound` in next.config.mjs - if that flag is ever
 *  dropped, this file stops being picked up and the default 404 comes back
 *  silently. There is no warning for that, so treat the flag as load-bearing.
 *
 *  The blast radius before this was close to total, not an edge case: all three
 *  dynamic routes set `dynamicParams = false`, so a param that
 *  `generateStaticParams` did not return is refused by the router without ever
 *  running the page component. A mistyped or stale chapter link - the single most
 *  likely 404 on a site whose URLs get shared between students - never reached the
 *  `notFound()` call in [slug]/[chapter]/page.tsx.
 *
 *  Deliberately NOT here, both by policy rather than by omission:
 *
 *   - **No AdSense script and no ad slots.** Google's policies treat an error page
 *     as a page without publisher content, so monetising one risks the account for
 *     traffic that was going to bounce anyway. This is the one page on the site
 *     that renders no ad.
 *   - **No SpeedInsights.** A 404 is not a page whose Core Web Vitals are worth
 *     optimising, and sampling it only dilutes the numbers for the pages that are.
 *     `Analytics` IS kept, because "which dead URLs are readers actually hitting"
 *     is the one useful thing a 404 reports. */

export const metadata: Metadata = {
  title: "পাতাটি খুঁজে পাওয়া যায়নি | বইদ্বীপ",
  description:
    "যে পাতাটি খুঁজছেন সেটি পাওয়া যায়নি। বইদ্বীপের বিভাগভিত্তিক বইয়ের তালিকা ও ফ্রি PDF দেখুন।",
  // No `robots: { index: false }` needed. Next injects
  // <meta name="robots" content="noindex"> automatically for anything answering
  // with a 404 status, this file included.
};

export const viewport: Viewport = {
  // The --canvas literals, duplicated from app/(frontend)/layout.tsx because
  // this route is outside that layout by definition. Change one, change both.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1319" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function GlobalNotFound() {
  return (
    /* Same shell as app/(frontend)/layout.tsx, and the two are meant to stay in
       step: a reader who lands here should not be able to tell they left the
       site's chrome. The font and the theme script are IMPORTED rather than
       redeclared (lib/fonts.ts, lib/themeScript.ts) precisely so they cannot
       drift - see the header of lib/fonts.ts for what a second font-loader
       instance would silently do to this page.

       suppressHydrationWarning for the same reason it is on the layout's <html>:
       the theme script adds `dark` to this element before React hydrates, so the
       server's class and the client's DOM genuinely differ. Scoped to this
       element only, so a real mismatch inside the page is still reported. */
    <html lang="bn" className={bodyFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-canvas font-body text-base text-ink antialiased">
        <a href="#main" className="skip-link">
          মূল কনটেন্টে যান
        </a>

        <Header />
        <main id="main">
          <NotFoundContent />
        </main>
        <Footer />
        <BackToTop />

        <Analytics />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_Bengali } from "next/font/google";
import "../(frontend)/globals.css";

/** Root layout for the draft-preview route, deliberately separate from
 *  app/(frontend).
 *
 *  Two reasons it is its own route group rather than a page inside (frontend):
 *
 *   1. AGENTS.md rules out request-time dependencies anywhere under
 *      app/(frontend) — a single one turns a prerendered page into a serverless
 *      function. Preview is inherently request-time (it reads the admin session
 *      cookie), so it lives outside that boundary instead of being an exception
 *      to it. The build's route table stays honest: everything in (frontend) is
 *      still `○`.
 *
 *   2. No Analytics, no Speed Insights, no AdSense script. Editor traffic is not
 *      reader traffic; counting it would pollute the numbers the site is
 *      actually being judged on, and serving ads on a noindex page nobody
 *      visited is what AdSense's invalid-traffic policy exists to catch.
 *
 *  Header and Footer are left out too, and that one is about speed rather than
 *  principle: both call getSubjects(), which builds the whole published store —
 *  every chapter's Lexical body converted to HTML — just to render a nav list.
 *  At build time that cost is paid once for the entire site. Paying it again on
 *  every preview click, to render chrome the editor is not reviewing, would make
 *  preview feel broken as the site grows. */

// Same variable-font call as app/(frontend)/layout.tsx, and it has to stay the
// same: two next/font calls with identical options resolve to the same cached
// files, so preview reuses the site's font rather than shipping a second copy.
const body = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "প্রিভিউ",
  // Belt and braces with app/robots.ts and the X-Robots-Tag header in
  // next.config.mjs. An unpublished draft reaching a search index is the one
  // failure mode of a preview route that cannot be undone, so all three stay.
  robots: { index: false, follow: false },
};

// The dark-mode class has to be set before first paint here for the same
// reason it does on the public site, otherwise an editor previewing in dark
// mode sees a white flash. Kept as a plain inline script rather than
// next/script because this layout has no other client JS and pulling the
// script runtime in for one line is not worth it.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={body.variable}>
      <body className="min-h-screen bg-canvas font-body text-base text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}

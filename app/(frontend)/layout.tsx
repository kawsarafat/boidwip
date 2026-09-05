import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import { safeJsonLd } from "@/lib/types";
import { OG_IMAGE } from "@/lib/og";
import { adsenseClient } from "@/lib/ads";
import { SITE_NAME, HOME_TITLE } from "@/lib/seo";
import { bodyFont as body } from "@/lib/fonts";
import { themeInitScript } from "@/lib/themeScript";

// Anek Bangla (variable) is used for both headings and body text. Hierarchy
// comes from weight (700/800 for headings, 400/500 for body) and size rather
// than mixing in a second family — Bengali has no widely-available serif that
// pairs well with a Latin serif anyway.
//
// The loader itself lives in lib/fonts.ts, and the reason is app/global-not-found.tsx:
// that file renders its own complete <html> document (it has to — see its header)
// and needs this exact font. Calling the loader there as well would build a
// second instance with its own class name, so `--font-body` would be scoped to
// a class the 404's <html> does not carry. One instance, imported twice.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

// The homepage title, and the fallback for any page that sets none. It lives in
// lib/seo.ts beside every other title formula rather than being assembled here:
// this is the only <title> on the site the template below does not build, and
// the reason it is short and brand-last is written down there.
const DEFAULT_TITLE = HOME_TITLE;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "পাবলিক ডোমেইন ও উন্মুক্ত লাইসেন্সের বাংলা বইয়ের ফ্রি PDF ডাউনলোড, অনলাইনে পড়া, আর সব বইয়ের রিভিউ, সারসংক্ষেপ ও কেনার লিংক এক জায়গায়।",
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
    types: {
      // Surfaces the feed to readers and to feed-discovery tools.
      "application/rss+xml": `${SITE_URL}/rss.xml`,
    },
  },
  // NOTE: no `manifest:` field here. app/manifest.ts is a Next file convention
  // and already emits <link rel="manifest">; setting it here too produces a
  // second identical tag.
  openGraph: {
    // The SAME "%s | brand" rule as the <title> above, declared here because
    // Next keeps three separate title templates — `title`, `openGraph.title`
    // and `twitter.title` — and only applies each to its own surface. With no
    // template here, a page's `openGraph: { title }` was used verbatim: entity
    // pages (which pass a bare title, per lib/seo.ts) emitted a brand-less
    // og:title, while the static pages spelled the brand out by hand and so
    // emitted it twice in <title>. Declaring the template once means every page
    // passes a BARE title to every surface and the brand is appended exactly
    // once, wherever it lands.
    //
    // A page that sets no og title at all is unaffected and still correct:
    // Next copies the already-resolved <title> across (see
    // inheritFromMetadata in next/dist/lib/metadata/resolve-metadata.js), so
    // both routes through this end at the same string.
    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    type: "website",
    locale: "bn_BD",
    siteName: SITE_NAME,
    url: SITE_URL,
    images: [OG_IMAGE],
  },
  // Twitter reads its own tags and ignores og:* for card type. Without this a
  // shared book renders as a small thumbnail instead of a large image.
  twitter: {
    card: "summary_large_image",
    // Same template, same reason — a bare `twitter: { title }` on a page would
    // otherwise be the one surface that never names the site.
    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    images: [OG_IMAGE],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  // Paste the verification code Google Search Console / Bing Webmaster Tools
  // give you into these env vars in Vercel; no code change needed.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = {
  // Colours the browser chrome on mobile to match the page. Values are the
  // literal --canvas tokens from globals.css; CSS variables cannot be used
  // here because this is a meta tag, not a stylesheet. app/global-not-found.tsx
  // carries its own copy of this pair (it is outside this layout by definition),
  // so the two move together.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1319" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  // Deliberately NOT maximum-scale=1. Blocking pinch-zoom on a page of dense
  // Bengali text is an accessibility failure, and Safari ignores it anyway.
  viewportFit: "cover",
};

// Sitewide structured data. Both nodes in one @graph rather than two script
// tags, so the Organization and the WebSite can reference each other by @id —
// which is what lets Google treat them as one entity instead of two unrelated
// blobs. The WebSite node's SearchAction is what makes the site eligible for a
// sitelinks search box.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.svg`,
      },
      description:
        "বাংলা বইয়ের ক্যাটালগ: পাবলিক ডোমেইন বইয়ের ফ্রি PDF, রিভিউ ও কেনার লিংক।",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "bn",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

// The theme init script lives in lib/themeScript.ts for the same reason as the
// font: app/global-not-found.tsx renders its own <html> and has to run the
// identical script, or the 404 flashes the light theme at a reader whose
// stored choice is dark.

export default function RootLayout({ children }: { children: ReactNode }) {
  // Shape-checked (lib/ads.ts) rather than read raw from the environment. This
  // value is interpolated into the script URL below, so a pasted "pub-1234..."
  // or a whole <script> snippet in the variable would otherwise produce a
  // request that 404s with nothing on the page to explain it.
  const client = adsenseClient();

  return (
    /* suppressHydrationWarning is load-bearing here and is scoped to exactly
       the element that needs it. The theme script below runs before React
       hydrates and adds `dark` to this element's class list, so for anyone
       whose stored choice or OS setting is dark, the server's `class` and the
       client's DOM genuinely differ by the time hydration compares them.
       There is no way to render the right class on the server: the theme
       lives in localStorage and prefers-color-scheme, neither of which the
       server can see. The flag suppresses mismatches on THIS element only. */
    <html lang="bn" className={body.variable} suppressHydrationWarning>
      <head>
        {/* Theme init, first thing in <head> so the class lands before the
            first paint. A PLAIN inline <script>, not next/script — see the
            themeScript module header for why. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(siteJsonLd) }}
        />
        {/* Warms the TCP + TLS handshake to the ad host before any ad unit
            asks for it. Only emitted when ads are actually configured. */}
        {client && (
          <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="" />
        )}
      </head>
      <body className="min-h-screen bg-canvas font-body text-base text-ink antialiased">
        {/* First focusable thing on every page. Without it a keyboard or
            screen-reader user tabs through the whole category nav on every
            single page before reaching the content. */}
        <a href="#main" className="skip-link">
          মূল কনটেন্টে যান
        </a>

        <Header />
        <main id="main">{children}</main>
        <Footer />
        <BackToTop />

        <Analytics />
        <SpeedInsights />
        {/* Site-wide AdSense script. Needed for the AdSense application
            review itself, not just after approval — set
            NEXT_PUBLIC_ADSENSE_CLIENT to your "ca-pub-…" value once you sign
            up. Individual ad units (AdSlot.tsx) need a per-placement slot id
            on top of this and stay invisible without one. */}
        {client && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}

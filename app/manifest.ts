import type { MetadataRoute } from "next";

/** Web app manifest, served at /manifest.webmanifest by Next's file convention.
 *
 *  It lives at app/manifest.ts, NOT inside app/(frontend), which is where the
 *  rest of the public site's metadata files are. Unlike sitemap.ts, the manifest
 *  convention is only detected at the app root: with the identical file inside
 *  the route group the build emitted no /manifest.webmanifest route and no
 *  <link rel="manifest"> at all, silently. Same placement as app/robots.ts.
 *
 *  This is not an attempt to be a full PWA — there is no service worker and no
 *  offline story, because the offline story here is the PDF a reader downloads.
 *  What the manifest actually buys:
 *
 *   - "Add to home screen" on Android produces a real name and icon instead of
 *     a screenshot thumbnail labelled with the URL. Readers coming back to the
 *     catalogue is the whole traffic model, so a home-screen icon is worth
 *     more here than on most sites.
 *   - theme_color / background_color colour the splash and task switcher to
 *     match the site. Values are the literal light-mode --canvas and --accent
 *     tokens; a CSS variable cannot be read from here.
 *
 *  display is "standalone" rather than "browser" deliberately, and it is honest:
 *  every route is a real URL, so nothing breaks when the browser chrome is gone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "বইদ্বীপ: বাংলা বইয়ের দ্বীপ",
    short_name: "বইদ্বীপ",
    description:
      "পাবলিক ডোমেইন ও অনুমতিপ্রাপ্ত বাংলা বইয়ের ফ্রি PDF ডাউনলোড, অনলাইনে পড়া, রিভিউ-রেটিং ও কেনার লিংক, সব এক দ্বীপে।",
    lang: "bn",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The splash screen an installed PWA shows before the first paint: canvas
    // behind, accent for the title bar. Both are the light-theme literals from
    // globals.css, because a manifest cannot read a CSS variable.
    background_color: "#F7F8FA",
    theme_color: "#93233B",
    categories: ["books", "entertainment", "education"],
    icons: [
      {
        src: "/icon.svg",
        // "any" rather than a pixel size: it is a vector, so claiming 192x192
        // would be a lie that some launchers act on by rasterising at exactly
        // that size.
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    // The one action worth one tap from a home-screen icon. Search is where a
    // reader with a specific book in mind actually wants to land.
    shortcuts: [
      {
        name: "বই খুঁজুন",
        short_name: "খুঁজুন",
        url: "/search",
      },
    ],
  };
}

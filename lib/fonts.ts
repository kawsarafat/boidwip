import { Anek_Bangla } from "next/font/google";

/** The site's one typeface, loaded once and imported by every root-level entry
 *  that needs it.
 *
 *  WHY THIS IS ITS OWN MODULE. If this were a `const` inside
 *  app/(frontend)/layout.tsx it would be fine while that layout is the only
 *  place an <html> tag is rendered — but app/global-not-found.tsx renders its
 *  own complete document (see that file's header for why it has to), so it needs
 *  the same font, and calling `Anek_Bangla()` a second time there would create a
 *  SECOND font loader instance: another generated CSS class, another
 *  `--font-body` custom property scoped to a different class name, and two sets
 *  of preload tags for the same files. next/font dedupes the downloaded files,
 *  not the class names, so the failure mode is a 404 page whose text falls back
 *  to the system Bengali font while every other page renders correctly.
 *  Importing one instance is what keeps them identical.
 *
 *  WHY ANEK BANGLA. It is a variable font designed for screen reading with a
 *  full Bengali conjunct set, and its latin companion keeps mixed
 *  Bengali/English lines (book titles, "PDF", prices) on one visual rhythm.
 *
 *  NO `weight` ARRAY, and that is the LCP fix rather than a tidy-up. Naming
 *  weights makes next/font fetch one STATIC file per weight per subset; this
 *  design uses several (400/500/600/700/800) across two subsets — many
 *  preloaded files, and the Bengali ones are not small because the script needs
 *  several hundred glyphs plus conjunct forms. Every one competes for bandwidth
 *  with the HTML of a page whose LCP element is a line of Bengali text, and
 *  with `display: swap` the swap-in repaints that element, so a late font moves
 *  LCP directly.
 *
 *  Omitting `weight` opts into the variable font instead: ONE file per subset
 *  covering the whole weight range. Do not "pin the weights we use" here; that
 *  reads like an optimisation and is the opposite of one. Only the wght axis
 *  ships, which is what keeps the variable file smaller than two static ones.
 *
 *  Self-hosted by next/font at build time: no request to fonts.googleapis.com
 *  on load, no render-blocking stylesheet, and no font host in the CSP. */
export const bodyFont = Anek_Bangla({
  subsets: ["bengali", "latin"],
  variable: "--font-body",
  display: "swap",
});

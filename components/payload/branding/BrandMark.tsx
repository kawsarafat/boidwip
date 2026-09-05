import * as React from "react";
import styles from "./BrandMark.module.css";

/** The বইদ্বীপ mark: an open book as an island under a sun, on a rounded
 *  wine tile.
 *
 *  Shared by Icon.tsx (nav header, mobile app bar) and Logo.tsx (login screen), so
 *  the two are one mark at two sizes rather than two drawings that have to be kept
 *  in step. It mirrors `public/icon.svg` - the site's favicon, apple-touch icon and
 *  PWA icon - because an editor arriving at /admin should recognise the CMS as
 *  belonging to the site, and because a second, slightly-different mark is the kind
 *  of thing nobody notices until it is on a screenshot. Change one, change both
 *  (and components/SiteMark.tsx, the third copy the public header carries).
 *
 *  WHY IT IS THIS FEW SHAPES
 *
 *  The favicon is the constraint, not the login screen. At 16px the only things
 *  that survive are the silhouette and one colour contrast, so the mark is built to
 *  read at that size first: a warm sun disc, a pale sand arc, and the open book's
 *  two leaves splitting at the spine — "island" and "book" in one silhouette.
 *  Detail that would only appear at 96px (page rules, a shaded spine) is kept to
 *  the two hairline text-strokes, which vanish gracefully when rasterised small
 *  instead of turning to noise.
 *
 *  The amber sun is doing work, not decoration. Cream-on-wine survives 16px but
 *  wine-on-wine would not; the sun is the element that makes the tile
 *  identifiable in a row of browser tabs. */

export default function BrandMark({
  className,
  title,
}: {
  className?: string;
  /** Supplying a title makes the tile an image with an accessible name.
   *  Omitting it marks the tile decorative, which is correct wherever adjacent
   *  text already names the product - Logo.tsx sets its own wordmark that way. */
  title?: string;
}): React.ReactElement {
  return (
    <svg
      className={[styles.mark, className].filter(Boolean).join(" ")}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* The gradient id is namespaced because SVG ids are document-global: Icon
        * and Logo can both be mounted at once (nav header plus a mobile drawer),
        * and two <defs> claiming the same id would leave one of them referencing
        * the other's element. Identical definitions make that harmless today, and
        * keeping it deliberate keeps it harmless after the next edit.
        *
        * Three stops rather than two: a straight light-to-dark wine ramp greys
        * out in the middle, and pinning the brand wine at 55% keeps the midtone
        * saturated. Same stops as public/icon.svg and components/SiteMark.tsx;
        * all three move together. */}
      <defs>
        <linearGradient id="bdw-brandmark-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A82A46" />
          <stop offset="0.55" stopColor="#93233B" />
          <stop offset="1" stopColor="#7A1B30" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="14" fill="url(#bdw-brandmark-tile)" />

      {/* The sun, high and slightly rising over the island. */}
      <circle cx="32" cy="26" r="9" fill="#F6C453" />

      {/* The island: a sand arc the book sits on. */}
      <path d="M15 38c5-8 11-12 17-12s12 4 17 12v3H15v-3z" fill="#F1E7D8" opacity=".95" />

      {/* The open book, two leaves splitting at the spine (x=32). The left leaf
        * is a touch brighter than the right, which is what makes it read as an
        * opened spread rather than a flat rectangle. */}
      <path d="M32 40c-4.5-3.4-10.5-4.6-17-4.2V50c6.5-.4 12.5.8 17 4.2V40z" fill="#FFFDF8" />
      <path d="M32 40c4.5-3.4 10.5-4.6 17-4.2V50c-6.5-.4-12.5.8-17 4.2V40z" fill="#F6EFE3" />

      {/* Two hairline text-strokes per leaf: enough to say "pages with writing"
        * at 32px+, invisible (harmlessly) at 16px. */}
      <path
        d="M19 42.5c3.4-.1 6.6.3 9.5 1.3M19 46.5c3.4-.1 6.6.3 9.5 1.3"
        stroke="#C9A87C"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M45 42.5c-3.4-.1-6.6.3-9.5 1.3M45 46.5c-3.4-.1-6.6.3-9.5 1.3"
        stroke="#C9A87C"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

import * as React from "react";
import Link from "next/link";
import type { ServerProps } from "payload";
import BrandMark from "./BrandMark";
import styles from "./NavBrand.module.css";

/** `admin.components.beforeNav` — registered by string path in payload.config.ts.
 *
 *  WHY THIS COMPONENT EXISTS AT ALL
 *
 *  Before it, the product was named in exactly two places in the whole panel: the
 *  login screen (Logo.tsx) and a 16px square in the breadcrumb trail (Icon.tsx).
 *  So from the moment an editor signed in, nothing on the screen said what they
 *  were signed in to, and the sidebar - the one element visible on every route -
 *  opened straight into a "CONTENT" group heading. That is the specific reason the
 *  panel still read as a generic CMS on the inner pages however much of the theme
 *  was applied to them.
 *
 *  WHERE IT LANDS, WHICH IS NOT OBVIOUS FROM THE SLOT NAME
 *
 *  `beforeNav` renders inside `.nav__scroll`, above `nav.nav__wrap`, so it is a
 *  flex item at the top of the sidebar's scrolling column rather than a fixed
 *  header outside it. Payload reserves room for it whether or not it is used:
 *  `.nav` sets `--nav-padding-block-start: var(--app-header-height)`, which is why
 *  a stock install has an empty strip at the top of the sidebar exactly the height
 *  of the app header. This block is sized to fill that strip and is sticky, so it
 *  stays put while a long collection list scrolls under it, and its bottom hairline
 *  lines up with the one chrome.css puts under `.app-header__content`. The two
 *  together read as one header band across the whole panel. See the sidebar section
 *  of app/(payload)/theme/chrome.css, which owns that arithmetic and the
 *  pointer-events fix that makes this link clickable at all.
 *
 *  A server component: it is a link, an inline SVG and two lines of static text, so
 *  it ships no client JavaScript. `payload.config.routes.admin` rather than a
 *  hardcoded "/admin" because that route is configurable, and a brand that links to
 *  the wrong place is worse than one that does not link anywhere. */
export default function NavBrand({ payload }: ServerProps): React.ReactElement {
  const adminRoute = payload.config.routes.admin;

  return (
    <Link className={styles.brand} href={adminRoute} prefetch={false}>
      {/* Decorative: the wordmark beside it is real text saying the same thing, and
        * labelling both would have a screen reader announce the product name twice
        * on the way into every page. Same reasoning as Logo.tsx. */}
      <BrandMark className={styles.tile} />
      <span className={styles.words}>
        <span className={styles.wordmark}>বইদ্বীপ</span>
        <span className={styles.label}>Content panel</span>
      </span>
    </Link>
  );
}

import * as React from "react";
import BrandMark from "./BrandMark";
import styles from "./Logo.module.css";

/** `admin.components.graphics.Logo` — registered by string path in
 *  payload.config.ts.
 *
 *  Payload renders this on the login screen, and on nothing else. Worth knowing
 *  what that screen actually contains, because it decides what this component has
 *  to do: @payloadcms/next's Login view renders the brand and then the form, with
 *  no heading of any kind. So this lockup is the only thing on the page that says
 *  which system the visitor is logging into, which is why it carries a wordmark
 *  and a line of explanatory text rather than being the tile on its own.
 *
 *  The tile is decorative here (no `title` passed, so BrandMark marks itself
 *  aria-hidden) because the wordmark beside it is real text saying the same
 *  thing. Labelling both would have a screen reader announce the product name
 *  twice before reaching the email field. */
export default function Logo(): React.ReactElement {
  return (
    <div className={styles.logo}>
      <BrandMark className={styles.tile} />
      <div className={styles.words}>
        <span className={styles.wordmark}>বইদ্বীপ</span>
        <span className={styles.tagline}>Content management panel</span>
      </div>
    </div>
  );
}

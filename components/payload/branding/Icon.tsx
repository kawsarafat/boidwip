import * as React from "react";
import BrandMark from "./BrandMark";
import styles from "./Icon.module.css";

/** `admin.components.graphics.Icon` — registered by string path in
 *  payload.config.ts.
 *
 *  Payload renders this in exactly one place: the home crumb of the breadcrumb
 *  trail in the app header (`.step-nav__home` in @payloadcms/ui's StepNav), which
 *  is a 16px square. The size lives in Icon.module.css as a percentage rather
 *  than as 16px here, so the mark follows that box instead of asserting a
 *  duplicate of it.
 *
 *  The mark is given a real accessible name rather than being hidden. Payload's
 *  default icon is an unlabelled decorative SVG inside a `<span title="...">`,
 *  and the `title` attribute sits on the span rather than on the surrounding
 *  link, so with the graphic hidden the link to the dashboard can end up with no
 *  accessible name at all. Naming the image names the link. */
export default function Icon(): React.ReactElement {
  return <BrandMark className={styles.icon} title="বইদ্বীপ dashboard" />;
}

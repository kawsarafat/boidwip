import * as React from "react";
import type { ServerProps } from "payload";
import { monogram } from "./monogram";
import styles from "./AccountAvatar.module.css";

/** `admin.avatar` — registered by string path in payload.config.ts.
 *
 *  WHY THIS REPLACES SOMETHING THAT ALREADY WORKED
 *
 *  Payload's `admin.avatar` defaults to `"gravatar"`, and the default is not a
 *  placeholder graphic: it renders
 *  `<img src="https://www.gravatar.com/avatar/<md5(email)>?default=mp&r=g&s=50">`.
 *  So the panel made a third-party request on every authenticated page load, sent
 *  gravatar.com an MD5 of the signed-in editor's email address plus the admin URL as
 *  the referrer, and got back the generic mystery-person silhouette, because nobody
 *  here has a Gravatar account. A network dependency, a privacy leak and a piece of
 *  stock Payload branding, all to draw a grey outline of a head.
 *
 *  It is also the last unbranded thing in the shell: the sidebar has NavBrand, the
 *  login screen has Logo, the breadcrumb has Icon, and then the top-right corner had
 *  someone else's avatar service.
 *
 *  HOW THE SLOT WORKS, BECAUSE IT IS NOT WHERE YOU WOULD LOOK
 *
 *  `@payloadcms/ui/dist/graphics/Account` handles only the `"default"` and
 *  `"gravatar"` strings and returns undefined for a component config, so reading it
 *  suggests a custom avatar is unsupported. The resolution happens a level up:
 *  DefaultTemplate renders this through `RenderServerComponent` with the full
 *  `serverProps` and passes the result down as `CustomAvatar`, and AppHeader drops it
 *  in as the only child of `<a class="app-header__account" href="/admin/account">`.
 *
 *  Two consequences. First, `user` arrives as a prop, so this needs no client
 *  JavaScript and no fetch: it is a `<span>` and a letter. Second, the anchor, its
 *  href and its `aria-label="Account"` all belong to Payload, so this component must
 *  not render a link of its own and must not restate the label. The focus ring on
 *  that anchor is in the top-bar section of app/(payload)/theme/chrome.css, because
 *  Payload's own is a square outline around what is now a circle.
 *
 *  `user` is optional in ServerProps although this slot only renders inside the
 *  authenticated template. An empty monogram degrades to a plain brand disc, which
 *  is why nothing here branches on it. */
export default function AccountAvatar({ user }: ServerProps): React.ReactElement {
  const initial = monogram(user?.name, user?.email);

  return (
    /* aria-hidden because the parent anchor is already labelled "Account". Without
     * it a screen reader reads the link's label and then the letter as its content,
     * announcing "Account ক" on the way into every page. */
    <span aria-hidden="true" className={styles.avatar}>
      {initial}
    </span>
  );
}

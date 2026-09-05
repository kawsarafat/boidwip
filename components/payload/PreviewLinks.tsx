"use client";

import React from "react";
import { useDocumentInfo } from "@payloadcms/ui";
import styles from "./PreviewLinks.module.css";

/** The sidebar "Preview" block on Chapters and Pages, registered as a `ui`
 *  field in both collections.
 *
 *  WHY THIS IS THE ONLY PREVIEW CONTROL
 *
 *  Payload's own `admin.preview` button (in the document controls) used to sit
 *  beside this, and this panel existed to guarantee the one thing that button
 *  could not: opening in ANOTHER tab. The button's target was Payload's
 *  decision, not ours — it has changed across versions and there is no config
 *  option for it. Having the same action in two places read as clutter, so the
 *  toolbar button was removed (`admin.preview` is gone from both collections)
 *  and this panel is now the single preview entry point. A plain anchor with
 *  target="_blank" cannot be talked out of opening a new tab, so the guarantee
 *  lives here.
 *
 *  It also has somewhere to put the caveat below, which a bare button does not:
 *  the preview renders the last SAVED version. That is not a limitation to be
 *  fixed, it is what a preview of a draft means — the server has to read the
 *  document from the database to render it, and it cannot read what is still
 *  only in the editor's browser. Saying so next to the link is the difference
 *  between a confusing preview and an accurate one. */
export default function PreviewLinks() {
  const { id, collectionSlug, savedDocumentData } = useDocumentInfo();

  // A document that has never been saved has no id, so there is nothing for
  // the preview route to load. Say that rather than rendering a dead link.
  if (!id || !collectionSlug) {
    return (
      <div className={styles.wrap}>
        <span className={styles.heading}>Preview</span>
        <p className={styles.note}>A preview link appears here once the document is saved.</p>
      </div>
    );
  }

  const href = `/preview?collection=${encodeURIComponent(
    collectionSlug
  )}&id=${encodeURIComponent(String(id))}`;

  const status = (savedDocumentData as { _status?: string } | undefined)?._status;
  const isPublished = status === "published";

  return (
    <div className={styles.wrap}>
      <span className={styles.heading}>Preview</span>
      <a
        className={styles.link}
        href={href}
        // The requirement, and the reason this component exists.
        target="_blank"
        rel="noopener noreferrer"
      >
        Open preview in a new tab
      </a>
      <p className={styles.note}>
        Shows the last saved state{isPublished ? "" : " (not published yet)"}. Anything changed
        in the editor and not yet saved will not appear in the preview.
      </p>
    </div>
  );
}

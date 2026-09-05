"use client";

import type { DefaultCellComponentProps } from "payload";
import { liveLinkState } from "@/lib/liveLink";
import { CellEmpty, CellPill } from "./CellPill";

/** The "Live" column: one click from a row in the admin list to that document's
 *  page on the site, in a new tab.
 *
 *  WHY IT IS A COLUMN AND NOT A BUTTON IN THE DOCUMENT. Checking a page used to
 *  cost four actions: open the row, find the preview panel, open the tab, come
 *  back. Reviewing a shelf of twenty books is the normal case, and twenty round
 *  trips through the edit view is why nobody checked. From the list the loop is
 *  one click per row and the list stays where it was.
 *
 *  WHICH OF FIVE STATES a row is in — live, previewable draft, draft, scheduled,
 *  nothing — is decided by liveLinkState() in lib/liveLink.ts, which is where the
 *  reasoning about a build-artefact site and its three page-less states is
 *  written down and unit-tested. This file only renders the answer.
 *
 *  ONE COMPONENT FOR EVERY COLLECTION. `collectionSlug` is a documented cell
 *  prop, and publicPathFor() (lib/types.ts) already owns the collection-to-URL
 *  map because lib/payload/slugHistory.ts needs the same one to write redirects.
 *  A per-collection copy of that map is how the redirect and the link end up
 *  pointing at different URLs. */
export default function LiveLinkCell({ rowData, collectionSlug }: DefaultCellComponentProps) {
  const state = liveLinkState(rowData, collectionSlug);

  switch (state.kind) {
    case "live":
      return (
        <a
          href={state.href}
          // The requirement. An anchor with target="_blank" cannot be talked out
          // of opening a new tab, which is why this is not a router push.
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
          title={state.title}
        >
          Live ↗
        </a>
      );

    case "preview":
      return (
        <a
          href={state.href}
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
          title={state.title}
        >
          Preview ↗
        </a>
      );

    case "draft":
      return <CellPill title={state.title}>Draft</CellPill>;

    case "scheduled":
      return (
        <CellPill tone="warning" title={state.title}>
          Scheduled
        </CellPill>
      );

    default:
      return <CellEmpty title={state.title} />;
  }
}

const linkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25em",
  fontSize: "var(--bdw-text-xs)",
  fontWeight: 500,
  whiteSpace: "nowrap" as const,
  textDecoration: "none",
  color: "var(--bdw-brand-strong)",
};

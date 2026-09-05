import * as React from "react";
import type { ConfirmTone } from "./types";

/** The tone glyphs, in their own file so ConfirmDialog.tsx stays about layout and
 *  this stays about paths.
 *
 *  Three different shapes rather than one shape in three colours. Colour alone is
 *  the usual shortcut here and it is the wrong one: it is the difference an editor
 *  with a red-green deficiency cannot see, and it disappears entirely in
 *  forced-colors mode, which is precisely when a delete confirmation most needs to
 *  look different from a question. An octagon, a triangle and a circle are
 *  distinguishable at 20px with no colour at all.
 *
 *  Stroked in currentColor, so the wrapper's tone class is the only thing that
 *  sets the colour. */

const PATHS: Record<ConfirmTone, React.ReactElement> = {
  /* Octagon: the stop-sign outline. Reserved for the destructive tone. */
  danger: (
    <>
      <path d="M8.7 2.9h6.6l4.8 4.8v6.6l-4.8 4.8H8.7l-4.8-4.8V7.7l4.8-4.8Z" />
      <path d="M12 7.8v5" />
      <path d="M12 15.6h.01" />
    </>
  ),
  /* Triangle: caution. Proceeding is allowed, the consequence is worth reading. */
  warning: (
    <>
      <path d="M12 3.4 21 19.2H3L12 3.4Z" />
      <path d="M12 9.2v4.6" />
      <path d="M12 16.4h.01" />
    </>
  ),
  /* Circle: a plain question, no downside either way. */
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.2v5" />
      <path d="M12 7.9h.01" />
    </>
  ),
};

export default function ToneIcon({ tone }: { tone: ConfirmTone }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      /* Decorative: the dialog's title says the same thing in words, and the
       * tone is also carried by the confirm button's own label. Announcing
       * "warning icon" before the title would just delay the sentence that
       * matters. */
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[tone]}
    </svg>
  );
}

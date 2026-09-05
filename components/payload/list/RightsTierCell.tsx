"use client";

import type { DefaultCellComponentProps } from "payload";
import { getRightsTierLabel, isRightsTier, type RightsTier } from "../../../lib/types";
import { CellEmpty, CellPill, type CellTone } from "./CellPill";

/** The `rightsTier` column in the Books list.
 *
 *  Rights tier is the field that decides what a book page may legally offer, and
 *  it is the second column in the list for that reason. As raw select values it
 *  rendered as four lowercase hyphenated strings in identical grey —
 *  "public-domain", "open-licence", "permitted", "in-copyright" — which forces
 *  the reader to actually read each row to find the one book that is
 *  in-copyright and therefore must never carry a PDF.
 *
 *  THE TONES ENCODE THE LEGAL DISTINCTION, not a ranking. Tiers A and B are
 *  settled: the licence travels with the work and nothing expires, so they are
 *  positive. `permitted` is neutral rather than positive because it rests on a
 *  document in the Evidence files collection that a human has to be able to
 *  produce on demand — it is a fact, not a state of rest. `in-copyright` is a
 *  warning, not an error: it is a perfectly normal and very common tier (most of
 *  the catalogue), it simply constrains what the page may do.
 *
 *  Labels come from lib/types.ts, so the tier vocabulary is defined once and the
 *  admin says exactly what the site says. They are the one deliberate exception
 *  to the English-admin-chrome rule: these four phrases are the books' own
 *  vocabulary, they appear verbatim on the public page, and translating them
 *  here would mean an editor checking a compliance decision against a label that
 *  no reader ever sees. */

const TIER_TONES: Record<RightsTier, CellTone> = {
  "public-domain": "positive",
  "open-licence": "positive",
  permitted: "neutral",
  "in-copyright": "warning",
};

const TIER_HINTS: Record<RightsTier, string> = {
  "public-domain": "Tier A — PDF download and the online reader are both allowed.",
  "open-licence": "Tier B — PDF download allowed, with the licence credited on the page.",
  permitted: "Tier C — PDF allowed because written permission is on file. No online reader.",
  "in-copyright": "Tier D — discovery only. No PDF and no full text, ever.",
};

export default function RightsTierCell({ cellData, rowData }: DefaultCellComponentProps) {
  // `cellData` is the select value; `rowData` is the fallback for a row Payload
  // rendered without selecting the column (a relationship drawer, for one).
  const raw = cellData ?? rowData?.rightsTier;

  // Fails closed like every other reader of this field: an unrecognised value is
  // not silently drawn as if it were fine. `lib/types.ts` treats a non-tier as
  // in-copyright, and a row that reaches this state is a data problem worth
  // seeing rather than smoothing over.
  if (!isRightsTier(raw)) {
    if (raw === null || raw === undefined || raw === "") return <CellEmpty title="No rights tier set" />;
    return (
      <CellPill tone="danger" title={`"${String(raw)}" is not one of the four rights tiers.`}>
        {String(raw)}
      </CellPill>
    );
  }

  return (
    <CellPill tone={TIER_TONES[raw]} title={TIER_HINTS[raw]}>
      {getRightsTierLabel(raw)}
    </CellPill>
  );
}

"use client";

import type { DefaultCellComponentProps } from "payload";
import { CellEmpty, CellPill, type CellTone } from "./CellPill";

/** The `status` column in the Reviews list — the moderation queue.
 *
 *  This list is scanned, not read: the job is "what is waiting for me", and the
 *  answer used to be three lowercase words in the same grey, so finding the
 *  pending rows in a page of fifty meant reading all fifty. A tone per state
 *  makes the queue depth visible from the top of the page.
 *
 *  PENDING IS THE WARNING TONE, and that is the whole point of the column:
 *  pending is the only one of the three that is a request for work. Approved is
 *  settled (positive), spam is a decision already made and needs nothing further
 *  (neutral, deliberately not danger — a wall of red for correctly-filed junk
 *  trains the eye to ignore red). */

type ReviewStatus = "pending" | "approved" | "spam";

const STATUS: Record<ReviewStatus, { label: string; tone: CellTone; hint: string }> = {
  pending: {
    label: "Pending",
    tone: "warning",
    hint: "Not on the site yet, and not counted in the book's rating. Waiting for a decision.",
  },
  approved: {
    label: "Approved",
    tone: "positive",
    hint: "Live on the book page and counted in its average rating.",
  },
  spam: {
    label: "Spam",
    tone: "neutral",
    hint: "Hidden from the site and excluded from the rating. Safe to leave here.",
  },
};

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === "pending" || value === "approved" || value === "spam";
}

export default function StatusCell({ cellData, rowData }: DefaultCellComponentProps) {
  const raw = cellData ?? rowData?.status;

  if (!isReviewStatus(raw)) {
    if (raw === null || raw === undefined || raw === "") {
      // The field is required with a default of "pending", so an empty status
      // means a row written around the collection rather than through it.
      return <CellEmpty title="No status set" />;
    }
    return (
      <CellPill tone="danger" title={`"${String(raw)}" is not a review status.`}>
        {String(raw)}
      </CellPill>
    );
  }

  const { label, tone, hint } = STATUS[raw];
  return (
    <CellPill tone={tone} title={hint}>
      {label}
    </CellPill>
  );
}

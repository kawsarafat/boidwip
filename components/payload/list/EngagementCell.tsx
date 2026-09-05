"use client";

import { useEffect, useState } from "react";
import type { DefaultCellComponentProps } from "payload";
import { CellEmpty, CellPill } from "./CellPill";

/** The `engagement` column in the Books list: how many reviews a book has, and
 *  how many of them are still waiting for a moderator.
 *
 *  WHAT THIS USED TO DO, AND WHY IT SHOWED NOTHING. It counted `/api/comments`
 *  filtered by `where[chapter][equals]=`, which is the shape of the project this
 *  admin panel was adapted from. Boidwip has no `comments` collection and no
 *  `chapter` field: every request 404'd, the catch set `failed`, and the column
 *  rendered an em dash on every row of every page forever. A column that is
 *  always empty is worse than no column — it reads as "no book has any reviews",
 *  which is a claim about the data rather than a bug in the panel.
 *
 *  WHY IT STILL FETCHES CLIENT-SIDE, PER ROW. The book carries denormalised
 *  `ratingCount`/`ratingAverage` (maintained by Reviews' afterChange hook), but
 *  those count APPROVED reviews only — by design, because they feed the public
 *  JSON-LD. The number an editor opening this list wants is the other one: how
 *  many are pending. That is a `count()` over Reviews, and computing it in an
 *  `afterRead` hook would run it on every read of a book INCLUDING the static
 *  build in lib/data.ts, which is exactly the request-time database traffic this
 *  site is built to avoid. So it happens in the browser, only in the admin, only
 *  for the rows actually on screen.
 *
 *  Results are memoised per book id for the life of the page, so paging back and
 *  forth does not refetch. Admin chrome, so the copy is English. */

type Counts = { total: number; pending: number };

// Shared across every mounted cell on the page, so the list does not refetch a
// row's counts each time it scrolls in and out or the user pages back.
const cache = new Map<number, Counts>();
const inflight = new Map<number, Promise<Counts>>();

async function fetchCount(query: string): Promise<number> {
  // The dedicated count endpoint, not `find` with `limit=1`: it answers with
  // `{ totalDocs }` and no documents at all. (`limit=0` would be the opposite of
  // a cheap query — in Payload that disables pagination and returns every row.)
  const res = await fetch(`/api/reviews/count?${query}`, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { totalDocs?: number };
  return typeof data.totalDocs === "number" ? data.totalDocs : 0;
}

async function loadCounts(bookId: number): Promise<Counts> {
  const cached = cache.get(bookId);
  if (cached) return cached;
  const existing = inflight.get(bookId);
  if (existing) return existing;

  const promise = (async () => {
    // Two counts rather than one fetch of every review: each is a COUNT in
    // Postgres, so neither pulls a review body into the browser.
    const [total, pending] = await Promise.all([
      fetchCount(`where[book][equals]=${bookId}`),
      fetchCount(`where[book][equals]=${bookId}&where[status][equals]=pending`),
    ]);
    const counts: Counts = { total, pending };
    cache.set(bookId, counts);
    return counts;
  })();
  inflight.set(bookId, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(bookId);
  }
}

export default function EngagementCell({ rowData }: DefaultCellComponentProps) {
  const bookId = typeof rowData?.id === "number" ? rowData.id : Number(rowData?.id);
  const [counts, setCounts] = useState<Counts | null>(
    Number.isFinite(bookId) ? cache.get(bookId) ?? null : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(bookId) || counts) return;
    let cancelled = false;
    loadCounts(bookId)
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, counts]);

  if (failed) return <CellEmpty title="Review counts could not be loaded." />;

  if (!counts) {
    // A spinner alone is not progress (AGENTS.md); a quiet ellipsis reads as
    // "loading" without animating forty rows at once.
    return (
      <span style={{ color: "var(--bdw-text-soft)", fontSize: "var(--bdw-text-sm)" }}>…</span>
    );
  }

  if (counts.total === 0) return <CellEmpty title="No reviews yet." />;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--bdw-space-1)" }}>
      <CellPill
        tone="brand"
        title={`${counts.total} review${counts.total === 1 ? "" : "s"} in total`}
      >
        {counts.total} {counts.total === 1 ? "review" : "reviews"}
      </CellPill>
      {counts.pending > 0 && (
        <CellPill tone="warning" title={`${counts.pending} awaiting moderation`}>
          {counts.pending} pending
        </CellPill>
      )}
    </span>
  );
}

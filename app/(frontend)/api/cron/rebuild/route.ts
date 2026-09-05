import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { forceRebuild, pendingRebuild } from "@/lib/payload/revalidate";
import { kvPrune } from "@/lib/payload/kv";

function isValidSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Different-length buffers would throw in timingSafeEqual — comparing
  // against itself first keeps this branch's timing independent of the
  // real secret's length too.
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** The daily deployment, and the only housekeeping pass this site has.
 *
 *  Vercel Cron (see vercel.json) hits this once a day. Since the site is a
 *  build artefact, a chapter with a future publishDate (see lib/data.ts) stays
 *  hidden even after its date passes — nothing rebuilds on its own just because
 *  a clock moved. This endpoint closes that gap, so scheduling a post actually
 *  works instead of being a label.
 *
 *  IT GOES THROUGH `forceRebuild`, WHICH IS THE POINT OF THIS FILE'S SECOND
 *  DRAFT. It used to POST the deploy hook itself, with its own timeout, its own
 *  error handling and its own comment claiming to match `queueRebuild()` in
 *  lib/payload/revalidate.ts. Two implementations of "trigger a deployment" is
 *  one too many: the copy here could not clear the dirty marker an editor's
 *  failed save had set, could not take the debounce claim, and drifted from the
 *  module the moment either side changed. Now the module owns the hook on every
 *  path — `forceRebuild` is deliberately undebounced, which is what the cron
 *  needs, since no editor action is happening at 00:00 to debounce against.
 *
 *  It reports the dirty marker BEFORE rebuilding, because that is the only
 *  moment it is observable: a successful `forceRebuild` clears it. Reading it is
 *  the one diagnostic that answers "did a publish silently fail to build
 *  yesterday?" from the cron log alone.
 *
 *  `kvPrune` runs last and its result is advisory. Nothing depends on expired
 *  rows being gone — every read treats an expired row as absent — so a prune
 *  that fails must not turn a successful deployment into a failed cron run.
 *
 *  Setup (see README): create a Deploy Hook in Vercel (Project Settings → Git →
 *  Deploy Hooks) and set its URL as VERCEL_DEPLOY_HOOK_URL. Also set
 *  CRON_SECRET to any random string — Vercel sends it back as a Bearer token on
 *  every cron request, which is what stops this endpoint from being triggered
 *  by anyone who finds the URL. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;

  // A plain !== comparison leaks timing information about how many
  // leading characters matched, which — with enough requests — can be
  // used to guess the secret one character at a time. timingSafeEqual
  // takes the same amount of time regardless of where the mismatch is.
  if (!process.env.CRON_SECRET || !isValidSecret(authHeader, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const payload = await getPayload({ config });

  // Read before the trigger clears it.
  const owed = await pendingRebuild(payload);

  const outcome = await forceRebuild(payload, "daily cron");

  // Advisory. A failed prune costs one pass's worth of dead rows, and the
  // deployment above has already been requested — losing that report to a
  // housekeeping error would be a strictly worse trade.
  let pruned: number | null = null;
  try {
    pruned = await kvPrune(payload);
  } catch (error) {
    payload.logger.error(
      `[cron] kv prune failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Always 200, even on failure. Vercel retries a failing cron, and retrying a
  // deploy hook that may well have fired is how one scheduled publish becomes
  // several builds. The status field is what a log reader should look at.
  return NextResponse.json({
    ok: outcome.triggered,
    status: outcome.status,
    detail: outcome.detail,
    // What was owed from a previous failed or deferred trigger, if anything.
    pendingBefore: owed,
    prunedRows: pruned,
    at: new Date().toISOString(),
  });
}

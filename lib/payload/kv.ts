import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";
import { dbExec, num, type DbStatement } from "./db";

/** Atomic key-value primitives on Postgres — the small amount of MUTABLE
 *  state a fully static site still needs at request time.
 *
 *  There are exactly three things on this site that cannot be answered from a
 *  build artefact, and all three are counters or locks:
 *
 *    rate limits    how many reviews has this IP submitted in ten minutes
 *    login nonces   has this particular Turnstile pass already been spent
 *    rebuild claims is a deploy already queued, so don't queue a second
 *
 *  Every one of them is a read-modify-write, and every one of them runs in a
 *  Vercel function that shares nothing with the next invocation. Module-level
 *  `Map`s — the obvious implementation, and the one this replaces for rate
 *  limiting — are per-instance: two concurrent requests land on two instances,
 *  each sees an empty map, and the limit is whatever the concurrency happens
 *  to be. "SELECT then INSERT" in application code is the same bug with extra
 *  steps: the gap between the two statements is where the requests you are
 *  trying to stop fit.
 *
 *  So each operation here is ONE statement that Postgres executes atomically.
 *  No transaction to hold open, no lock to release, no second round trip.
 *
 *  WHY `payload_kv` AND NOT A NEW TABLE. Payload ships this table for its own
 *  KV store (`payload.kv`, backed by DatabaseKVAdapter), so it already exists
 *  with a UNIQUE index on `key` — which is precisely the constraint that makes
 *  `ON CONFLICT ("key") DO UPDATE` work. Reusing it means these fixes need no
 *  schema migration at all. Our keys are namespaced `bdw:` so they cannot
 *  collide with Payload's.
 *
 *  WHY RAW SQL AND NOT `payload.kv`. That interface is `get`/`set`/`has`/
 *  `delete`/`keys`/`clear`: no TTL, no atomic increment, no compare-and-set,
 *  and `keys()` reads every row in the table. An atomic counter cannot be
 *  built out of it. It stays the right tool for plain settings blobs.
 *
 *  WHY `payload.db.drizzle` AND NOT `req.transactionID`. These writes must
 *  survive the failure of whatever operation they are guarding. A rate-limit
 *  bump enrolled in the request's transaction is rolled back when the request
 *  errors — so a script that submits a review that fails validation is not
 *  counted, and gets unlimited free attempts. Going straight to the pool puts
 *  the counter outside the transaction, where it belongs. */

/** Payload's own KV table. Not ours to change; only ever read and written
 *  through the statements in this file.
 *
 *  A pre-built `sql.raw` chunk rather than string interpolation at each call
 *  site: an identifier cannot be a bound parameter in Postgres, so it has to
 *  be spliced into the statement text, and doing that exactly once — from a
 *  constant, never from an argument — is what keeps every query below
 *  parameterised where it matters. */
const T = sql.raw('"payload_kv"');

/** Every key this project puts in that shared table. Collected here rather
 *  than spelled out at each call site, so the namespace is auditable in one
 *  place and `kvPrune` can be given a prefix that is known to be complete. */
export const KV_KEYS = {
  /** Fixed-window counter, one per IP hash per limiter. */
  rate: (limiter: string, subject: string) => `bdw:rate:${limiter}:${subject}`,
  /** Single-use admin-login gate nonce. */
  loginNonce: (nonce: string) => `bdw:gate:${nonce}`,
  /** The deploy-hook debounce claim. One key for the whole site. */
  rebuild: "bdw:rebuild",
  /** Set when a rebuild was owed but not fired; cleared when one fires. */
  rebuildDirty: "bdw:rebuild:dirty",
  /** old slug -> new slug, read at build time by next.config.mjs. */
  redirect: (collection: string, oldSlug: string) =>
    `bdw:redirect:${collection}:${oldSlug}`,
} as const;

export const KV_PREFIX = "bdw:";

/** Every statement in this file goes to the POOL, never to the request's
 *  transaction — `dbExec` is called without a `req` throughout, deliberately.
 *
 *  A rate-limit bump enrolled in the request's transaction is rolled back when
 *  the request errors, so a script that submits a review that fails validation
 *  is not counted and gets unlimited free attempts. A rebuild claim rolled back
 *  with a failed save would let the next save trigger a second deployment. The
 *  whole value of these rows is that they outlive the operation they guard, so
 *  the connection choice is part of the primitive, not a call-site decision.
 *  See ./db.ts for the mechanics. */
async function exec(payload: Payload, statement: DbStatement) {
  return dbExec(payload, statement);
}

export interface RateWindow {
  /** Hits recorded in the current window, including this one. */
  count: number;
  /** Epoch ms at which the window resets. */
  resetAt: number;
  /** True when this hit took the counter past the limit. */
  limited: boolean;
  /** Seconds to put in a Retry-After header. Always >= 1. */
  retryAfterSeconds: number;
}

/** ATOMIC FIXED-WINDOW RATE LIMIT. One statement, one round trip.
 *
 *  Reads as: insert a fresh window; if the key already exists, either the
 *  stored window has expired (start a new one at 1) or it has not (increment
 *  in place). `RETURNING` then hands back the value AFTER the update, so the
 *  count returned is this caller's own position in the window and two
 *  simultaneous requests cannot both read "2".
 *
 *  Fixed window, not sliding: a caller can burst across a window boundary and
 *  briefly get 2x the limit. That is a known and accepted property here — the
 *  thing being protected is a moderated queue, and the alternative (a sorted
 *  set of timestamps, or a leaky bucket) is a materially more complex
 *  statement for a limit whose exact edge does not matter.
 *
 *  The audit's finding this replaces: `payload.count()` over the reviews
 *  table, followed by a create. Three requests arriving together all counted
 *  2 and all inserted, and the count itself scanned an unindexed
 *  (ipHash, createdAt) pair. */
export async function kvBumpWindow(
  payload: Payload,
  key: string,
  windowMs: number,
  limit: number,
): Promise<RateWindow> {
  const now = Date.now();
  const resetAt = now + windowMs;

  const rows = await exec(
    payload,
    sql`
      INSERT INTO ${T} ("key", "data")
      VALUES (${key}, jsonb_build_object('count', 1, 'reset', ${resetAt}::bigint))
      ON CONFLICT ("key") DO UPDATE SET "data" =
        CASE
          WHEN COALESCE((${T}."data"->>'reset')::bigint, 0) <= ${now}::bigint
            THEN jsonb_build_object('count', 1, 'reset', ${resetAt}::bigint)
          ELSE jsonb_set(
            ${T}."data",
            '{count}',
            to_jsonb(COALESCE((${T}."data"->>'count')::int, 0) + 1)
          )
        END
      RETURNING ("data"->>'count')::int AS count, ("data"->>'reset')::bigint AS reset
    `,
  );

  const count = num(rows[0]?.count) || 1;
  const windowResetAt = num(rows[0]?.reset) || resetAt;
  return {
    count,
    resetAt: windowResetAt,
    limited: count > limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowResetAt - now) / 1000)),
  };
}

/** ATOMIC COOLDOWN CLAIM — a debounce that survives a stateless runtime.
 *
 *  Returns true to exactly ONE caller per cooldown period and false to every
 *  other caller, whatever order they arrive in and however many instances they
 *  land on. Used to make sure that publishing eight books in a minute triggers
 *  one deploy rather than eight.
 *
 *  The trick is the `WHERE` on `DO UPDATE`, which is a real compare-and-set:
 *  Postgres takes the row lock, evaluates the condition against the CURRENT
 *  row, and if the existing claim has not expired it performs no update and
 *  returns no row. `RETURNING` is therefore the answer — a row means the claim
 *  is yours. The insert path (no key yet) always returns, so a cold start
 *  claims immediately. */
export async function kvClaim(
  payload: Payload,
  key: string,
  cooldownMs: number,
): Promise<boolean> {
  const now = Date.now();
  const until = now + cooldownMs;

  const rows = await exec(
    payload,
    sql`
      INSERT INTO ${T} ("key", "data")
      VALUES (${key}, jsonb_build_object('until', ${until}::bigint))
      ON CONFLICT ("key") DO UPDATE
        SET "data" = jsonb_build_object('until', ${until}::bigint)
        WHERE COALESCE((${T}."data"->>'until')::bigint, 0) <= ${now}::bigint
      RETURNING ("data"->>'until')::bigint AS until
    `,
  );
  return rows.length > 0;
}

/** Takes the cooldown whether or not it was free.
 *
 *  The counterpart to `kvClaim`, for the caller that has ALREADY performed the
 *  guarded action by another route and now wants the next caller debounced
 *  against it — the daily cron, which must fire regardless, and then wants a
 *  publish landing a second later folded in rather than starting a second
 *  build. Written as its own function rather than a boolean argument to
 *  `kvClaim` so that no call site can accidentally pass `true` and turn a
 *  compare-and-set into an unconditional write. */
export async function kvForceClaim(
  payload: Payload,
  key: string,
  cooldownMs: number,
): Promise<void> {
  const until = Date.now() + cooldownMs;
  await exec(
    payload,
    sql`
      INSERT INTO ${T} ("key", "data")
      VALUES (${key}, jsonb_build_object('until', ${until}::bigint))
      ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data"
    `,
  );
}

/** Writes a value with an expiry. Overwrites any existing value for the key.
 *
 *  Expiry is stored ALONGSIDE the value and checked on read, because Postgres
 *  has no TTL of its own — there is no background process here to sweep, so
 *  the read has to do it. `kvPrune` exists to stop the table growing without
 *  bound; nothing depends on it having run. */
export async function kvPut(
  payload: Payload,
  key: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  const envelope = JSON.stringify({ v: value, exp: Date.now() + ttlMs });
  await exec(
    payload,
    sql`
      INSERT INTO ${T} ("key", "data")
      VALUES (${key}, ${envelope}::jsonb)
      ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data"
    `,
  );
}

/** Reads a value written by `kvPut`, or null when missing or expired. */
export async function kvGet<TValue = unknown>(
  payload: Payload,
  key: string,
): Promise<TValue | null> {
  const rows = await exec(
    payload,
    sql`SELECT "data" FROM ${T} WHERE "key" = ${key} LIMIT 1`,
  );
  const data = rows[0]?.data as { v?: unknown; exp?: number } | undefined;
  if (!data) return null;
  if (typeof data.exp === "number" && data.exp <= Date.now()) return null;
  return (data.v ?? null) as TValue | null;
}

/** ATOMIC SINGLE-USE READ. Deletes the key and returns what it held, so the
 *  value can be redeemed by exactly one caller.
 *
 *  `DELETE ... RETURNING` is the whole mechanism: two requests presenting the
 *  same nonce both reach the statement, one deletes a row and gets it back,
 *  the other deletes nothing and gets nothing. A `get` followed by a `delete`
 *  would hand the value to both.
 *
 *  This is what turns the admin-login gate from "a token that works for five
 *  minutes" into "a token that works once". */
export async function kvTake<TValue = unknown>(
  payload: Payload,
  key: string,
): Promise<TValue | null> {
  const rows = await exec(
    payload,
    sql`DELETE FROM ${T} WHERE "key" = ${key} RETURNING "data"`,
  );
  const data = rows[0]?.data as { v?: unknown; exp?: number } | undefined;
  if (!data) return null;
  if (typeof data.exp === "number" && data.exp <= Date.now()) return null;
  return (data.v ?? null) as TValue | null;
}

/** Deletes one key outright, expired or not. */
export async function kvDelete(payload: Payload, key: string): Promise<void> {
  await exec(payload, sql`DELETE FROM ${T} WHERE "key" = ${key}`);
}

/** Every live key under a prefix, with its value. Used by the redirect map,
 *  which needs the whole set at once.
 *
 *  The prefix is escaped for LIKE before use. Today every caller passes a
 *  literal from `KV_KEYS`, but a `%` reaching a LIKE pattern turns "keys under
 *  this namespace" into "keys anywhere", and that is not a property worth
 *  leaving to the call sites to remember. */
export async function kvList(
  payload: Payload,
  prefix: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const pattern = `${prefix.replace(/([%_\\])/g, "\\$1")}%`;
  const rows = await exec(
    payload,
    sql`SELECT "key", "data" FROM ${T} WHERE "key" LIKE ${pattern} ESCAPE '\\'`,
  );
  const now = Date.now();
  const out: Array<{ key: string; value: unknown }> = [];
  for (const row of rows) {
    const key = typeof row.key === "string" ? row.key : null;
    const data = row.data as { v?: unknown; exp?: number } | undefined;
    if (!key || !data) continue;
    if (typeof data.exp === "number" && data.exp <= now) continue;
    out.push({ key, value: data.v ?? null });
  }
  return out;
}

/** Housekeeping: drops every expired `bdw:` row.
 *
 *  Called from the daily cron, and only there. Nothing depends on it — each
 *  read already treats an expired row as absent — so this is purely about the
 *  table not accumulating one dead row per IP per limiter forever. The three
 *  expiry field names are all checked in one pass because the three primitives
 *  above each name their deadline after what it means (`exp`, `reset`,
 *  `until`) rather than sharing one vague key. */
export async function kvPrune(payload: Payload): Promise<number> {
  const now = Date.now();
  const pattern = `${KV_PREFIX}%`;
  const rows = await exec(
    payload,
    sql`
      DELETE FROM ${T}
      WHERE "key" LIKE ${pattern}
        AND COALESCE(
              ("data"->>'exp')::bigint,
              ("data"->>'reset')::bigint,
              ("data"->>'until')::bigint
            ) <= ${now}::bigint
      RETURNING "key"
    `,
  );
  return rows.length;
}



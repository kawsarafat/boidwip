import { sql } from "@payloadcms/db-postgres";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import type { Payload, PayloadRequest } from "payload";

/** The single door from application code to raw SQL, and the one place that
 *  decides WHICH CONNECTION a statement runs on.
 *
 *  Two things in this project need SQL that the Local API cannot express: the
 *  atomic KV primitives in ./kv.ts (counters, claims, single-use reads) and the
 *  review aggregate in collections/Reviews.ts (COUNT/AVG over a table that may
 *  hold more rows than one page of `find()` returns). Both were going to reach
 *  for `payload.db.drizzle` independently; the connection choice below is
 *  subtle enough that it should exist exactly once.
 *
 *  THE CONNECTION CHOICE, WHICH IS THE WHOLE POINT OF THIS FILE. Payload wraps
 *  every mutating operation in a Postgres transaction and runs `afterChange`
 *  and `afterDelete` hooks INSIDE it, before the commit (see
 *  payload/dist/collections/operations/updateByID.js: the hooks run in
 *  `updateDocument`, `commitTransaction(req)` comes after). A statement sent to
 *  the pool from inside such a hook opens a SECOND connection, which under READ
 *  COMMITTED cannot see the uncommitted row the hook is reacting to. That is
 *  not a theoretical hazard — it is why the review aggregate used to compute
 *  itself from a set that excluded the very review whose approval triggered it,
 *  and so lagged one review behind forever.
 *
 *  So: pass `req` when the statement must SEE the in-flight change (aggregates
 *  derived from it), and omit `req` when the statement must SURVIVE the failure
 *  of the operation around it (rate-limit counters — enrol one of those in the
 *  request transaction and a rejected submission is not counted, which hands a
 *  script unlimited free attempts). Neither default is safe for the other case,
 *  which is why this is an explicit argument and not a lookup. */

export type Row = Record<string, unknown>;

/** A statement built by the `sql` tag re-exported from @payloadcms/db-postgres
 *  (which is drizzle-orm's own). Taken from the adapter's own signature so it
 *  cannot drift from the drizzle version actually installed. */
export type DbStatement = Parameters<PostgresAdapter["drizzle"]["execute"]>[0];

/** Anything that can run one statement: the pool-level drizzle instance or a
 *  transaction handle out of `adapter.sessions`. Both expose `execute`; the
 *  transaction type is not exported in a form worth importing for this. */
type Executor = { execute: (statement: DbStatement) => Promise<unknown> };

/** Drizzle's `execute` returns node-postgres's QueryResult (`{ rows }`), but
 *  the shape has moved between versions and some drivers return the array
 *  directly. Both are accepted rather than pinning to one and breaking on a
 *  patch upgrade of a transitive dependency. */
export function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

/** bigint and numeric columns come back from node-postgres as STRINGS, because
 *  a 64-bit integer does not fit in a JS number safely. Millisecond timestamps
 *  and star ratings do. */
export function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

/** `payload.db` is typed as the generic DatabaseAdapter, which has no
 *  `drizzle` property — the cast is to the Postgres adapter's own exported
 *  type, so this is a narrowing to the adapter we actually configure rather
 *  than an `any`. The guard is real: it is what a Mongo or SQLite adapter
 *  would hit, and it says so instead of throwing `undefined is not a function`
 *  three frames deeper. */
function executorFor(payload: Payload, req?: PayloadRequest): Executor {
  const db = payload.db as unknown as Partial<PostgresAdapter> & {
    sessions?: Record<string, { db?: Executor }>;
  };

  const transactionID = req?.transactionID;
  if (transactionID !== undefined && transactionID !== null) {
    // Present only while a transaction is open. Absent for a Local API call
    // made with `disableTransaction`, and for the seed script — in which case
    // the pool is the correct and only answer, so this falls through rather
    // than failing.
    const session = db.sessions?.[String(transactionID)];
    if (session?.db?.execute) return session.db;
  }

  if (!db?.drizzle?.execute) {
    throw new Error(
      "lib/payload/db.ts requires the Postgres database adapter (payload.db.drizzle). It is not available on the configured adapter.",
    );
  }
  return db.drizzle as unknown as Executor;
}

/** Runs one statement and returns its rows.
 *
 *  Pass `req` to join the request's transaction (see the header): required when
 *  the statement reads data the current operation has written but not yet
 *  committed. Omit it to go straight to the pool, outside any transaction. */
export async function dbExec(
  payload: Payload,
  statement: DbStatement,
  req?: PayloadRequest,
): Promise<Row[]> {
  return rowsOf(await executorFor(payload, req).execute(statement));
}

export { sql };

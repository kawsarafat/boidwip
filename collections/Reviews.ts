import type { Access, CollectionConfig, Payload, PayloadRequest, Validate } from "payload";
import { authenticated } from "../lib/payload/access";
import { submitReview } from "../lib/payload/submitReview";
import { dbExec, num, sql } from "../lib/payload/db";

/** Reader reviews with ratings — a moderated wall-plus-one mechanism with a
 *  rating added, copied as a whole mechanism rather than re-derived
 *  (plan §5.6).
 *
 *  WHY THIS IS SHAPED THE WAY IT IS
 *
 *  The review list is fetched in the BROWSER, not baked at build: a lazy
 *  GET /api/reviews?where[book][equals]=… on scroll. This is the one part of
 *  the site that is NOT a build artefact, and deliberately so — approving a
 *  review makes it visible immediately, with no deployment in between, which
 *  for a moderation queue is the whole point.
 *
 *  THE RATING WRINKLE: the book's star rating and JSON-LD aggregateRating ARE
 *  baked into the prerendered page, so the aggregate cannot be computed at
 *  render time (there is no render at request time). It comes from a
 *  denormalised ratingAverage/ratingCount PAIR ON THE BOOK, recomputed by the
 *  afterChange hook below whenever a review enters or leaves the approved set,
 *  changes its rating, or moves to another book. Writing that pair updates the
 *  book, which triggers a debounced rebuild — so the number in the markup
 *  catches up with the number in the API on the next deployment. The frontend
 *  gates the JSON-LD emission at ≥5 approved reviews — three friends averaging
 *  5.0 is not an aggregate rating.
 *
 *  Security is the wall-plus-one-door arrangement:
 *   1. `read` returns approved-only for anyone not logged in — a WHERE
 *      clause Payload merges into every read, including hand-crafted GETs.
 *   2. `create` is closed outright. Every public review comes through
 *      POST /api/reviews/submit (lib/payload/submitReview.ts), which
 *      rate-limits, Turnstile-checks and forces status "pending". */

/** Approved to anyone; everything to a logged-in moderator. */
const readApprovedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;
  return { status: { equals: "approved" } };
};

/** An arbitrary but FIXED namespace for the advisory locks below. Postgres
 *  advisory locks are just a pair of integers with no schema behind them, so
 *  the only thing that makes one lock distinct from another module's lock is
 *  that both sides agree on this number. Nothing else in this project takes
 *  advisory locks; if something does, it must not reuse 8_471_001. */
const RATING_LOCK_NAMESPACE = 8_471_001;

/** Recompute the book's denormalised rating pair from APPROVED reviews only.
 *
 *  WHAT WAS WRONG WITH THE PREVIOUS VERSION, in the order it mattered:
 *
 *  1. IT COULD NOT SEE ITS OWN TRIGGER. It called `payload.find()` without
 *     `req`, which opens a connection outside the request's transaction — and
 *     `afterChange` runs BEFORE that transaction commits. Under READ COMMITTED
 *     the second connection therefore saw the review's OLD status. Approving
 *     the first review of a book computed a count of zero; approving the second
 *     computed one. Every rating on the site was one approval behind, forever.
 *     Passing `req` is what fixes it, and it is why ./db.ts takes `req` as an
 *     explicit argument rather than guessing.
 *
 *  2. IT STOPPED AT 1,000 REVIEWS. `limit: 1000` silently truncated the set
 *     and the average, and the truncation point was invisible — a bestseller
 *     crossing 1,000 approved reviews would freeze its own aggregate. COUNT and
 *     AVG belong in the database; one statement is both exact and cheaper than
 *     paginating a thousand rows into Node to add them up.
 *
 *  3. CONCURRENT APPROVALS RACED. Two moderators approving two reviews of the
 *     same book each read a snapshot taken before the other committed, and the
 *     second write clobbered the first with a count that was one too low. The
 *     `pg_advisory_xact_lock` below serialises recomputes PER BOOK: the second
 *     transaction blocks until the first commits, and because READ COMMITTED
 *     takes a fresh snapshot for each STATEMENT, the aggregate that runs after
 *     the wait sees the newly committed row. Taking the lock in its own
 *     statement is therefore load-bearing — folded into the aggregate as a CTE
 *     it would share that statement's snapshot and prove nothing.
 *
 *     The lock is `_xact_`: Postgres releases it at commit or rollback with no
 *     unlock call to forget, and it is scoped to the book id, so approvals on
 *     different books never wait on each other. With no transaction open (the
 *     seed script) it degrades to a no-op held for one statement — the
 *     aggregate is still exact, only the interleaving guarantee is lost.
 *
 *  ERRORS ARE NOT SWALLOWED HERE, and that is a deliberate reversal. These
 *  statements run inside the caller's transaction, where a failed statement
 *  aborts the whole transaction — Postgres then refuses every later command
 *  with "current transaction is aborted", so catching and continuing would turn
 *  a clear failure into a confusing one and the commit would fail anyway. A
 *  rating recompute that cannot run means the database is not answering, and
 *  the approval it belongs to should fail with it. */
async function recomputeBookRating(
  payload: Payload,
  req: PayloadRequest,
  bookId: number | string,
): Promise<void> {
  const id = Number(bookId);
  if (!Number.isInteger(id)) return;

  await dbExec(
    payload,
    sql`SELECT pg_advisory_xact_lock(${RATING_LOCK_NAMESPACE}::int, ${id}::int)`,
    req,
  );

  const rows = await dbExec(
    payload,
    sql`
      SELECT
        COUNT(*)::int AS count,
        ROUND(AVG("rating"), 1)::float8 AS average
      FROM "reviews"
      WHERE "book_id" = ${id} AND "status" = 'approved'
    `,
    req,
  );

  const count = num(rows[0]?.count);
  // AVG over zero rows is NULL, and the book's rating fields are nullable on
  // purpose: "no rating yet" is not "rated 0", and the frontend's ≥5-review
  // gate reads the count, not the average.
  const average = count > 0 ? num(rows[0]?.average) : null;

  // Through the Local API rather than an UPDATE, so the book's own afterChange
  // hook fires: the star rating and the JSON-LD aggregateRating are baked into
  // the prerendered book page, so a new rating genuinely does need a rebuild to
  // become visible. It is debounced (see lib/payload/revalidate.ts), so a batch
  // of approvals is one deployment. Stated explicitly because "optimising" this
  // into `context: { skipRevalidate: true }` would freeze every published
  // rating at whatever it was on the last unrelated deploy.
  //
  // `req` is passed so this write joins the same transaction as the review
  // change that caused it: either both land or neither does, and no reader can
  // observe an approved review that is missing from its book's count.
  await payload.update({
    collection: "books",
    id,
    req,
    overrideAccess: true,
    data: { ratingAverage: average, ratingCount: count },
  });
}

/** Both books, when an approved review MOVES between them.
 *
 *  Editing a review's `book` in the admin used to leave two wrong numbers
 *  behind: the old book still counted a review it no longer has, and the new
 *  book did not count the one it gained. Neither recompute ran, because the
 *  trigger condition only looked at the approval state, which had not changed.
 *
 *  Sorted before locking. Two moderators moving reviews in opposite directions
 *  between the same pair of books would otherwise take the two advisory locks
 *  in opposite orders, which is a textbook deadlock; a consistent order makes
 *  one of them simply wait. */
async function recomputeBooks(
  payload: Payload,
  req: PayloadRequest,
  bookIds: Array<number | string | null | undefined>,
): Promise<void> {
  const unique = Array.from(
    new Set(
      bookIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ).sort((a, b) => a - b);

  for (const id of unique) {
    await recomputeBookRating(payload, req, id);
  }
}

/** The id out of a relationship field, which Payload hands back either as a
 *  raw id (depth 0) or as the populated document. */
function bookIdOf(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const id = (value as { id?: number | string }).id;
    return id ?? null;
  }
  return value as number | string;
}

export const Reviews: CollectionConfig = {
  slug: "reviews",
  admin: {
    useAsTitle: "authorName",
    // `book` sits second because moderating is reading down one column asking
    // "which book is this about" — the rating and the state are the decision,
    // but the book is the context you need to make it.
    defaultColumns: ["authorName", "book", "rating", "status", "createdAt"],
    group: "Moderation",
    description:
      "The moderation queue. Approving a review publishes it immediately, with no deployment in between, and folds its stars into the book's average — so this is the one screen on the site where a save is instantly visible to readers. Nothing arrives here approved.",
    listSearchableFields: ["authorName", "body"],
  },
  access: {
    read: readApprovedOrAuthenticated,
    // Closed on purpose. Public reviews are written only by the /submit
    // endpoint, with overrideAccess, after its abuse checks. A public
    // `create` here would let a script POST status:"approved", rating:5
    // straight to /api/reviews and launder itself into the JSON-LD.
    create: () => false,
    update: authenticated,
    delete: authenticated,
  },
  // POST /api/reviews/submit — the public submission path.
  endpoints: [submitReview],

  /** Compound indexes for the two queries that actually run at scale.
   *
   *  `book_status_idx` serves both the public review list
   *  (`?where[book][equals]=…` merged with the access rule's
   *  `status = 'approved'`) and the aggregate above. The single-column
   *  `book_idx` and `status_idx` cannot: Postgres would pick one, then filter
   *  the other by heap lookup, which on a popular book means reading every
   *  review ever left on it to answer a request that wants the approved ones.
   *
   *  `ipHash_createdAt_idx` serves the abuse checks in
   *  lib/payload/submitReview.ts — "has this address submitted anything in the
   *  last ten minutes", which is a range scan on `created_at` within one
   *  `ip_hash`. The audit found this pair unindexed, i.e. a full table scan on
   *  the one path an attacker controls the rate of. */
  indexes: [{ fields: ["book", "status"] }, { fields: ["ipHash", "createdAt"] }],

  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const previousBook = bookIdOf(previousDoc?.book);
        const currentBook = bookIdOf(doc?.book);

        const wasApproved = previousDoc?.status === "approved";
        const isApproved = doc?.status === "approved";
        // A rating edited on a review that is approved both before and after
        // moves the average without moving the count.
        const ratingChanged =
          wasApproved && isApproved && previousDoc?.rating !== doc?.rating;
        // A review REASSIGNED to another book. Both books are wrong until both
        // are recomputed, and this is invisible to the approval-state test:
        // approved→approved with the same rating still changes two aggregates.
        const bookChanged =
          previousBook !== null &&
          currentBook !== null &&
          String(previousBook) !== String(currentBook);

        if (wasApproved === isApproved && !ratingChanged && !bookChanged) return doc;

        // Both ids when the review moved (the old book loses it, the new one
        // gains it); `recomputeBooks` de-duplicates and orders them.
        await recomputeBooks(
          req.payload,
          req,
          bookChanged ? [previousBook, currentBook] : [currentBook],
        );
        return doc;
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (doc?.status !== "approved") return doc;
        await recomputeBooks(req.payload, req, [bookIdOf(doc?.book)]);
        return doc;
      },
    ],
  },
  fields: [
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { value: "pending", label: "Pending review" },
        { value: "approved", label: "Approved" },
        { value: "spam", label: "Spam" },
      ],
      admin: {
        position: "sidebar",
        description:
          "Only Approved reviews show on the public page and count toward the book's rating.",
        components: {
          // A pill, not a raw word: the queue is scanned, not read, and three
          // states in three colours resolve at a glance where three lowercase
          // words in the same grey do not.
          Cell: "/components/payload/list/StatusCell#default",
        },
      },
    },
    {
      name: "book",
      type: "relationship",
      relationTo: "books",
      required: true,
      index: true,
      admin: {
        position: "sidebar",
        description: "The book this review was left on.",
      },
    },
    {
      name: "rating",
      type: "number",
      required: true,
      min: 1,
      max: 5,
      /** `min`/`max` alone accept 4.7, and the column is `numeric`, so it
       *  stores it. The public endpoint coerces to an integer, but the admin
       *  panel and any authenticated PATCH do not — and a single fractional
       *  rating drags the book's average to a value no combination of whole
       *  stars can produce, which is exactly the kind of detail that makes a
       *  rich-result audit fail ("aggregateRating does not match the reviews on
       *  the page"). Refused at the field, so every write path is covered. */
      validate: ((value: number | null | undefined) => {
        if (value === null || value === undefined) return "Rating is required.";
        if (!Number.isInteger(value)) return "Rating must be a whole number of stars (1–5).";
        if (value < 1 || value > 5) return "Rating must be between 1 and 5.";
        return true;
      }) as Validate,
      admin: {
        position: "sidebar",
        description: "1–5 stars, integer.",
      },
    },
    {
      name: "authorName",
      type: "text",
      required: true,
      admin: { description: "Shown publicly beside the review." },
    },
    {
      name: "authorEmail",
      type: "email",
      // Never sent to an anonymous reader: field-level read is restricted to
      // logged-in moderators, so even though the collection is publicly
      // readable, the email is stripped from the public API response.
      access: {
        read: ({ req }) => Boolean(req.user),
      },
      admin: {
        description: "Optional, private. Never displayed on the site.",
      },
    },
    {
      name: "body",
      type: "textarea",
      required: true,
      admin: { description: "The review text. Rendered as plain text on the page." },
    },
    {
      name: "ipHash",
      type: "text",
      // Same private treatment as the email. A salted hash, never the raw IP
      // — enough to rate-limit and spot a single source spamming, without
      // logging who-said-what-from-where.
      access: {
        read: ({ req }) => Boolean(req.user),
      },
      admin: {
        readOnly: true,
        description:
          "Salted hash of the submitter's IP, used for rate limiting. Not the address itself.",
      },
    },
  ],
};

export default Reviews;

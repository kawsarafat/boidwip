import type { Endpoint, PayloadRequest } from "payload";
import { verifyTurnstile } from "../turnstile";
import { clientIpFrom, hashIp } from "../net/clientIp";
import { readJsonBody } from "../net/readJsonBody";
import { KV_KEYS, kvBumpWindow } from "./kv";

/** Public review submission. POST /api/reviews/submit.
 *
 *  A wall-plus-one-door arrangement, kept whole rather than re-derived:
 *
 *  Reviews.access.create is `() => false`, so the generic POST /api/reviews
 *  is closed to everyone, logged in or not. Every public review arrives
 *  HERE, where it is length-checked, rate limited, Turnstile-verified and
 *  forced to status "pending" before payload.create runs with
 *  overrideAccess. Were `create` merely public, a script could POST straight
 *  to /api/reviews with `status: "approved"` and `rating: 5` two hundred
 *  times, and the aggregateRating in the book's JSON-LD would launder it
 *  into a Google-visible number. The endpoint is the only door; the
 *  collection is the wall.
 *
 *  Mounted on the collection so it inherits the already-dynamic
 *  /api/[...slug] route and adds no serverless function.
 *
 *  This is the one first-party public write on the whole site, which is why the
 *  order of the checks below is deliberate: the body is size-capped before it is
 *  parsed, the free local validation runs next, and only then does the request
 *  get to spend a rate-limit slot, a database query and a Cloudflare round
 *  trip. */

const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 200;
const MAX_BODY_LENGTH = 4_000;
const MIN_BODY_LENGTH = 10;

/** Rate limit: at most this many submission ATTEMPTS from one IP hash inside
 *  the window.
 *
 *  WHAT THIS REPLACES, and why the number moved. The previous limiter ran
 *  `payload.count()` over the reviews table and compared the result to the
 *  limit, which fails in two separate ways. It was not atomic: three requests
 *  arriving together all counted the same two existing rows, all passed, and all
 *  inserted — the limit was whatever the concurrency happened to be, which is
 *  exactly the condition a script creates. And it counted STORED ROWS, so a
 *  submission that was rejected after the check (failed Turnstile, failed
 *  validation deeper in, a database error) cost the sender nothing at all; a
 *  script that never manages to store a review had unlimited free attempts at
 *  the endpoint, the Cloudflare round trip and the book lookup behind it.
 *
 *  `kvBumpWindow` fixes both: one atomic statement whose RETURNING clause hands
 *  back this caller's own position in the window, on a counter that lives
 *  outside the request transaction so it survives the failure of the request it
 *  is guarding (see ./kv.ts). Because it now counts attempts rather than rows,
 *  the allowance is a little larger than the old three — a reader whose
 *  Turnstile token expired while the form sat open, retried, and then wanted to
 *  review a second book should not be locked out for ten minutes. Failures that
 *  cost nothing to detect (a missing name, too short a review) are checked
 *  BEFORE the counter is touched and are therefore free. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 6;

type SubmitBody = {
  bookSlug?: string;
  authorName?: string;
  authorEmail?: string;
  rating?: string | number;
  body?: string;
  turnstileToken?: string;
};

function jsonError(message: string, status = 400, headers?: HeadersInit): Response {
  return Response.json({ errors: [{ message }] }, { status, headers });
}

function str(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export const submitReview: Endpoint = {
  path: "/submit",
  method: "post",
  handler: async (req: PayloadRequest) => {
    // Size-capped BEFORE parsing (see lib/net/readJsonBody.ts). This is the
    // only unauthenticated write on the site, so it is the only place where an
    // attacker chooses how many bytes the server parses.
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      return parsed.reason === "too-large"
        ? jsonError("অনুরোধটি অনেক বড়। রিভিউটি ছোট করে আবার চেষ্টা করুন।", 413)
        : jsonError("অনুরোধটি বোঝা যায়নি। পাতাটি রিলোড করে আবার চেষ্টা করুন।", 400);
    }
    const body = (parsed.value ?? {}) as SubmitBody;

    const bookSlug = str(body.bookSlug, 200);
    // A slug segment as it appears in a public URL. Rejecting anything else
    // keeps the lookup below from being handed a `where` value shaped like
    // an injection attempt.
    if (!/^[a-z0-9-]+$/.test(bookSlug)) {
      return jsonError("বইটি খুঁজে পাওয়া যায়নি।", 404);
    }

    const authorName = str(body.authorName, MAX_NAME_LENGTH);
    if (!authorName) return jsonError("আপনার নাম লিখুন।");

    // Email is optional and never shown publicly (field-level read access in
    // collections/Reviews.ts). Kept only so a moderator can tell two
    // "Rahim"s apart; a malformed one is dropped rather than rejected.
    const rawEmail = str(body.authorEmail, MAX_EMAIL_LENGTH);
    const authorEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "";

    // The rating arrives over HTTP as a string or number; coerced and
    // bounds-checked server-side. An integer 1–5, nothing else — half-stars
    // and zeroes are not a thing this form offers, so anything shaped like
    // one is a hand-crafted request.
    const rating =
      typeof body.rating === "number" ? body.rating : Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonError("১ থেকে ৫ এর মধ্যে একটি রেটিং দিন।");
    }

    const reviewBody = str(body.body, MAX_BODY_LENGTH);
    if (reviewBody.length < MIN_BODY_LENGTH) {
      return jsonError("রিভিউটি আরেকটু বিস্তারিত লিখুন (অন্তত কয়েকটি শব্দ)।");
    }

    // Everything above this line is local and costs nothing, so a missing name
    // or a one-word review is refused without consuming any of the allowance
    // below. Everything below reaches the database and Cloudflare, so it is
    // counted first.
    const ip = clientIpFrom(req.headers);
    const ipHash = hashIp(ip);
    if (ipHash) {
      // One atomic statement whose RETURNING clause gives this caller its own
      // position in the window, so two simultaneous requests cannot both read
      // the same count. Skipped when the IP is unknown (a direct local
      // request), which is acceptable: the moderation queue still gates
      // everything that reaches the table.
      const rateWindow = await kvBumpWindow(
        req.payload,
        KV_KEYS.rate("review", ipHash),
        RATE_WINDOW_MS,
        RATE_MAX_PER_WINDOW,
      );
      if (rateWindow.limited) {
        return jsonError(
          "আপনি ইতিমধ্যে কয়েকটি রিভিউ জমা দিয়েছেন। কিছুক্ষণ পর আবার চেষ্টা করুন।",
          429,
          // Taken from the stored window rather than the limit constant, so a
          // client that honours it waits exactly as long as is left.
          { "Retry-After": String(rateWindow.retryAfterSeconds) },
        );
      }
    }

    // Published books only — this both stops reviews landing on a draft and
    // confirms the page the visitor is looking at is real before a row is
    // written for it.
    const bookResult = await req.payload.find({
      collection: "books",
      where: {
        and: [{ slug: { equals: bookSlug } }, { _status: { equals: "published" } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const book = bookResult.docs[0];
    if (!book) return jsonError("বইটি খুঁজে পাওয়া যায়নি।", 404);

    // Turnstile before the write, with the client IP so Cloudflare can weigh
    // it. Returns ok when unconfigured (feature-disabled) or on a Cloudflare
    // outage (fail-open, the moderated queue is the backstop).
    const turnstile = await verifyTurnstile(body.turnstileToken, ip || undefined);
    if (!turnstile.ok) {
      return jsonError("যাচাই সম্পন্ন হয়নি। পাতাটি রিলোড করে আবার চেষ্টা করুন।", 403);
    }

    try {
      await req.payload.create({
        collection: "reviews",
        // overrideAccess because the collection's create is closed: this
        // endpoint is the sole sanctioned writer.
        overrideAccess: true,
        data: {
          book: book.id,
          authorName,
          ...(authorEmail ? { authorEmail } : {}),
          rating,
          body: reviewBody,
          ...(ipHash ? { ipHash } : {}),
          // Forced server-side. The client cannot ask for "approved"; a
          // moderator flips this in the admin, and THAT flip is what updates
          // the book's denormalised ratingAverage/ratingCount.
          status: "pending",
        },
      });
    } catch (error) {
      // The raw error can quote the DB row; log only. The browser gets a
      // fixed sentence.
      req.payload.logger.error(
        `[reviews] submit failed for ${bookSlug}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return jsonError("রিভিউটি সংরক্ষণ করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।", 500);
    }

    // No review echoed back: it is pending and has nothing to show yet.
    return Response.json({
      ok: true,
      message: "ধন্যবাদ! পর্যালোচনার পর আপনার রিভিউটি প্রকাশিত হবে।",
    });
  },
};

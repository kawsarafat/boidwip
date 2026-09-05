"use client";

import { useEffect, useRef, useState } from "react";
import Turnstile, { isTurnstileEnabled } from "./Turnstile";

/** Reader reviews with star ratings — a moderated comments mechanism with a
 *  rating dimension, adapted rather than re-derived.
 *
 *  WHY THIS IS A CLIENT COMPONENT ON A STATIC SITE
 *
 *  The public site is prerendered and never talks to Postgres at request time.
 *  Reviews would break that two ways server-rendered: a freshly approved
 *  review could not appear without a rebuild, and every render would hit the
 *  database. So the approved reviews are fetched from Payload's REST API in
 *  the browser, lazily, on scroll — the page HTML stays static and a
 *  moderator's "approve" shows up on the next page view.
 *
 *  ONLY APPROVED ROWS, AND NOT BECAUSE OF ACCESS CONTROL ALONE. The
 *  collection's read rule (collections/Reviews.ts) narrows to approved-only for
 *  an ANONYMOUS request and returns everything to an authenticated one — so a
 *  logged-in moderator visiting a book page was served pending and spam rows in
 *  the public list, which is exactly the "pending in admin, published on the
 *  site" symptom. The query below therefore asks for status=approved outright
 *  AND sends no credentials, so the list is the same for a moderator as for a
 *  stranger. authorEmail/ipHash are stripped by field-level access before they
 *  leave the server. The fetch filters on the relationship's SLUG
 *  (where[book.slug][equals]) because the browser knows the slug, not the id.
 *
 *  Submission goes to POST /api/reviews/submit, which owns length checks,
 *  Turnstile, rate limiting and forces status "pending" — nothing here is
 *  trusted. NO REPLIES: a review answers the book, not another review, so the
 *  whole parent/threading machinery of Comments is deliberately absent.
 *
 *  THE RATING DISPLAYED UP TOP IS NOT COMPUTED HERE. The book page header
 *  shows the denormalised ratingAverage baked at build time; this section
 *  shows the live list. After an approval the two can disagree for one
 *  rebuild cycle — accepted, because the alternative is a DB read per render. */

type PublicReview = {
  id: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function toBnDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/** Relative time in Bengali, falling back to a date past a week. */
function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "এইমাত্র";
  if (min < 60) return `${toBnDigits(min)} মিনিট আগে`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${toBnDigits(hr)} ঘণ্টা আগে`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${toBnDigits(days)} দিন আগে`;
  return new Date(iso).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** A static star row for a single review's integer rating. Local rather than
 *  reusing RatingStars because that one is a server component doing
 *  fractional-clip math; an integer row of five glyphs is simpler here. */
function StarRow({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`রেটিং: ৫ এর মধ্যে ${toBnDigits(rating)}`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 ${i <= rating ? "text-warn" : "text-rule"}`}
          fill="currentColor"
          aria-hidden
        >
          <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.11l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

/** The star INPUT — five radio buttons styled as stars. Radios rather than
 *  buttons because the group then works with arrow keys and announces itself
 *  as "1 of 5" for free; a fieldset legend names the group. */
function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 block text-xs font-semibold text-ink-muted">
        আপনার রেটিং <span className="text-danger">*</span>
      </legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} className="cursor-pointer">
            <input
              type="radio"
              name="review-rating"
              value={i}
              checked={value === i}
              onChange={() => onChange(i)}
              className="sr-only"
            />
            <svg
              viewBox="0 0 20 20"
              className={`h-7 w-7 transition ${
                i <= value ? "text-warn" : "text-rule hover:text-warn/50"
              }`}
              fill="currentColor"
              aria-hidden
            >
              <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.11l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z" />
            </svg>
            <span className="sr-only">{toBnDigits(i)} তারকা</span>
          </label>
        ))}
        {value > 0 && (
          <span className="ml-1 text-sm font-semibold text-ink">{toBnDigits(value)}/৫</span>
        )}
      </div>
    </fieldset>
  );
}

function ReviewForm({ bookSlug, turnstileOn }: { bookSlug: string; turnstileOn: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  // Bumped after a successful submit so Turnstile mints a fresh token if the
  // reader reviews another book from history navigation.
  const [resetKey, setResetKey] = useState(0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setNotice(null);

    if (!name.trim()) {
      setNotice({ kind: "error", text: "আপনার নাম লিখুন।" });
      return;
    }
    if (rating < 1) {
      setNotice({ kind: "error", text: "১ থেকে ৫ তারকার একটি রেটিং দিন।" });
      return;
    }
    if (body.trim().length < 10) {
      setNotice({ kind: "error", text: "রিভিউটি আরেকটু বিস্তারিত লিখুন।" });
      return;
    }
    // Only wait for a token when Turnstile is actually configured; otherwise
    // the widget renders nothing and this would block forever.
    if (turnstileOn && !token) {
      setNotice({ kind: "error", text: "যাচাই সম্পন্ন হওয়ার জন্য একটু অপেক্ষা করুন।" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookSlug,
          authorName: name.trim(),
          authorEmail: email.trim() || undefined,
          rating,
          body: body.trim(),
          turnstileToken: token || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        errors?: { message?: string }[];
      };
      if (res.ok && data.ok) {
        setDone(true);
        setNotice({
          kind: "ok",
          text: data.message ?? "ধন্যবাদ! পর্যালোচনার পর আপনার রিভিউটি প্রকাশিত হবে।",
        });
        setName("");
        setEmail("");
        setRating(0);
        setBody("");
        setToken(null);
        setResetKey((k) => k + 1);
      } else {
        setNotice({
          kind: "error",
          text:
            data.errors?.[0]?.message ??
            "রিভিউটি পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।",
        });
        setToken(null);
        setResetKey((k) => k + 1);
      }
    } catch {
      setNotice({
        kind: "error",
        text: "রিভিউটি পাঠানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card border-accent/30 bg-accent-soft p-4 text-sm text-ink">
        {notice?.text ?? "ধন্যবাদ! পর্যালোচনার পর আপনার রিভিউটি প্রকাশিত হবে।"}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <StarInput value={rating} onChange={setRating} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="review-name" className="mb-1 block text-xs font-semibold text-ink-muted">
            নাম <span className="text-danger">*</span>
          </label>
          <input
            id="review-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            autoComplete="name"
            className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent"
            placeholder="আপনার নাম"
          />
        </div>
        <div>
          <label htmlFor="review-email" className="mb-1 block text-xs font-semibold text-ink-muted">
            ইমেইল (ঐচ্ছিক, গোপন থাকবে)
          </label>
          <input
            id="review-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            autoComplete="email"
            className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent"
            placeholder="you@example.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="review-body" className="mb-1 block text-xs font-semibold text-ink-muted">
          আপনার রিভিউ <span className="text-danger">*</span>
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          required
          rows={4}
          className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent"
          placeholder="বইটি কেমন লাগলো লিখুন…"
        />
      </div>

      <Turnstile onVerify={setToken} appearance="interaction-only" resetKey={resetKey} />

      {notice && (
        <p
          className={`text-sm ${notice.kind === "ok" ? "text-ink" : "text-danger"}`}
          role={notice.kind === "error" ? "alert" : undefined}
        >
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
          {submitting ? "পাঠানো হচ্ছে…" : "রিভিউ পাঠান"}
        </button>
        <span className="text-xs text-ink-muted">পর্যালোচনার পর প্রকাশিত হবে।</span>
      </div>
    </form>
  );
}

export default function ReviewSection({ bookSlug }: { bookSlug: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Deferred until the section nears the viewport, so the REST round-trip
  // costs nothing for readers who never scroll this far (the majority).
  const [visible, setVisible] = useState(false);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  // Starts true, and the fetch effect below never sets it: "the reviews have
  // not arrived yet" is the truth from first paint until they do, and setting
  // it inside the effect meant one extra render per load plus a frame in which
  // `count === 0` was indistinguishable from "no reviews yet" and the empty
  // state flashed.
  const [loading, setLoading] = useState(true);

  const turnstileOn = isTurnstileEnabled();

  useEffect(() => {
    if (!containerRef.current || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const query = new URLSearchParams({
      // Filter on the relationship's slug: the browser knows the slug, not
      // the numeric book id, and Payload's REST where supports the dot path.
      "where[book.slug][equals]": bookSlug,
      // Asked for explicitly rather than left to the collection's access rule.
      // That rule narrows to approved-only for ANONYMOUS requests and returns
      // everything to a logged-in one, so without this a moderator reading a
      // book page in the same browser as /admin saw pending and spam reviews
      // rendered as published. Two independent filters now have to fail before
      // an unapproved review reaches a public list.
      "where[status][equals]": "approved",
      sort: "-createdAt",
      limit: "50",
      depth: "0",
    });
    fetch(`/api/reviews?${query.toString()}`, {
      headers: { accept: "application/json" },
      // The other half of the same fix. fetch defaults to `same-origin`, which
      // attaches the payload-token cookie, so this request was authenticated
      // for anyone with an admin session and the server answered accordingly.
      // This is a public read of public rows: it needs no identity, and asking
      // as nobody makes what the visitor sees independent of who they are.
      credentials: "omit",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { docs?: PublicReview[] }) => {
        if (!cancelled) setReviews(Array.isArray(data.docs) ? data.docs : []);
      })
      .catch(() => {
        // A failed load is not worth a scary message; the form below still
        // works and the list simply stays empty.
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, bookSlug]);

  const count = reviews.length;

  return (
    <section
      id="reviews"
      ref={containerRef}
      className="no-print mt-10 border-t border-rule pt-8"
      aria-labelledby="reviews-heading"
    >
      <h2 id="reviews-heading" className="section-title">
        পাঠকের রিভিউ{count > 0 ? ` (${toBnDigits(count)})` : ""}
      </h2>

      <div className="mt-5 space-y-4">
        {loading && <p className="text-sm text-ink-muted">রিভিউ লোড হচ্ছে…</p>}
        {!loading && count === 0 && (
          <p className="text-sm text-ink-muted">
            এখনও কোনো রিভিউ নেই। বইটি পড়ে থাকলে প্রথম রিভিউটি আপনিই লিখুন।
          </p>
        )}
        {reviews.map((r) => (
          <article key={r.id} className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-sm font-bold text-ink">{r.authorName}</span>
              <span className="shrink-0 text-xs text-ink-muted">{formatWhen(r.createdAt)}</span>
            </div>
            <div className="mt-1">
              <StarRow rating={r.rating} />
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
              {r.body}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="mb-4 text-sm font-bold text-ink">রিভিউ লিখুন</h3>
        <ReviewForm bookSlug={bookSlug} turnstileOn={turnstileOn} />
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import AdSlot from "@/components/AdSlot";
import BuyButton from "@/components/BuyButton";
import { toBengaliNumerals } from "@/lib/numerals";

/** The wait the reader is told about ("প্রায় ১০ সেকেন্ড") in the button copy
 *  below. One constant, one place. */
const WAIT_SECONDS = 10;

/** The free-PDF download flow, and the site's single most valuable affiliate
 *  moment.
 *
 *  idle → waiting (10s, with an ad in the honest gap) → ready. In the ready
 *  state the download link is joined by the BUY panel: the reader who just
 *  downloaded a free PDF is the reader most demonstrably interested in this
 *  exact book, which is why "post-download" is its own AffiliateSlot and why
 *  the plan expects ~40% of buy clicks to come from here. `buyHref` arrives
 *  already decorated (or null — Tier D never reaches this component, but a
 *  free book with no Rokomari page simply shows no panel).
 *
 *  The countdown is measured from wall-clock elapsed time rather than by
 *  decrementing per tick: browsers throttle timers in backgrounded tabs, so
 *  a decrementing counter stalls at "4s" forever if the reader switches away.
 *  Measuring means the wait is over when it is over, however often the timer
 *  actually fired. The interval lives in an effect (not the click handler)
 *  so navigation mid-countdown clears it.
 *
 *  `track("download_click")` fires when the real link is clicked, not when
 *  the countdown starts — the metric is delivered files, not curiosity. */
export default function DownloadButton({
  pdfUrl,
  pdfSizeMB,
  slug,
  buyHref,
}: {
  pdfUrl: string | null;
  pdfSizeMB: number | null;
  slug: string;
  /** Decorated affiliate URL for the post-download panel, or null. */
  buyHref: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "waiting" | "ready">("idle");
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);

  useEffect(() => {
    if (status !== "waiting") return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, WAIT_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus("ready");
    }, 250);
    return () => clearInterval(interval);
  }, [status]);

  // No PDF: the caller normally doesn't render this at all for Tier D, but a
  // Tier A/B book whose file is still being prepared shows the honest state.
  if (!pdfUrl) {
    return (
      <button
        type="button"
        disabled
        className="btn w-full cursor-not-allowed border border-rule bg-surface-sunken text-ink-muted sm:w-auto"
      >
        সম্পূর্ণ PDF শীঘ্রই আসছে
      </button>
    );
  }

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={() => {
          setSecondsLeft(WAIT_SECONDS);
          setStatus("waiting");
        }}
        className="btn-download w-full text-base shadow-card sm:w-auto"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        ফ্রি PDF ডাউনলোড করুন
        {typeof pdfSizeMB === "number" && (
          <span className="text-sm font-medium opacity-80">
            ({toBengaliNumerals(pdfSizeMB)} MB)
          </span>
        )}
      </button>
    );
  }

  if (status === "waiting") {
    return (
      <div className="card p-5 text-left">
        <p className="text-sm font-medium text-ink">
          আপনার ফাইল প্রস্তুত করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন… (
          {toBengaliNumerals(secondsLeft)} সেকেন্ড)
        </p>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={WAIT_SECONDS}
          aria-valuenow={WAIT_SECONDS - secondsLeft}
        >
          <div
            className="h-full rounded-full bg-download transition-all"
            style={{ width: `${((WAIT_SECONDS - secondsLeft) / WAIT_SECONDS) * 100}%` }}
          />
        </div>
        {/* The one honest ad moment: the reader is genuinely waiting. Renders
            nothing until AdSense is configured (AdSlot's contract), so an
            unconfigured site shows no empty box here. */}
        <div className="mt-4">
          <AdSlot placement="download" minHeight={120} />
        </div>
      </div>
    );
  }

  // Ready: the download link, and beside it the post-download buy panel.
  // Forcing attachment disposition is the hosting layer's job (R2 custom
  // domain / Transform Rule); the `download` attribute covers same-origin and
  // target="_blank" guarantees this tab is never navigated away either way.
  return (
    <div className="card p-5 text-left">
      <a
        href={pdfUrl}
        download
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("download_click", { slug })}
        className="btn-download w-full text-base shadow-card sm:w-auto"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M4 10.5l4 4 8-9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        এখনই ডাউনলোড করুন (নতুন ট্যাবে)
      </a>

      {buyHref && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-sm text-ink-muted">
            বইটি ভালো লাগলে ছাপা কপি সংগ্রহ করুন। লেখক ও প্রকাশকের পাশে থাকুন।
          </p>
          <BuyButton
            href={buyHref}
            slug={slug}
            slot="post-download"
            className="btn-buy mt-3 w-full sm:w-auto"
          />
        </div>
      )}
    </div>
  );
}

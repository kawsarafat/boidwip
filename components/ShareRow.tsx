"use client";

import { useEffect, useState } from "react";
import { useClientFlag } from "@/lib/useClientFlag";

/** Share controls.
 *
 *  Plain links and one clipboard call. No Facebook SDK, no AddThis, no share
 *  widget: every one of those is a third-party script that loads on every
 *  chapter page, sets cookies, and shows up in Core Web Vitals as somebody
 *  else's JavaScript. The sharer URLs below are documented endpoints that need
 *  no SDK at all.
 *
 *  Facebook and WhatsApp specifically, and in that order, because that is where
 *  Bangladeshi students actually pass links around. Twitter/X is not worth the
 *  row space here.
 *
 *  `url` is passed in from the server rather than read from window.location, so
 *  the two sharer links are real hrefs in the HTML and work before hydration,
 *  and with JavaScript disabled entirely. */
export default function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  // Feature-detected on the client, not during the server render: navigator
  // does not exist there, and branching on it in a way the server and the
  // browser disagree about is a hydration mismatch on the one paint that
  // matters most. See lib/useClientFlag.ts for why this is not a
  // useState/useEffect pair.
  const canNativeShare = useClientFlag(() => typeof navigator.share === "function");

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // in-app browsers. Silence is correct here: the two sharer links next to
      // this button still work, so there is nothing to recover from and
      // nothing useful to tell the reader.
    }
  }

  const shareText = `${title} ${url}`;

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <span className="me-1 text-xs font-bold uppercase tracking-widest text-ink-muted">
        শেয়ার করুন
      </span>

      {canNativeShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
          className="chip hover:border-ink/20 hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 12v3.5A1.5 1.5 0 005.5 17h9a1.5 1.5 0 001.5-1.5V12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          শেয়ার
        </button>
      )}

      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="chip hover:border-ink/20 hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M11.5 18v-6.5h2.2l.3-2.6h-2.5V7.3c0-.7.2-1.2 1.2-1.2h1.4V3.7c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5v2.8H6.5v2.6h2.2V18h2.8z" />
        </svg>
        Facebook
      </a>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="chip hover:border-ink/20 hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M10 2a8 8 0 00-6.9 12l-1 3.7 3.8-1A8 8 0 1010 2zm4.3 11.2c-.2.5-1 1-1.4 1-.4.1-.9.1-2.6-.7-2-1-3.3-3.1-3.4-3.3-.1-.2-.8-1.2-.8-2.2s.5-1.5.7-1.7c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.6 1.5c0 .1.1.2 0 .4l-.3.4-.2.3c-.1.1-.2.2 0 .4.1.2.5.9 1.1 1.4.8.7 1.3.9 1.5 1 .2.1.3.1.4 0l.6-.7c.2-.2.3-.1.5-.1l1.4.7c.2.1.3.2.4.3v.9z" />
        </svg>
        WhatsApp
      </a>

      <button type="button" onClick={copy} className="chip hover:border-ink/20 hover:text-ink">
        {copied ? (
          <>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M4 10.5l4 4 8-9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            কপি হয়েছে
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M7.5 7.5V5a1.5 1.5 0 011.5-1.5h6A1.5 1.5 0 0116.5 5v6a1.5 1.5 0 01-1.5 1.5h-2.5M5 7.5h6A1.5 1.5 0 0112.5 9v6A1.5 1.5 0 0111 16.5H5A1.5 1.5 0 013.5 15V9A1.5 1.5 0 015 7.5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            লিংক কপি
          </>
        )}
      </button>
    </div>
  );
}

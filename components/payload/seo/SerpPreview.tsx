"use client";

import { useEffect, useState } from "react";
import { useFormFields } from "@payloadcms/ui";
import { SITE_NAME, bookTitle, bookDescription } from "@/lib/seo";
import { isRightsTier } from "@/lib/types";
import styles from "./SerpPreview.module.css";

/** Live Google-result (SERP) preview, rendered as a `ui` field in the Books
 *  editor so the writer sees the search snippet their title and subtitle will
 *  actually produce, as they type.
 *
 *  UNLIKE ITS PREDECESSOR, THIS DOES NOT DUPLICATE THE FORMULA.
 *
 *  The predecessor recomputed the title/description by hand because its seo
 *  helpers lived behind server-only imports. Here lib/seo.ts is deliberately
 *  pure (its only imports are lib/numerals and lib/types, both dependency-
 *  free), so this client component calls the REAL `bookTitle()` and
 *  `bookDescription()` — the exact functions app/(frontend)/book/[slug]/
 *  page.tsx `generateMetadata()` uses. If the formula changes, the preview
 *  changes with it; there is no second copy to fall out of step. Keep
 *  lib/seo.ts importable from the client — adding a server-only import there
 *  breaks THIS file, and that break is loud (build error), which is the
 *  point.
 *
 *  What still mirrors by hand is only the `title.template` ("%s | বইদ্বীপ")
 *  from app/(frontend)/layout.tsx, one string.
 *
 *  The description has one honest divergence: when the subtitle is empty the
 *  live site appends a summary flattened from the Lexical synopsis
 *  (lib/render.ts plainSummary), which this component cannot cheaply
 *  replicate against unserialized editor state. It shows the base sentence
 *  and says so, rather than pretending.
 *
 *  Admin chrome, so the labels are English; the previewed content itself is
 *  the book's own Bengali, shown verbatim. */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app").replace(
  /\/$/,
  ""
);

// Google truncates a desktop title at roughly 600px and a description at
// roughly 920px. Character counts are a rough proxy for pixels, but they are
// the widely-used editorial targets and need no font metrics to compute.
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

// Author names rarely change during an edit session; cache so switching the
// relationship back and forth does not refetch.
const authorCache = new Map<number, string>();

function useStringField(path: string): string {
  return useFormFields(([fields]) => {
    const v = fields?.[path]?.value;
    return typeof v === "string" ? v : "";
  });
}

function useHasValue(path: string): boolean {
  return useFormFields(([fields]) => {
    const v = fields?.[path]?.value;
    return v !== null && v !== undefined && v !== "";
  });
}

// The authors relationship stores ids. They arrive as numbers from Postgres
// but can cross the form boundary as strings (and hasMany rows can be bare
// ids or {relationTo, value} pairs), so both shapes are normalised here.
function useAuthorIds(): number[] {
  return useFormFields(([fields]) => {
    const v = fields?.authors?.value;
    if (!Array.isArray(v)) return [];
    return v
      .map((entry) => {
        const raw =
          typeof entry === "object" && entry !== null && "value" in entry
            ? (entry as { value: unknown }).value
            : entry;
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) && n > 0 ? n : null;
      })
      .filter((n): n is number => n !== null);
  });
}

// The byline needs the authors' names, which the form does not hold — only
// their ids. Fetch each once per id.
function useAuthorNames(ids: number[]): string[] {
  const [names, setNames] = useState<string[]>(() =>
    ids.map((id) => authorCache.get(id)).filter((n): n is string => Boolean(n))
  );
  const key = ids.join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ids.map(async (id) => {
        const cached = authorCache.get(id);
        if (cached) return cached;
        try {
          const r = await fetch(`/api/authors/${id}?depth=0`, {
            headers: { accept: "application/json" },
          });
          if (!r.ok) return "";
          const doc = await r.json();
          const name = String(doc?.name ?? "");
          if (name) authorCache.set(id, name);
          return name;
        } catch {
          // A failed lookup just leaves that author out of the preview.
          return "";
        }
      })
    ).then((resolved) => {
      if (!cancelled) setNames(resolved.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return names;
}

export default function SerpPreview() {
  const title = useStringField("title");
  const subtitle = useStringField("subtitle");
  const slug = useStringField("slug");
  const rightsTier = useStringField("rightsTier");
  const hasPdf = useHasValue("pdf");
  const hasPdfUrl = useHasValue("pdfExternalUrl");
  const authorNames = useAuthorNames(useAuthorIds());

  // The projection lib/seo.ts functions take: only the fields the formulas
  // read, in BookContent's shape. pdfUrl just has to be truthy/null here —
  // the real URL is derived at render time and the formula only branches on
  // its presence. isRightsTier is the same fail-closed guard the render layer
  // uses: an unset or half-typed tier previews as the buy-only shape.
  const seoBook = {
    title: title.trim() || "বইয়ের নাম",
    authors: authorNames.map((name) => ({ name, slug: "" })),
    rightsTier: isRightsTier(rightsTier) ? rightsTier : ("in-copyright" as const),
    pdfUrl: hasPdf || hasPdfUrl ? "/pdf" : null,
    summary: subtitle.trim(),
    pageCount: null,
    pdfSizeMB: null,
  };

  const usingFallback = subtitle.trim().length === 0;
  // === the one hand-mirrored piece: layout.tsx title.template ===
  const fullTitle = `${bookTitle(seoBook)} | ${SITE_NAME}`;
  const description = bookDescription(seoBook);

  const host = SITE_URL.replace(/^https?:\/\//, "");
  const displayUrl = `${host} › book › ${slug.trim() || "…"}`;

  const titleLen = fullTitle.length;
  const descLen = description.length;
  const titleClass = titleLen > TITLE_MAX ? styles.warn : styles.ok;
  const descClass =
    descLen < DESC_MIN || descLen > DESC_MAX ? styles.warn : styles.ok;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.urlRow}>
          <span className={styles.favicon} aria-hidden="true">
            ব
          </span>
          <span className={styles.url}>{displayUrl}</span>
        </div>
        <h3 className={styles.title}>{fullTitle}</h3>
        <p className={`${styles.desc}${usingFallback ? " " + styles.descFallback : ""}`}>
          {description}
        </p>
      </div>

      <div className={styles.meters}>
        <span className={styles.meter}>
          <span className={styles.meterLabel}>Title</span>
          <span className={`${styles.count} ${titleClass}`}>{titleLen}</span>
          <span className={styles.hint}>
            {titleLen > TITLE_MAX ? "over ~60, Google will trim it" : "of ~60 shown"}
          </span>
        </span>
        <span className={styles.meter}>
          <span className={styles.meterLabel}>Description</span>
          <span className={`${styles.count} ${descClass}`}>{descLen}</span>
          <span className={styles.hint}>
            {usingFallback
              ? "base sentence only — the live site appends a synopsis summary; add a subtitle to control it"
              : descLen > DESC_MAX
                ? "over ~160, Google will trim it"
                : descLen < DESC_MIN
                  ? "under ~70, aim a little longer"
                  : "of ~160 shown"}
          </span>
        </span>
        {!rightsTier && (
          <span className={styles.meter}>
            <span className={`${styles.count} ${styles.warn}`}>!</span>
            <span className={styles.hint}>rights tier unset — preview assumes the buy-only title shape</span>
          </span>
        )}
      </div>
    </div>
  );
}

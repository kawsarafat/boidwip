import { toBengaliNumerals } from "@/lib/numerals";

/** Star rating display — server component, no state, renders identically in
 *  cards, the book page header and the review list.
 *
 *  Fractional fill is done with a clipped overlay rather than half-star
 *  glyphs: one full-strength row on top of one muted row, the top row's width
 *  set to the rating percentage. That renders 4.3 as 4.3, not as "4½-ish",
 *  and needs no extra SVG variants.
 *
 *  The number is shown next to the stars because a star row alone is not
 *  scannable at card size — and it is the same value the aggregateRating in
 *  JSON-LD carries (ASCII there, Bengali here; see lib/numerals.ts). */
export default function RatingStars({
  rating,
  count,
  size = "sm",
}: {
  /** Average rating 0–5, or null when the book has no approved reviews yet. */
  rating: number | null;
  /** How many approved reviews the average is built from. Omit to hide. */
  count?: number;
  size?: "sm" | "md";
}) {
  if (rating === null || rating <= 0) return null;

  const clamped = Math.min(5, Math.max(0, rating));
  const pct = (clamped / 5) * 100;
  const starClass = size === "md" ? "h-[1.1rem] w-[4.6rem]" : "h-3.5 w-[3.6rem]";

  return (
    <span
      className="inline-flex items-center gap-1.5"
      // The stars themselves are decorative; the label carries the value.
      aria-label={`রেটিং: ৫ এর মধ্যে ${toBengaliNumerals(clamped.toFixed(1))}`}
    >
      <span className={`relative inline-block ${starClass}`} aria-hidden>
        <Stars className="text-rule" />
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
          {/* Fixed-width, positioned inner wrapper so the clipped copy keeps
              the FULL row width (only the clip narrows) — otherwise the
              absolute SVG would size itself to the clip and squash. */}
          <span className={`relative block ${starClass}`}>
            <Stars className="text-warn" />
          </span>
        </span>
      </span>
      <span
        className={`font-semibold text-ink ${size === "md" ? "text-sm" : "text-xs"}`}
        aria-hidden
      >
        {toBengaliNumerals(clamped.toFixed(1))}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className={`text-ink-muted ${size === "md" ? "text-sm" : "text-xs"}`}>
          ({toBengaliNumerals(count)}টি রিভিউ)
        </span>
      )}
    </span>
  );
}

/** Five stars in one path-repeated SVG. viewBox width 100 = five 20-unit
 *  cells, so the fractional clip above maps percentage straight to stars. */
function Stars({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 20"
      className={`absolute inset-0 h-full w-full ${className ?? ""}`}
      fill="currentColor"
      aria-hidden
    >
      {[0, 20, 40, 60, 80].map((x) => (
        <path
          key={x}
          transform={`translate(${x} 0)`}
          d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.11l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z"
        />
      ))}
    </svg>
  );
}

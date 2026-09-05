import Link from "next/link";
import { toBengaliNumerals } from "@/lib/numerals";

/** One card in a hub grid. Everything is pre-worded by the page: this component
 *  owns the SHAPE of an entity card, not the vocabulary of any one hub. */
export type HubCard = {
  href: string;
  name: string;
  /** The line under the name: a lifespan, a parent category, a book count as
   *  prose. Omit rather than passing an empty string. */
  subline?: string | null;
  /** Already-worded count pills, in the order they should read. */
  chips?: string[];
  /** A round photo or logo. When absent the card falls back to a monogram, so
   *  a hub whose entities have no images (categories, series) still looks like
   *  it was designed rather than like an image failed to load. */
  image?: string | null;
  /** Rendered as the one accented chip, and only when above zero. Kept separate
   *  from `chips` because the free-PDF promise is the site's load-bearing claim
   *  and must not be spellable by a caller who has not counted it. */
  freePdfCount?: number;
};

/** The grid every hub index shares: /author, /category, /publisher, /series.
 *
 *  WHY ONE COMPONENT. The four pages differ in their vocabulary and their
 *  JSON-LD and in nothing else — same card, same grid, same empty state. Four
 *  copies is how the accessible name of a stretched link ends up right on two of
 *  them and wrong on the other two. /list is deliberately NOT built from this:
 *  its cards lead with a fan of covers, which is a different shape for a
 *  different reason (the books are the content there).
 *
 *  THE WHOLE CARD IS CLICKABLE via the stretched-link pattern — `after:absolute
 *  after:inset-0` on the one anchor — rather than by wrapping the card in an
 *  <a>. A wrapper would put the chips inside the link and a screen reader would
 *  read "রবীন্দ্রনাথ ঠাকুর ৯টি বই ৩টি ফ্রি PDF" as the link's name. */
export default function EntityHubGrid({
  cards,
  emptyMessage,
  headingAs = "h2",
  imageStyle = "photo",
}: {
  cards: readonly HubCard[];
  /** Shown instead of the grid when there is nothing yet. Bengali, like the
   *  rest of the page: this is reader-facing copy, not admin chrome. */
  emptyMessage: string;
  /** One level below the page's own h1. */
  headingAs?: "h2" | "h3";
  /** How to frame `image`. A portrait wants a circle and a crop; a publisher's
   *  logo is wide, and cropping it to a circle eats the wordmark — so "logo"
   *  gets the rounded square and object-contain that /publisher/<slug> uses. */
  imageStyle?: "photo" | "logo";
}) {
  const Heading = headingAs;

  const imageClass =
    imageStyle === "logo"
      ? "h-14 w-14 shrink-0 rounded-lg border border-rule bg-surface object-contain p-1.5"
      : "h-14 w-14 shrink-0 rounded-full border border-rule object-cover";

  if (cards.length === 0) {
    return (
      <p className="mt-8 rounded-xl2 border border-dashed border-ink/20 p-8 text-center text-sm text-ink-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.href}>
          <article className="card-interactive relative flex h-full items-start gap-3.5 p-4">
            {card.image ? (
              // A plain <img>, matching /author/<slug>: an uploaded photo's URL
              // is an R2 origin in production, which next/image would need a
              // remotePatterns entry for, and these are already small squares.
              // eslint-disable-next-line @next/next/no-img-element -- see above
              <img
                src={card.image}
                // Decorative: the heading beside it names the entity, and the
                // stretched link takes its name from that heading. An alt here
                // would make a screen reader read the name twice per card.
                alt=""
                width={56}
                height={56}
                className={imageClass}
              />
            ) : (
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-rule bg-accent-soft text-xl font-extrabold text-accent"
              >
                {/* First code point, not first grapheme: a Bengali cluster like
                    "ক্ষ" would be cut after "ক", which is still a legible
                    initial. Intl.Segmenter would be exact and is not worth a
                    polyfill decision for one decorative glyph. */}
                {Array.from(card.name)[0] ?? "?"}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <Heading className="text-base font-bold leading-snug text-ink">
                <Link href={card.href} className="after:absolute after:inset-0">
                  {card.name}
                </Link>
              </Heading>

              {card.subline && (
                <p className="mt-0.5 truncate text-xs text-ink-muted">{card.subline}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {card.chips?.map((chip) => (
                  <span key={chip} className="chip px-2 py-0.5">
                    {chip}
                  </span>
                ))}
                {typeof card.freePdfCount === "number" && card.freePdfCount > 0 && (
                  <span className="chip bg-download/10 px-2 py-0.5 font-semibold text-download">
                    {toBengaliNumerals(card.freePdfCount)}টি ফ্রি PDF
                  </span>
                )}
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

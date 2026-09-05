/** One initial for the account avatar, and the reason it is not `name[0]`.
 *
 *  The display name on a Users document is whatever the editor typed, and on this
 *  project that is as likely to be Bengali as English. `name[0]` is a single UTF-16
 *  code unit, which is the wrong unit twice over:
 *
 *   - "কাওসার" indexes to "ক" by luck, because the matra that follows is a separate
 *     code point. "শ্রী" indexes to "শ" and drops the ্র conjunct, so the avatar
 *     shows a letter the editor did not write.
 *   - Anything outside the BMP (an emoji in a display name is not hypothetical)
 *     indexes to half a surrogate pair, which renders as U+FFFD.
 *
 *  `Intl.Segmenter` with grapheme granularity is the unit a reader would call "one
 *  letter": it keeps combining marks, ZWJ sequences and - on ICU 74 and later, which
 *  is what Node 22 ships - Indic conjunct clusters together. The code-point fallback
 *  below exists only so this module is not the thing that breaks on an older runtime;
 *  it is still better than `[0]` because iterating a string yields code points.
 *
 *  Deliberately ONE grapheme, not two. Two initials are an English-name convention:
 *  "কাওসার আহমেদ" reduced to "কা" reads as a truncated word rather than as initials,
 *  and a Bengali cluster is wide enough that two of them do not fit a 28px tile
 *  anyway. */

/** Built once. `new Intl.Segmenter()` loads ICU break data, which is not something
 *  to redo per render on a component that appears on every admin screen. */
const graphemes =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** First grapheme cluster of `value`, or "" if there is nothing to take. */
function firstGrapheme(value: string): string {
  if (graphemes) {
    for (const { segment } of graphemes.segment(value)) return segment;
    return "";
  }
  // Iterating a string yields code points, so this is surrogate-safe even though
  // it cannot keep a matra or a conjunct attached to its base letter.
  for (const codePoint of value) return codePoint;
  return "";
}

/** The letter for the avatar tile.
 *
 *  Name first, because it is what the editor chose to be called; the email's local
 *  part only when the name is missing. Returns "" when neither yields a letter,
 *  which the tile renders as a plain brand-tinted circle rather than a placeholder
 *  glyph. Unreachable while `name` is a required field, but a monogram helper that
 *  throws on an empty string would be a strange thing to have to reason about.
 *
 *  Case is folded with `toUpperCase`, not `toLocaleUpperCase`: the locale-aware
 *  form maps "i" to "İ" under a Turkish locale, and an avatar is not the place to
 *  discover that the server's locale is not the editor's. Bengali is caseless, so
 *  the call is a no-op there. */
export function monogram(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const fromName = firstGrapheme((name ?? "").trim());
  if (fromName) return fromName.toUpperCase();

  const localPart = (email ?? "").trim().split("@")[0] ?? "";
  return firstGrapheme(localPart).toUpperCase();
}

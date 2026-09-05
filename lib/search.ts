/** Text normalization for the catalogue search.
 *
 *  Bengali search fails in ways an ASCII-only search never does, and every one
 *  of them shows up as "no results" for a book that is right there:
 *
 *  1. INVISIBLE CHARACTERS. ZWNJ (U+200C) and ZWJ (U+200D) control conjunct
 *     rendering in Bengali and are produced by ordinary keyboards and by
 *     copy-paste from Wikipedia. A title stored with a ZWNJ can never match the
 *     same title typed without one, and nobody can see the difference.
 *
 *  2. COMPOSED VS DECOMPOSED FORMS. The letters ya/rra/rha each exist both as
 *     one code point and as a base letter plus nukta (U+09BC). Two keyboards,
 *     two byte sequences, one glyph. NFC settles it.
 *
 *  3. DIGITS. This site prints Bengali numerals everywhere (lib/numerals.ts),
 *     so a title reads with Bengali digits while a reader on an English
 *     keyboard types ASCII ones.
 *
 *  4. PUNCTUATION. The danda (U+0964) ends Bengali sentences and turns up
 *     inside titles; a query typed without it should still match.
 *
 *  5. SPELLING. Bengali orthography preserves distinctions Bengali phonology
 *     lost: sha/ssa/sa are one sound, na/nna are one sound, ja/ya are one
 *     sound, and the short/long i and u vowels are one vowel each. Readers
 *     spell by ear and get them wrong constantly - as do the transliterations
 *     in `titleLatin`.
 *
 *  So there are two keys per record, and the search tries them in order:
 *
 *  - the STRICT key (1-4 above): lossless as far as a reader is concerned, and
 *    it can never invent a match.
 *  - the LOOSE key (5 as well): folds the equivalence classes. Used only when
 *    the strict pass found nothing, which keeps the false positives it can
 *    produce out of every search that did not need them.
 *
 *  Pure string functions with no imports on purpose: this is the one piece of
 *  search logic worth unit-testing, and it runs in the browser on every
 *  keystroke. */

/* THE CHARACTER TABLES are built from numeric code points at module load
   rather than written as regex literals, because half of what they strip is
   invisible: as literal characters the class below would render as an
   empty-looking `[]` that no reviewer could check and a stray edit could
   silently empty. Code points carrying their Unicode names can be read. */

function esc(cp: number): string {
  return "\\u" + cp.toString(16).padStart(4, "0");
}
/** A global-match character class from single code points and inclusive
 *  ranges. Ranges are emitted as escapes too, so a range whose endpoint is a
 *  regex metacharacter (`[`, `\`, `]`) needs no special handling. */
function charClass(parts: ReadonlyArray<number | readonly [number, number]>): RegExp {
  const body = parts
    .map((p) => (typeof p === "number" ? esc(p) : `${esc(p[0])}-${esc(p[1])}`))
    .join("");
  return new RegExp(`[${body}]`, "g");
}

/** Invisible and formatting characters: deleted outright, never spaced. A ZWNJ
 *  sits INSIDE a word - spacing it would split one token into two. */
const INVISIBLE = charClass([
  0x00ad, // SOFT HYPHEN
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER  - conjunct control, everywhere in Bengali
  0x200d, // ZERO WIDTH JOINER      - ditto
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x2060, // WORD JOINER
  [0x2066, 0x2069], // the four bidi isolate controls
  0xfeff, // ZERO WIDTH NO-BREAK SPACE / BOM
]);

/** Punctuation and symbols, replaced by a SPACE rather than deleted: deleting
 *  fuses "১৯৭১: একটি..." into a single token, while a space is what the reader
 *  typed in the first place. */
const PUNCTUATION = charClass([
  [0x0021, 0x002f], // ! " # $ % & ' ( ) * + , - . /
  [0x003a, 0x0040], // : ; < = > ? @
  [0x005b, 0x0060], // [ \ ] ^ _ `
  [0x007b, 0x007e], // { | } ~
  0x00ab, // «
  0x00bb, // »
  0x00b7, // MIDDLE DOT
  0x0964, // DANDA        - the Bengali full stop
  0x0965, // DOUBLE DANDA
  0x09fd, // BENGALI ABBREVIATION SIGN
  [0x2010, 0x2027], // dashes, curly quotes, bullet, ellipsis
  [0x2030, 0x205e], // per-mille, primes, daggers, fraction slash
]);

/** Bengali 0-9 (U+09E6-U+09EF) in code-point order, so the index IS the digit. */
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";
const BENGALI_DIGIT = charClass([[0x09e6, 0x09ef]]);
/** The equivalence classes of point 5, one group per line, each folded to its
 *  FIRST member. Every group here is a distinction Bengali writing keeps and
 *  Bengali speech does not, which is why readers get them wrong:
 *
 *   - শ ষ স  all say /ʃ/. "শশী" and "সসি" are the same word said aloud.
 *   - ন ণ    all say /n/; ণ survives only in Sanskrit-derived spellings.
 *   - জ য    all say /dʒ/.
 *   - ই ঈ / উ ঊ and their matching vowel signs: the short/long contrast was
 *     lost centuries ago, and the long forms are now purely etymological.
 *   - ং ঙ    both say /ŋ/, and which one a word takes is not predictable.
 *
 *  Deliberately NOT folded: ড়/ড, ঢ়/ঢ and র. They look related and are not -
 *  ড় is /ɽ/ against ড /ɖ/, a contrast speakers hear and use, so folding them
 *  would collapse genuinely different words. This table only ever merges
 *  characters a reader cannot tell apart by ear. */
const BENGALI_FOLD_GROUPS: readonly string[] = [
  "শষস",
  "নণ",
  "জয",
  "ইঈ",
  "উঊ",
  "িী",
  "ুূ",
  "ংঙ",
];

const BENGALI_FOLD: Record<string, string> = {};
for (const group of BENGALI_FOLD_GROUPS) {
  const canonical = group[0];
  for (const ch of group) BENGALI_FOLD[ch] = canonical;
}
/** The Latin half of the loose key, for `titleLatin` and for readers who type
 *  romanised Bengali. Bengali has no standard romanisation, so the same book is
 *  "Sesher Kabita", "Shesher Kobita" and "Seshér Kôbita" depending on who typed
 *  it. Each rule below is a substitution that appears in real transliterations;
 *  none of them is a general phonetic theory.
 *
 *  ORDER MATTERS. The digraph rules run before the doubled-letter collapse,
 *  because collapsing first would turn "oo" into "o" and lose the /u/ this is
 *  trying to recover. */
function foldLatin(text: string): string {
  return (
    text
      .replace(/ee/g, "i")
      .replace(/oo/g, "u")
      .replace(/aa/g, "a")
      .replace(/ii/g, "i")
      .replace(/uu/g, "u")
      // o -> a is the big one, and it is not a guess: Bengali's inherent vowel
      // (the one with no vowel sign at all) is romanised as both, by the same
      // people on the same day. কবিতা is "kobita" and "kabita", রবীন্দ্রনাথ is
      // "Rabindranath" and "Robindronath", কলকাতা is "Kolkata" and "Kalkata".
      // Nothing else in this function moves as many real titles.
      .replace(/o/g, "a")
      // ph/f and sh/s mirror the Bengali groups above: same sound, two spellings.
      .replace(/ph/g, "f")
      .replace(/sh/g, "s")
      .replace(/v/g, "b") // Bengali has no /v/; ব does duty for both.
      .replace(/z/g, "j") // nor /z/; জ does duty for both.
      // Anything still doubled after that is a spelling habit, not a sound:
      // "Kobitta"/"Kobita", "Rabindranath"/"Rabbindranath".
      .replace(/([a-z])\1+/g, "$1")
  );
}

/** The STRICT key: everything a reader cannot see or would not think to type,
 *  removed. Never merges two characters a reader can tell apart, so it cannot
 *  invent a match. */
export function normalizeSearchText(text: string): string {
  if (!text) return "";
  return (
    text
      // NFC first, so the two ways of spelling ya/rra/rha (য় ড় ঢ়) converge:
      // one keyboard emits the single code point U+09DF, another emits base +
      // nukta. Note the direction — U+09DC/U+09DD/U+09DF are Unicode
      // COMPOSITION EXCLUSIONS, so NFC decomposes them to base + nukta rather
      // than composing them. Which form wins does not matter here; that both
      // spellings land on the SAME form does, and the nukta surviving is what
      // keeps ড় distinct from ড below.
      .normalize("NFC")
      .replace(INVISIBLE, "")
      // indexOf into a ten-character string, so the table below IS the mapping.
      .replace(BENGALI_DIGIT, (d) => String(BENGALI_DIGITS.indexOf(d)))
      .replace(PUNCTUATION, " ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  );
}
/** Applies the equivalence classes to an ALREADY-strict key. Split out so
 *  `searchKeys` can produce both keys from a single normalization pass -
 *  normalizing is the expensive half, and it happens once per record. */
function foldStrict(strict: string): string {
  let out = "";
  // Iterating a string yields code points, not UTF-16 units, which is what the
  // table is keyed by.
  for (const ch of strict) out += BENGALI_FOLD[ch] ?? ch;
  return foldLatin(out);
}

/** The LOOSE key on its own. Exported for the unit tests; callers that need
 *  both keys should use `searchKeys`. */
export function foldSearchText(text: string): string {
  return foldStrict(normalizeSearchText(text));
}

export type SearchKeys = {
  strict: string;
  loose: string;
};

/** Both keys for one piece of text. */
export function searchKeys(text: string): SearchKeys {
  const strict = normalizeSearchText(text);
  return { strict, loose: foldStrict(strict) };
}

/** The query as the words a haystack has to contain, in both keys. Both arms
 *  come back together because the caller runs the strict pass first and only
 *  falls back to the loose one when strict matched nothing. */
export function searchTokens(query: string): { strict: string[]; loose: string[] } {
  const keys = searchKeys(query);
  return {
    strict: keys.strict ? keys.strict.split(" ") : [],
    loose: keys.loose ? keys.loose.split(" ") : [],
  };
}

/** True when every token appears somewhere in the haystack. Substring, not
 *  prefix: a reader searching "মুক্তিযুদ্ধ" should find "বাংলাদেশের
 *  মুক্তিযুদ্ধের ইতিহাস", and Bengali compounds put the searched word in the
 *  middle far more often than English does. */
export function matchesTokens(haystack: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((t) => haystack.includes(t));
}

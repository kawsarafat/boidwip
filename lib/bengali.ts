/** Bengali possessive inflection (ষষ্ঠী বিভক্তি) for generated titles.
 *
 *  WHY THIS EXISTS: `${name} বই` is not a Bengali phrase. "উপন্যাস বই" is two
 *  bare nouns shoved together; the first has to be inflected before it can own
 *  the second — "উপন্যাসের বই". The same goes for a person: writing
 *  "শরৎচন্দ্র চট্টোপাধ্যায় এর বই" leaves the suffix standing as a loose word,
 *  which reads about the way "Sarat Chandra Chattopadhyay 's books" reads in
 *  English. Every generated title, h1 and JSON-LD name that puts a taxonomy or
 *  person name in front of a noun goes through here, so no page ships the
 *  uninflected form.
 *
 *  ORTHOGRAPHIC, NOT PHONETIC, and deliberately so: the suffix is chosen from
 *  the last WRITTEN character, because Bengali spells the possessive by fusing
 *  it onto that character. After a consonant letter the suffix is the vowel
 *  sign ে plus র (স + ের → সের); after a vowel sign it is a bare র
 *  (কবিতা + র → কবিতার). Phonology would send us the wrong way on a word like
 *  শব্দ, which ends in a spoken /o/ and still takes the consonant form
 *  (শব্দের).
 *
 *  IT INFLECTS THE LAST WORD ONLY. "প্রেমের উপন্যাস" → "প্রেমের উপন্যাসের":
 *  the suffix marks the end of the noun phrase, not every word inside it.
 *
 *  KNOWN LIMIT, written down so nobody has to rediscover it: a monosyllable is
 *  recognised as "one consonant plus one vowel sign" (মা → মায়ের, চা →
 *  চায়ের). A monosyllable spelled with a consonant cluster would take the
 *  polysyllabic suffix instead. Nothing in the catalogue is of that shape, and
 *  the result still reads as Bengali when it happens, so this is a wart rather
 *  than a bug. */

/* The four suffix forms. AFTER_CONSONANT and AFTER_VOWEL differ by a single
 * combining mark that is invisible in a diff and nearly invisible in an editor,
 * and swapping them yields text that renders as a plausible but different word
 * rather than as an obvious error — so each one carries the glyph it produces in
 * a trailing comment, and the unit tests assert the produced strings rather than
 * these names. */
const AFTER_CONSONANT = "ের"; //     ের  fuses onto a consonant letter
const AFTER_VOWEL = "র"; //               র   follows a vowel sign
const AFTER_HIATUS = "য়ের"; //  য়ের needs the য় glide
const AFTER_FOREIGN = "-এর"; //      -এর hyphenated onto Latin/digits

const VIRAMA = "্"; //    ্  হসন্ত
const ANUSVARA = "ং"; //  ং
const KHANDA_TA = "ৎ"; // ৎ
const NGA = "ঙ"; //       ঙ
const TA = "ত"; //        ত
const NUKTA = "়"; // ়  see the NFC note on bengaliGenitive

const VOWEL_SIGNS = "ািীুূৃৄেৈোৌ";
const INDEPENDENT_VOWELS = "অআইঈউঊঋঌএঐওঔ";

/** ক–হ. ড় ঢ় য় are NOT here: in NFC they are two codepoints, a letter from this
 *  range plus a nukta, and the caller strips the nukta before asking. */
function isConsonant(char: string): boolean {
  const cp = char.codePointAt(0) ?? 0;
  return cp >= 0x0995 && cp <= 0x09b9;
}

/** `উপন্যাস` → `উপন্যাসের`, `কবিতা` → `কবিতার`, `চট্টোপাধ্যায়` → `চট্টোপাধ্যায়ের`.
 *
 *  NFC IN, NFC OUT, and that is load-bearing rather than tidiness. Bengali
 *  writes ড় ঢ় য় either as one precomposed codepoint or as a base letter plus
 *  the nukta ়, and all three precomposed forms are Unicode composition
 *  exclusions — so NFC picks the TWO-codepoint form. A name ending in য়
 *  therefore ends in a combining mark, not a letter, which is exactly how the
 *  first version of this function turned শরৎচন্দ্র চট্টোপাধ্যায় into
 *  "চট্টোপাধ্যায়-এর": it read the nukta, found no letter it recognised and took
 *  the foreign-word branch. Normalising on the way in makes the two spellings
 *  one case, and on the way out keeps every generated title in a single form so
 *  string comparisons downstream (tests, dedupe, cache keys) do not depend on
 *  how an editor happened to save a literal.
 *
 *  Safe on an empty string and on a name that is not Bengali at all; never
 *  throws, so a call site can inline it in a template literal. */
export function bengaliGenitive(name: string): string {
  const trimmed = name.normalize("NFC").trim();
  if (!trimmed) return trimmed;

  const wordStart = trimmed.search(/\S+$/);
  const head = trimmed.slice(0, wordStart);
  const word = trimmed.slice(wordStart);
  return `${head}${inflect(word)}`.normalize("NFC");
}

function inflect(word: string): string {
  const chars = [...word];
  /* A trailing nukta is a mark on the letter before it (ড় ঢ় য়), so classify on
   * that letter and leave the mark where it is. */
  const at = chars[chars.length - 1] === NUKTA ? chars.length - 2 : chars.length - 1;
  if (at < 0) return `${word}${AFTER_FOREIGN}`;
  const last = chars[at];
  const stem = chars.slice(0, at).join("");

  /* ং and ৎ are word-FINAL spellings of sounds that revert to a full letter as
   * soon as a suffix follows: রং → রঙের, জগৎ → জগতের. A হসন্ত exists only to
   * silence the inherent vowel and the suffix supplies one, so it goes. */
  if (last === ANUSVARA) return `${stem}${NGA}${AFTER_CONSONANT}`;
  if (last === KHANDA_TA) return `${stem}${TA}${AFTER_CONSONANT}`;
  if (last === VIRAMA) return `${stem}${AFTER_CONSONANT}`;

  if (isConsonant(last)) return `${word}${AFTER_CONSONANT}`;

  /* An INDEPENDENT vowel this far into a word marks a hiatus rather than a
   * syllable of its own — বই, ভাই, যাচাই all end in a diphthong — and the
   * suffix needs the য় glide to attach to. A one-letter word is a real vowel
   * (ও → ওর). */
  if (INDEPENDENT_VOWELS.includes(last)) {
    return chars.length === 1 ? `${word}${AFTER_VOWEL}` : `${word}${AFTER_HIATUS}`;
  }

  /* Monosyllables take the glide as well (মা → মায়ের, never মার). One consonant
   * plus one vowel sign is the only two-character spelling, and no longer
   * spelling can be monosyllabic without a cluster — see the KNOWN LIMIT above. */
  if (VOWEL_SIGNS.includes(last)) {
    return chars.length <= 2 ? `${word}${AFTER_HIATUS}` : `${word}${AFTER_VOWEL}`;
  }

  /* Latin script, a digit, an abbreviation: Bengali cannot fuse a suffix onto
   * those, so it hyphenates instead ("PDF-এর", "৫-এর"). */
  return `${word}${AFTER_FOREIGN}`;
}

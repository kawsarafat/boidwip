import { describe, expect, it } from "vitest";
import {
  foldSearchText,
  matchesTokens,
  normalizeSearchText,
  searchKeys,
  searchTokens,
} from "@/lib/search";

/** Bengali search normalization (audit #16/#22).
 *
 *  These are the five failure modes the normalizer exists for, each written as
 *  a query a reader would actually type. Invisible characters are built with
 *  String.fromCharCode rather than pasted, so the source stays reviewable —
 *  a literal ZWNJ in a test file is a character nobody can see in a diff.
 *
 *  The strict/loose split is the contract: strict never merges two characters a
 *  reader can tell apart (so it cannot invent a match), loose merges the
 *  phonologically identical ones (so it can rescue a misspelling). Every test
 *  below asserts which key is responsible for a given match. */

const ZWNJ = String.fromCharCode(0x200c);
const ZWJ = String.fromCharCode(0x200d);
const SOFT_HYPHEN = String.fromCharCode(0x00ad);
const BOM = String.fromCharCode(0xfeff);
const YA_PRECOMPOSED = String.fromCharCode(0x09df);
const YA_DECOMPOSED = String.fromCharCode(0x09af, 0x09bc);
const RRA = String.fromCharCode(0x09dc);
const DA = String.fromCharCode(0x09a1);

describe("normalizeSearchText", () => {
  it("deletes zero-width and invisible characters without splitting the word", () => {
    // A ZWNJ sits INSIDE a word, so replacing it with a space would break the
    // word in two and no substring match would ever find it again.
    expect(normalizeSearchText(`বাংলা${ZWNJ}দেশ`)).toBe("বাংলাদেশ");
    expect(normalizeSearchText(`দেব${ZWJ}দাস`)).toBe("দেবদাস");
    expect(normalizeSearchText(`${BOM}কবিতা${SOFT_HYPHEN}`)).toBe("কবিতা");
  });

  it("converts Bengali digits to ASCII so ১৯৭১ and 1971 are one query", () => {
    expect(normalizeSearchText("১৯৭১")).toBe("1971");
    expect(normalizeSearchText("১৯৭১")).toBe(normalizeSearchText("1971"));
  });

  it("turns punctuation into space and collapses whitespace", () => {
    // The danda (U+0964) ends a Bengali sentence and is routinely typed into a
    // search box along with the title it followed.
    expect(normalizeSearchText("শেষের কবিতা।")).toBe("শেষের কবিতা");
    expect(normalizeSearchText("  গীতাঞ্জলি  —  রবীন্দ্রনাথ  ")).toBe("গীতাঞ্জলি রবীন্দ্রনাথ");
    expect(normalizeSearchText("Devdas (1917)")).toBe("devdas 1917");
  });

  it("lowercases Latin so romanized queries are case-insensitive", () => {
    expect(normalizeSearchText("Shesher Kobita")).toBe("shesher kobita");
  });

  it("converges the two Unicode spellings of য় / ড় / ঢ়", () => {
    // Direction is deliberately not asserted: U+09DF is a composition
    // exclusion, so NFC decomposes it. What matters is that both spellings
    // produce the same key.
    expect(normalizeSearchText(YA_PRECOMPOSED)).toBe(normalizeSearchText(YA_DECOMPOSED));
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   ")).toBe("");
    expect(normalizeSearchText("।")).toBe("");
  });
});

describe("foldSearchText", () => {
  it("merges the Bengali characters that spell the same sound", () => {
    // শ/ষ/স and ি/ী are phonologically merged in Bengali; a reader who hears a
    // title and types it gets these wrong constantly.
    expect(foldSearchText("শশী")).toBe(foldSearchText("সসি"));
    expect(foldSearchText("বরণ")).toBe(foldSearchText("বরন"));
    expect(foldSearchText("যাত্রা")).toBe(foldSearchText("জাত্রা"));
    expect(foldSearchText("বাংলা")).toBe(foldSearchText("বাঙলা"));
  });

  it("does NOT merge ড় with ড — that contrast is real", () => {
    // /ɽ/ against /ɖ/ is a distinction speakers hear and use, so folding it
    // would invent matches between unrelated words.
    expect(foldSearchText(RRA)).not.toBe(foldSearchText(DA));
  });

  it("reconciles the common romanization splits", () => {
    // The inherent vowel is romanized as both "o" and "a" — the single most
    // common way two people spell the same Bengali title in Latin script.
    expect(foldSearchText("Shesher Kobita")).toBe(foldSearchText("Sesher Kabita"));
    expect(foldSearchText("hazar bochor dhore")).toBe(foldSearchText("hajar bachar dhare"));
    expect(foldSearchText("nondito noroke")).toBe(foldSearchText("nandita narake"));
    // ph/f, v/b, z/j and doubled letters.
    expect(foldSearchText("Falguni")).toBe(foldSearchText("Phalguni"));
    expect(foldSearchText("Rabindranath")).toBe(foldSearchText("Rabbindranath"));
  });

  it("keeps unrelated titles apart (the negative control)", () => {
    // A fold aggressive enough to match everything is worse than no fold: the
    // loose pass would return the whole catalogue for any typo.
    expect(foldSearchText("দেবদাস")).not.toBe(foldSearchText("শ্রীকান্ত"));
    expect(foldSearchText("পরিণীতা")).not.toBe(foldSearchText("চরিত্রহীন"));
    // Thakur/Tagore is a different problem — two NAMES, not two spellings —
    // and must not be folded together by accident.
    expect(foldSearchText("Thakur")).not.toBe(foldSearchText("Tagore"));
  });
});

describe("searchKeys", () => {
  it("returns a strict key that has not been folded", () => {
    const keys = searchKeys("শশী");
    expect(keys.strict).toBe("শশী");
    expect(keys.loose).not.toBe(keys.strict);
  });

  it("derives both keys from the same normalization", () => {
    const keys = searchKeys(`১৯৭১${ZWNJ} সাল।`);
    expect(keys.strict).toBe("1971 সাল");
    expect(keys.loose).toBe(foldSearchText("1971 সাল"));
  });
});

describe("searchTokens", () => {
  it("splits on whitespace after normalization", () => {
    expect(searchTokens("শেষের কবিতা।").strict).toEqual(["শেষের", "কবিতা"]);
  });

  it("yields no tokens for a query with nothing searchable in it", () => {
    expect(searchTokens("")).toEqual({ strict: [], loose: [] });
    expect(searchTokens("  ।  ")).toEqual({ strict: [], loose: [] });
  });
});

describe("matchesTokens", () => {
  it("requires every token, anywhere in the haystack", () => {
    const haystack = normalizeSearchText("বাংলাদেশের মুক্তিযুদ্ধের ইতিহাস");
    // Substring, not prefix: Bengali compounds bury the searched word.
    expect(matchesTokens(haystack, ["মুক্তিযুদ্ধ"])).toBe(true);
    expect(matchesTokens(haystack, ["ইতিহাস", "বাংলাদেশ"])).toBe(true);
    expect(matchesTokens(haystack, ["ইতিহাস", "কবিতা"])).toBe(false);
  });

  it("matches nothing when there are no tokens", () => {
    // An empty token list means "the reader typed nothing searchable", and
    // `every` on an empty array would otherwise return true for every record.
    expect(matchesTokens("দেবদাস", [])).toBe(false);
  });
});

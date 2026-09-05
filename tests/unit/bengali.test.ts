import { describe, expect, it } from "vitest";
import { bengaliGenitive } from "@/lib/bengali";

/** The possessive suffix is picked from the last written character, so the cases
 *  worth pinning are one per ENDING, not one per word. The catalogue's own
 *  category and author names are in here as regression anchors: they are what
 *  the reported bug was about ("উপন্যাস বই" instead of "উপন্যাসের বই"), and a
 *  refactor that broke only those would otherwise pass.
 *
 *  WHY EVERY COMPARISON NORMALISES: Bengali writes ড় ঢ় য় either as one
 *  precomposed codepoint or as a base letter plus the nukta, and the two forms
 *  are indistinguishable on screen. Which one lands in this file depends on the
 *  editor that saved it, so `toBe` against a raw literal would pin the editor's
 *  behaviour rather than the function's. NFC is the arbiter for both sides — and
 *  NFC picks the two-codepoint form, since all three precomposed letters are
 *  Unicode composition exclusions. */

const eq = (actual: string, expected: string) =>
  expect(actual.normalize("NFC")).toBe(expected.normalize("NFC"));

describe("bengaliGenitive", () => {
  it("fuses the consonant form onto a consonant-final noun", () => {
    eq(bengaliGenitive("উপন্যাস"), "উপন্যাসের");
    eq(bengaliGenitive("গল্প"), "গল্পের");
    // Phonetically ends in a vowel, orthographically in a consonant cluster.
    eq(bengaliGenitive("শব্দ"), "শব্দের");
    eq(bengaliGenitive("সাহিত্য"), "সাহিত্যের");
    // য় is a consonant for this purpose, however it sounds and however it is
    // encoded.
    eq(bengaliGenitive("চট্টোপাধ্যায়"), "চট্টোপাধ্যায়ের");
    eq(bengaliGenitive("সময়"), "সময়ের");
  });

  it("adds a bare র after a vowel sign", () => {
    eq(bengaliGenitive("কবিতা"), "কবিতার");
    eq(bengaliGenitive("জীবনী"), "জীবনীর");
    eq(bengaliGenitive("গরু"), "গরুর");
    eq(bengaliGenitive("ঢাকা"), "ঢাকার");
  });
  it("supplies the glide where the suffix cannot attach directly", () => {
    // Word-final independent vowel: a diphthong, not a syllable of its own.
    eq(bengaliGenitive("বই"), "বইয়ের");
    eq(bengaliGenitive("ভাই"), "ভাইয়ের");
    eq(bengaliGenitive("যাচাই"), "যাচাইয়ের");
    // Monosyllable ending in a vowel sign.
    eq(bengaliGenitive("মা"), "মায়ের");
    eq(bengaliGenitive("চা"), "চায়ের");
    // A one-letter vowel word is a vowel, not a hiatus.
    eq(bengaliGenitive("ও"), "ওর");
  });

  it("restores the letter behind a word-final anusvara, khanda-ta or hasanta", () => {
    eq(bengaliGenitive("রং"), "রঙের");
    eq(bengaliGenitive("জগৎ"), "জগতের");
    eq(bengaliGenitive("মাতরম্"), "মাতরমের");
  });

  it("inflects the last word only, and leaves the rest alone", () => {
    eq(bengaliGenitive("প্রেমের উপন্যাস"), "প্রেমের উপন্যাসের");
    eq(bengaliGenitive("ঐতিহাসিক উপন্যাস"), "ঐতিহাসিক উপন্যাসের");
    eq(bengaliGenitive("ধ্রুপদী সাহিত্য"), "ধ্রুপদী সাহিত্যের");
    eq(bengaliGenitive("শরৎচন্দ্র চট্টোপাধ্যায়"), "শরৎচন্দ্র চট্টোপাধ্যায়ের");
    eq(bengaliGenitive("রবীন্দ্রনাথ ঠাকুর"), "রবীন্দ্রনাথ ঠাকুরের");
  });
  it("hyphenates onto anything it cannot fuse with", () => {
    eq(bengaliGenitive("PDF"), "PDF-এর");
    eq(bengaliGenitive("৫"), "৫-এর");
  });

  it("is safe on empty and whitespace-only input", () => {
    // Call sites inline this in template literals, so it must not throw or leave
    // a suffix floating on its own.
    expect(bengaliGenitive("")).toBe("");
    expect(bengaliGenitive("   ")).toBe("");
  });

  it("emits one normal form, whichever form it was given", () => {
    // A name spelled both ways has to produce byte-identical output, or a title
    // built from a Payload record and one built from a literal in the code could
    // differ while looking the same on screen.
    const TWO_CODEPOINTS = "য়"; // য + nukta, which is what NFC gives
    const ONE_CODEPOINT = "য়"; //       য় as a single precomposed letter
    const stem = "চট্টোপাধ্যা";
    // Guard the premise: without this the two calls below could be handed the
    // same string and the test would pass having compared nothing.
    expect(stem + TWO_CODEPOINTS).not.toBe(stem + ONE_CODEPOINT);
    expect(bengaliGenitive(stem + ONE_CODEPOINT)).toBe(bengaliGenitive(stem + TWO_CODEPOINTS));
    eq(bengaliGenitive(stem + ONE_CODEPOINT), "চট্টোপাধ্যায়ের");
  });
});

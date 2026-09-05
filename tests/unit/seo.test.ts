import { describe, expect, it } from "vitest";
import {
  BLOG_SUBJECT,
  HOME_TITLE,
  SITE_NAME,
  SITE_TAGLINE,
  authorDescription,
  authorHeading,
  authorTitle,
  blogIndexTitle,
  bookDescription,
  bookH1,
  bookTitle,
  categoryHeading,
  categoryTitle,
  chapterTitle,
  curatedListTitle,
  freePdfClause,
  isThinEntityPage,
  listingTitle,
  publisherDescription,
  publisherHeading,
  publisherTitle,
  readerIndexTitle,
  seriesHeading,
  seriesTitle,
} from "@/lib/seo";

/** SEO title and description formulas.
 *
 *  Two audit findings live here.
 *
 *  #12 — NO TITLE MAY CONTAIN THE BRAND. Route metadata passes the bare title
 *  and the layout's `title.template` appends "| বইদ্বীপ" exactly once. When a
 *  formula here also spelled the brand out, every affected tab read
 *  "… | বইদ্বীপ | বইদ্বীপ". A generic sweep over every formula is what keeps
 *  that from coming back through a new one.
 *
 *  The load-bearing content rule — never promise "PDF Download" on a page with
 *  no PDF — is the other half: it branches on pdfUrl, not on the tier alone, so
 *  a Tier A book whose file has not been uploaded yet does not advertise one. */

const author = { slug: "sarat-chandra-chattopadhyay", name: "শরৎচন্দ্র চট্টোপাধ্যায়" };

const freeBook = {
  title: "দেবদাস",
  authors: [author],
  rightsTier: "public-domain" as const,
  pdfUrl: "https://cdn.example.com/devdas.pdf",
  summary: "পার্বতী আর দেবদাসের গল্প।",
  pageCount: 120,
  pdfSizeMB: 2.4,
};

const copyrightBook = {
  ...freeBook,
  title: "নতুন উপন্যাস",
  rightsTier: "in-copyright" as const,
  pdfUrl: null,
};

/** Real dates, because the lifespan's POSITION in the description is what is
 *  under test and a placeholder year would still land in the right place. */
const authorFacts = {
  name: author.name,
  bookCount: 9,
  freePdfCount: 3,
  birthYear: 1876,
  deathYear: 1938,
};

const PUBLISHER = "আনন্দ পাবলিশার্স";

/** Every formula that produces a <title>, with a representative input. Listing
 *  formulas appear twice, once on each side of the free-PDF branch, because the
 *  two arms are different strings and a sweep that only saw one of them would
 *  miss a brand or a dangling separator in the other. */
const allTitles = (): string[] => [
  bookTitle(freeBook),
  bookTitle(copyrightBook),
  bookTitle({ ...freeBook, authors: [] }),
  authorTitle({ name: author.name, freePdfCount: 3 }),
  authorTitle({ name: author.name, freePdfCount: 0 }),
  publisherTitle({ name: PUBLISHER, freePdfCount: 2 }),
  publisherTitle({ name: PUBLISHER, freePdfCount: 0 }),
  categoryTitle("উপন্যাস", 42, 7),
  categoryTitle("উপন্যাস", 42, 0),
  categoryTitle("উপন্যাস", 0, 0),
  listingTitle("জনপ্রিয় বাংলা বই", 6, 6),
  listingTitle("জনপ্রিয় বাংলা বই", 6, 0),
  curatedListTitle("ধ্রুপদী বাংলা উপন্যাস", 4, 4),
  curatedListTitle("শীতের ১০টি বই", 10, 10),
  seriesTitle("ফেলুদা", 35),
  seriesTitle("ফেলুদা", 0),
  chapterTitle({ book: "দেবদাস", chapter: "প্রথম পরিচ্ছেদ" }),
  readerIndexTitle("দেবদাস", 12),
  blogIndexTitle(8),
  blogIndexTitle(0),
];

/** Every formula that produces an `<h1>`. HOME_TITLE is deliberately absent from
 *  allTitles and SITE_TAGLINE from here: they are the homepage pair, and
 *  HOME_TITLE is the one title the layout's template does not build, so it is the
 *  one title that must spell the brand out. Both are asserted on their own. */
const allHeadings = (): string[] => [
  bookH1(freeBook),
  bookH1(copyrightBook),
  authorHeading({ name: author.name, freePdfCount: 3 }),
  authorHeading({ name: author.name, freePdfCount: 0 }),
  publisherHeading({ name: PUBLISHER, freePdfCount: 2 }),
  publisherHeading({ name: PUBLISHER, freePdfCount: 0 }),
  categoryHeading("উপন্যাস"),
  seriesHeading("ফেলুদা"),
  BLOG_SUBJECT,
];

const allDescriptions = (): string[] => [
  bookDescription(freeBook),
  bookDescription(copyrightBook),
  authorDescription({ ...authorFacts, freePdfCount: 3 }),
  authorDescription({ ...authorFacts, freePdfCount: 0, birthYear: null, deathYear: null }),
  publisherDescription({ name: PUBLISHER, bookCount: 12, freePdfCount: 4 }),
  publisherDescription({ name: PUBLISHER, bookCount: 12, freePdfCount: 0 }),
];

describe("brand duplication (#12)", () => {
  it("no title formula spells out the site name", () => {
    for (const title of allTitles()) {
      expect(title).not.toContain(SITE_NAME);
    }
  });

  it("no heading formula spells it out either", () => {
    // An h1 is not passed through the template, so a brand here is not literally
    // a duplicate — it is the strongest on-page signal on the page spent on the
    // one word nobody who has not already found the site would search for.
    for (const heading of allHeadings()) {
      expect(heading).not.toContain(SITE_NAME);
    }
  });

  it("no title ends with a dangling separator for the template to append to", () => {
    for (const title of allTitles()) {
      expect(title.trimEnd()).toBe(title);
      expect(title.endsWith("|")).toBe(false);
      expect(title.endsWith("-")).toBe(false);
    }
  });
});

describe("bookTitle / bookH1", () => {
  it('promises "PDF Download" only when a downloadable file exists', () => {
    expect(bookTitle(freeBook)).toContain("PDF Download");
    expect(bookH1(freeBook)).toBe("দেবদাস PDF Download");

    // Tier A, but no file uploaded yet: no promise.
    const noFile = { ...freeBook, pdfUrl: null };
    expect(bookTitle(noFile)).not.toContain("PDF Download");
    expect(bookH1(noFile)).toBe("দেবদাস");

    // Tier C may deliver a PDF, so it may say so.
    expect(bookTitle({ ...freeBook, rightsTier: "permitted" as const })).toContain("PDF Download");

    // Tier D never, even if a pdfUrl somehow got attached.
    const copyrightWithFile = { ...copyrightBook, pdfUrl: "https://cdn.example.com/x.pdf" };
    expect(bookTitle(copyrightWithFile)).not.toContain("PDF Download");
    expect(bookH1(copyrightWithFile)).toBe("নতুন উপন্যাস");
  });

  it("puts the distinguishing token first", () => {
    // Bengali glyphs are wide and Google truncates on pixel width, so the book
    // title has to survive the cut.
    expect(bookTitle(freeBook).startsWith("দেবদাস")).toBe(true);
    expect(bookTitle(copyrightBook).startsWith("নতুন উপন্যাস")).toBe(true);
  });

  it("drops the byline cleanly when a book has no author", () => {
    const anon = { ...freeBook, authors: [] };
    expect(bookTitle(anon)).toBe("দেবদাস PDF Download");
    expect(bookTitle({ ...anon, pdfUrl: null })).toBe("দেবদাস | রিভিউ, সারসংক্ষেপ ও দাম");
  });
});

describe("bookDescription", () => {
  it("leads with the download and its facts when there is a file", () => {
    const desc = bookDescription(freeBook);
    expect(desc).toContain("ডাউনলোড");
    // Bengali numerals in prose (the machine-readable layer never does this).
    expect(desc).toContain("১২০ পৃষ্ঠা");
    expect(desc).toContain("২.৪ MB");
  });

  it("is review-led and mentions no download when there is no file", () => {
    const desc = bookDescription(copyrightBook);
    expect(desc).toContain("রিভিউ");
    expect(desc).not.toContain("ডাউনলোড");
    expect(desc).not.toContain("PDF");
  });

  it("stays inside the snippet budget", () => {
    const long = "অনেক লম্বা একটি সারসংক্ষেপ। ".repeat(40);
    for (const book of [freeBook, copyrightBook]) {
      expect(bookDescription({ ...book, summary: long }).length).toBeLessThanOrEqual(160);
    }
  });
});

/* ─────────────────── Listings, taxonomy and the reader ─────────────────── */

/** Bengali writes ড় ঢ় য় either precomposed or as base + nukta, and the two are
 *  indistinguishable on screen, so which one lands in this file depends on the
 *  editor that saved it. NFC on both sides makes the assertion about the
 *  function rather than about the bytes. See tests/unit/bengali.test.ts. */
const eq = (actual: string, expected: string) =>
  expect(actual.normalize("NFC")).toBe(expected.normalize("NFC"));

describe("listing titles", () => {
  it("inflects the genre and carries a checkable count", () => {
    // The reported case: /category/oitihashik-uponnash used to read
    // "ঐতিহাসিক উপন্যাস বই", two bare nouns with nothing joining them.
    eq(categoryTitle("ঐতিহাসিক উপন্যাস", 2, 2), "ঐতিহাসিক উপন্যাসের বই - ফ্রি PDF ও রিভিউ (২টি)");
    eq(categoryHeading("ঐতিহাসিক উপন্যাস"), "ঐতিহাসিক উপন্যাসের বই");
    eq(categoryHeading("উপন্যাস"), "উপন্যাসের বই");
  });

  it("opens the title with the same words as the h1", () => {
    // A <title> that renames the page it is on is a mismatch Google reports as
    // such, so the heading has to be the title's own opening substring.
    for (const name of ["উপন্যাস", "ধ্রুপদী সাহিত্য", "প্রেমের উপন্যাস"]) {
      const heading = categoryHeading(name).normalize("NFC");
      for (const free of [0, 3]) {
        expect(categoryTitle(name, 9, free).normalize("NFC").startsWith(heading)).toBe(true);
      }
    }
  });

  it("promises a free PDF only when the listing actually holds one", () => {
    // The load-bearing rule applied to listings: "ফ্রি PDF" over a grid of
    // buy-only cards is the doorway/thin-affiliate shape.
    expect(listingTitle("জনপ্রিয় বাংলা বই", 6, 0)).not.toContain("PDF");
    expect(listingTitle("জনপ্রিয় বাংলা বই", 6, 6)).toContain("ফ্রি PDF");
    eq(listingTitle("জনপ্রিয় বাংলা বই", 6, 6), "জনপ্রিয় বাংলা বই - ফ্রি PDF ও রিভিউ (৬টি)");
    eq(listingTitle("জনপ্রিয় বাংলা বই", 6, 0), "জনপ্রিয় বাংলা বই - রিভিউ, দাম ও কেনার লিংক (৬টি)");
  });

  it("makes no promise and quotes no count on an empty listing", () => {
    // "(০টি)" advertises emptiness; the bare subject is the honest title.
    eq(listingTitle("জনপ্রিয় বাংলা বই", 0, 0), "জনপ্রিয় বাংলা বই");
    eq(categoryTitle("উপন্যাস", 0, 0), "উপন্যাসের বই");
    expect(listingTitle("যেকোনো বিষয়", 0, 0)).not.toContain("০");
  });

  it("counts in Bengali numerals, like the page they are checked against", () => {
    expect(categoryTitle("উপন্যাস", 42, 7)).toContain("(৪২টি)");
    expect(seriesTitle("ফেলুদা", 35)).toContain("(৩৫টি)");
    expect(readerIndexTitle("দেবদাস", 12)).toContain("(১২টি)");
  });
});

describe("series and reader titles", () => {
  it("sells the reading order, not a download", () => {
    eq(seriesTitle("ফেলুদা", 35), "ফেলুদা সিরিজের সব বই ক্রমানুসারে (৩৫টি)");
    eq(seriesTitle("ফেলুদা", 0), "ফেলুদা সিরিজের সব বই ক্রমানুসারে");
  });

  it("leads the chapter title with the book", () => {
    // "প্রথম পরিচ্ছেদ" is shared by every Bengali novel ever printed and
    // matches no query on its own, so it cannot hold the first position.
    const title = chapterTitle({ book: "দেবদাস", chapter: "প্রথম পরিচ্ছেদ" });
    expect(title.startsWith("দেবদাস")).toBe(true);
    eq(title, "দেবদাস - প্রথম পরিচ্ছেদ | অনলাইনে পড়ুন");
  });

  it("keeps every chapter of one book distinct", () => {
    // The book leads, so the chapter is what makes each title unique. Titles
    // that collide are duplicate-content candidates.
    const titles = ["প্রথম পরিচ্ছেদ", "দ্বিতীয় পরিচ্ছেদ", "তৃতীয় পরিচ্ছেদ"].map((chapter) =>
      chapterTitle({ book: "দেবদাস", chapter }).normalize("NFC"),
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("names the reader index as a table of contents", () => {
    eq(readerIndexTitle("দেবদাস", 12), "দেবদাস অনলাইনে পড়ুন - সব পরিচ্ছেদ (১২টি)");
    // Distinct from any chapter under it, or the two compete for the same query.
    expect(readerIndexTitle("দেবদাস", 12)).not.toBe(
      chapterTitle({ book: "দেবদাস", chapter: "প্রথম পরিচ্ছেদ" }),
    );
  });
});

describe("isThinEntityPage", () => {
  it("noindexes a page with nothing on it yet", () => {
    expect(isThinEntityPage(1, 0)).toBe(true);
    expect(isThinEntityPage(0, 99)).toBe(true);
  });

  it("indexes as soon as either half is real", () => {
    // Two books is enough on its own, and so is a written bio.
    expect(isThinEntityPage(2, 0)).toBe(false);
    expect(isThinEntityPage(1, 100)).toBe(false);
  });
});

/* ─────────────────────────── The homepage pair ─────────────────────────── */

describe("HOME_TITLE and SITE_TAGLINE", () => {
  it("spells the brand out exactly once, and last", () => {
    // `title.default` is emitted verbatim — Next applies "%s | বইদ্বীপ" to child
    // segments only — so this is the ONE title that has to carry the brand
    // itself, and the only one exempt from the sweep above.
    expect(HOME_TITLE.endsWith(`| ${SITE_NAME}`)).toBe(true);
    expect(HOME_TITLE.split(SITE_NAME).length - 1).toBe(1);
    expect(HOME_TITLE.startsWith(SITE_NAME)).toBe(false);
  });

  it("opens with the words a reader would type", () => {
    // It used to read "বইদ্বীপ — বাংলা বইয়ের দ্বীপ — ফ্রি PDF, রিভিউ ও অনলাইনে
    // পড়া": the brand, then the brand restated (the name already means "book
    // island"), so every query-bearing token sat past the truncation point.
    for (const token of ["বাংলা", "PDF", "রিভিউ"]) {
      expect(HOME_TITLE).toContain(token);
      expect(SITE_TAGLINE).toContain(token);
    }
  });

  it("does not restate the brand in the h1", () => {
    // SITE_TAGLINE is the homepage h1 and the RSS channel description. "দ্বীপ"
    // rather than the whole brand, because the restatement it used to open with
    // was the bare noun, not the name.
    expect(SITE_TAGLINE).not.toContain(SITE_NAME);
    expect(SITE_TAGLINE).not.toContain("দ্বীপ");
  });

  it("keeps the title inside the width the SERP preview warns at", () => {
    // Bengali glyphs are wide and Google truncates on pixel width, so the h1 gets
    // the long form and the title the short one.
    expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
    expect(HOME_TITLE.length).toBeLessThan(SITE_TAGLINE.length);
  });
});

/* ──────────────────── Sweeps over every generated string ──────────────────── */

/** AGENTS.md: no em-dashes in public-facing strings. These are the most public
 *  strings the site has — a title and a description are what Google renders — and
 *  an em-dash had reached four of these formulas before the rule was swept for.
 *  Comments and the repo docs are exempt, which is why this asserts on the
 *  produced strings rather than on the file. The en dash in an author's lifespan
 *  is a different character and stays. */
describe("punctuation and length, everywhere", () => {
  it("no formula emits an em-dash", () => {
    const everything = [
      ...allTitles(),
      ...allHeadings(),
      ...allDescriptions(),
      HOME_TITLE,
      SITE_TAGLINE,
    ];
    for (const text of everything) {
      expect(text).not.toContain("—");
    }
  });

  it("every description fits the snippet budget", () => {
    for (const desc of allDescriptions()) {
      expect(desc.length).toBeLessThanOrEqual(160);
    }
  });

  it("nothing comes back empty or padded", () => {
    for (const text of [...allTitles(), ...allHeadings(), ...allDescriptions()]) {
      expect(text.length).toBeGreaterThan(0);
      expect(text).toBe(text.trim());
    }
  });
});

/** Every (h1, title) pair the site can produce, arm by arm.
 *
 *  THE INVARIANT: the h1 is the title's opening words. A <title> that renames the
 *  page under it is a mismatch Google reports as one, and the two strings drifting
 *  apart is what happens when a page hand-writes its own heading — which is why
 *  every heading formula lives in lib/seo.ts next to the title it belongs to.
 *  publisherHeading was the one violation: it returned an unbranched "<নামের> বই"
 *  while its title's no-PDF arm said "<নামের> সকল বই - তালিকা ও দাম". */
const headingTitlePairs = (): Array<[string, string]> => [
  [bookH1(freeBook), bookTitle(freeBook)],
  [bookH1(copyrightBook), bookTitle(copyrightBook)],
  ...[3, 0].map(
    (n): [string, string] => [
      authorHeading({ name: author.name, freePdfCount: n }),
      authorTitle({ name: author.name, freePdfCount: n }),
    ],
  ),
  ...[2, 0].map(
    (n): [string, string] => [
      publisherHeading({ name: PUBLISHER, freePdfCount: n }),
      publisherTitle({ name: PUBLISHER, freePdfCount: n }),
    ],
  ),
  [categoryHeading("উপন্যাস"), categoryTitle("উপন্যাস", 9, 3)],
  [categoryHeading("উপন্যাস"), categoryTitle("উপন্যাস", 9, 0)],
  [seriesHeading("ফেলুদা"), seriesTitle("ফেলুদা", 35)],
  [BLOG_SUBJECT, blogIndexTitle(8)],
  [BLOG_SUBJECT, blogIndexTitle(0)],
];

describe("heading agrees with title", () => {
  it("every h1 is the opening words of its own <title>", () => {
    for (const [heading, title] of headingTitlePairs()) {
      expect(title.normalize("NFC").startsWith(heading.normalize("NFC"))).toBe(true);
    }
  });

  it("never promises a download in one and not the other", () => {
    // The load-bearing rule is only kept if both strings branch on the same fact.
    for (const [heading, title] of headingTitlePairs()) {
      expect(heading.includes("PDF Download")).toBe(title.includes("PDF Download"));
    }
  });
});

/* ─────────────────── Author, publisher, blog and curated ─────────────────── */

describe("author and publisher hubs", () => {
  it("inflects the name onto the noun it owns", () => {
    // "শরৎচন্দ্র চট্টোপাধ্যায় এর বই" leaves the suffix standing as a loose word.
    // চট্টোপাধ্যায় ends in য় — য plus a nukta, a combining mark rather than a
    // letter — and classifying on the mark is what once produced "-এর" here.
    eq(
      authorHeading({ name: author.name, freePdfCount: 3 }),
      "শরৎচন্দ্র চট্টোপাধ্যায়ের বই PDF Download",
    );
    eq(authorHeading({ name: author.name, freePdfCount: 0 }), "শরৎচন্দ্র চট্টোপাধ্যায়ের সকল বই");
    eq(publisherHeading({ name: PUBLISHER, freePdfCount: 4 }), "আনন্দ পাবলিশার্সের বই PDF Download");
    eq(publisherHeading({ name: PUBLISHER, freePdfCount: 0 }), "আনন্দ পাবলিশার্সের সকল বই");
  });

  it("puts the lifespan with the name, not at the end of the sentence", () => {
    const desc = authorDescription({ ...authorFacts, freePdfCount: 3 });
    expect(desc).toContain("১৮৭৬–১৯৩৮");
    // It used to trail the whole sentence, "…কেনার লিংক, বইদ্বীপে (১৮৬১–১৯৪১)।",
    // which reads as though বইদ্বীপ had the dates. It is also the first thing
    // that separates two authors of the same name, so it belongs in the part of
    // the snippet Google is least likely to cut.
    expect(desc.indexOf("১৮৭৬")).toBeLessThan(desc.indexOf("রিভিউ"));
  });

  it("counts a free PDF in a description only when there is one", () => {
    expect(authorDescription({ ...authorFacts, freePdfCount: 3 })).toContain("৩টি ফ্রি PDF");
    expect(authorDescription({ ...authorFacts, freePdfCount: 0 })).not.toContain("ফ্রি PDF");
    const pub = (freePdfCount: number) =>
      publisherDescription({ name: PUBLISHER, bookCount: 12, freePdfCount });
    expect(pub(4)).toContain("৪টি ফ্রি PDF");
    expect(pub(0)).not.toContain("ফ্রি PDF");
  });

  it("survives an author with no recorded dates", () => {
    const desc = authorDescription({ ...authorFacts, birthYear: null, deathYear: null });
    expect(desc).not.toContain("(");
    expect(desc).toContain("৯টি বইয়ের তালিকা");
  });
});

describe("freePdfClause", () => {
  it("disappears when the listing holds no free PDF", () => {
    expect(freePdfClause(0)).toBe("");
  });

  it("carries its own trailing separator", () => {
    // Six hub pages wrote this clause by hand. The trailing ", " is what lets one
    // template literal serve both arms: interpolating "" drops the clause cleanly.
    eq(freePdfClause(3), "৩টি ফ্রি PDF ডাউনলোড, ");
    expect(freePdfClause(3).endsWith(", ")).toBe(true);
  });
});

describe("curatedListTitle", () => {
  it("gives an editor's plain title the listing treatment", () => {
    eq(
      curatedListTitle("ধ্রুপদী বাংলা উপন্যাস", 4, 4),
      "ধ্রুপদী বাংলা উপন্যাস - ফ্রি PDF ও রিভিউ (৪টি)",
    );
    eq(
      curatedListTitle("ধ্রুপদী বাংলা উপন্যাস", 4, 0),
      "ধ্রুপদী বাংলা উপন্যাস - রিভিউ, দাম ও কেনার লিংক (৪টি)",
    );
  });

  it("leaves a title that already carries a number alone", () => {
    // Otherwise "শীতের ১০টি বই" becomes "শীতের ১০টি বই - ফ্রি PDF ও রিভিউ (১০টি)":
    // the count stated twice, reading like a template that leaked onto the page.
    eq(curatedListTitle("শীতের ১০টি বই", 10, 10), "শীতের ১০টি বই");
    // ASCII digits too — an editor typing into a Bengali field still reaches for
    // the keyboard's own digits half the time.
    eq(curatedListTitle("Top 10 বাংলা বই", 10, 10), "Top 10 বাংলা বই");
  });

  it("drops the promise, then the count, as the editor's title gets longer", () => {
    // The real seeded list. With the full treatment this measured 777px against
    // the ~600px Google renders a desktop title in, and was cut mid-promise at
    // "ফ্রি PDF …" — so the count the suffix exists to carry never arrived.
    const long = "ক্লাসিক বাংলা উপন্যাস: যেগুলো একবার হলেও পড়া উচিত";
    eq(curatedListTitle(long, 4, 4), long);

    // The middle arm: too long for the promise, short enough for the count.
    const medium = "যে বইগুলো ছাড়া বাংলা সাহিত্য অসম্পূর্ণ";
    expect(medium.length).toBeGreaterThan(28);
    expect(medium.length).toBeLessThanOrEqual(44);
    eq(curatedListTitle(medium, 6, 6), `${medium} (৬টি)`);
  });

  it("adds nothing to a list with no books in it", () => {
    // A count of zero is not a distinguishing token, it is an admission.
    eq(curatedListTitle("ধ্রুপদী বাংলা উপন্যাস", 0, 0), "ধ্রুপদী বাংলা উপন্যাস");
  });

  it("states the count at most once, whichever arm it takes", () => {
    for (const title of [
      curatedListTitle("শীতের ১০টি বই", 10, 10),
      curatedListTitle("ধ্রুপদী বাংলা উপন্যাস", 4, 4),
      curatedListTitle("যে বইগুলো ছাড়া বাংলা সাহিত্য অসম্পূর্ণ", 6, 6),
    ]) {
      expect((title.match(/[০-৯0-9]+/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("blogIndexTitle", () => {
  it("names what the writing is about, not the furniture", () => {
    // The whole title used to be "ব্লগ": one word, the most generic noun on the
    // internet, with no search volume of its own and identical to the string a
    // thousand other Bengali sites emit.
    expect(blogIndexTitle(8)).not.toBe("ব্লগ");
    expect(blogIndexTitle(8).startsWith(BLOG_SUBJECT)).toBe(true);
    eq(blogIndexTitle(8), "বই নিয়ে ব্লগ - বই আলোচনা ও পাঠ-পরামর্শ (৮টি লেখা)");
  });

  it("counts essays, not books", () => {
    // listingTitle's bare "(৮টি)" reads against an implied "বই", and a post is
    // not a book, so this one spells its unit out.
    expect(blogIndexTitle(8)).toContain("৮টি লেখা");
  });

  it("quotes no count before the first post is written", () => {
    eq(blogIndexTitle(0), "বই নিয়ে ব্লগ - বই আলোচনা ও পাঠ-পরামর্শ");
    expect(blogIndexTitle(0)).not.toContain("০");
  });

  it("promises only the two things the blog actually holds", () => {
    // It used to advertise "লেখক পরিচিতি" as well, which pushed the line to
    // 674px — cut at "(২টি লে…" — and named a kind of post the blog does not
    // have. /author/<slug> is where author profiles live.
    expect(blogIndexTitle(8)).not.toContain("লেখক পরিচিতি");
  });

  it("still fits the SERP at three digits of posts", () => {
    // The count is the only part that grows. 558px measured at 125 posts, so
    // this does not silently re-break as the blog fills up.
    expect(blogIndexTitle(125).length).toBeLessThanOrEqual(52);
  });
});

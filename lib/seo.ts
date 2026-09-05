/** Tier-dependent SEO title and description generation.
 *
 *  ⚠ THIS FILE MUST STAY IMPORTABLE FROM THE CLIENT. The admin's live SERP
 *  preview (components/payload/seo/SerpPreview) does not re-implement these
 *  formulas — it imports `bookTitle` and `bookDescription` and calls them, so
 *  an editor sees exactly what `generateMetadata` will emit and there is no
 *  second copy to fall out of step. That only holds while this module's imports
 *  stay dependency-free (currently ./numerals, ./bengali, ./types). Add a
 *  server-only import here and the admin build breaks — loudly, which is the
 *  point. The one thing SerpPreview does mirror by hand is the layout's
 *  `title.template` ("%s | বইদ্বীপ"), one string.
 *
 *  THE LOAD-BEARING RULE (plan §2): never put "PDF Download" in the <title>
 *  or <h1> of a page that has no PDF. That is the definition of a doorway
 *  page, it is what thin-affiliate detection looks for, and it burns the
 *  trust that makes someone click a buy button. So every title here branches
 *  on WHAT THE PAGE ACTUALLY CONTAINS — a file, or a count of files — not on
 *  an editor's wording.
 *
 *  Titles run long in Bengali; Google truncates around 580px (not a character
 *  count) and Bengali glyphs are wide. The distinguishing token goes FIRST —
 *  the book title, never the site name. The site name lives in the layout's
 *  title template suffix and is dropped by Google when it does not fit.
 *
 *  NUMBERS IN META TEXT stay Bengali for descriptions (they are prose) but
 *  the machine-readable layer (JSON-LD) never goes through toBengaliNumerals
 *  — see lib/numerals.ts.
 *
 *  POSSESSIVES GO THROUGH lib/bengali.ts. Anywhere a name owns a noun — a
 *  genre owning "বই", an author owning "সকল বই" — the name has to be inflected
 *  (উপন্যাস → উপন্যাসের). Writing the suffix as a separate word, which this
 *  file used to do, is the Bengali equivalent of "Tagore 's books". */

import { toBengaliNumerals } from "./numerals";
import { bengaliGenitive } from "./bengali";
import { tierAllowsDelivery } from "./types";
import type { AuthorContent, BookContent, PublisherContent } from "./types";

export const SITE_NAME = "বইদ্বীপ";

/** The homepage `<h1>` and the RSS channel description: what the site IS, in
 *  the words someone would actually type.
 *
 *  IT USED TO OPEN WITH "বাংলা বইয়ের দ্বীপ", which is the brand restated — the
 *  name already means "book island" — and matches no query anyone runs. The
 *  homepage h1 is the single strongest on-page signal on the site, and it was
 *  spending itself on a phrase whose only searcher is someone who already knows
 *  the site. The three things a reader comes here for lead instead. */
export const SITE_TAGLINE = "বাংলা বইয়ের ফ্রি PDF ডাউনলোড, রিভিউ ও অনলাইনে পড়া";

/** The homepage `<title>` — the ONE title on this site the layout's template
 *  does not build. `title.default` is emitted verbatim (Next applies `%s |
 *  বইদ্বীপ` only to child segments), so the brand has to be spelled out here.
 *
 *  DELIBERATELY SHORTER THAN THE TAGLINE. An h1 has a whole line of its own; a
 *  title has ~580px. This one used to read
 *  `বইদ্বীপ — বাংলা বইয়ের দ্বীপ — ফ্রি PDF, রিভিউ ও অনলাইনে পড়া`: the brand,
 *  then the brand again in other words, so every token a searcher was looking
 *  for sat past the truncation point. Brand LAST, for the same reason every
 *  other title on the site puts it last. */
export const HOME_TITLE = `বাংলা বইয়ের ফ্রি PDF ও রিভিউ | ${SITE_NAME}`;

function authorNames(book: Pick<BookContent, "authors">): string {
  return book.authors.map((a) => a.name).join(", ");
}

/* ─────────────────────────── Book ─────────────────────────── */

/** Tier A/B/C: `<title> PDF Download - <author>`
 *  Tier D:     `<title> বইয়ের দাম, রিভিউ ও সারসংক্ষেপ - <author>`
 *
 *  Branches on pdfUrl presence, not on the tier alone: a Tier A book whose
 *  PDF has not been uploaded yet must not promise a download either.
 *
 *  WHY THE TIER D KEYWORDS COME BEFORE THE BYLINE. This used to read
 *  `<title> - <author> | রিভিউ, সারসংক্ষেপ ও দাম`, which spends the first ~40
 *  characters on two proper nouns and pushes every phrase a searcher actually
 *  typed past the truncation point. A title for a book we cannot deliver has
 *  exactly one job — say what the page does offer — so "বইয়ের দাম" (the
 *  highest-intent query of the three) now sits directly after the title, and
 *  the byline takes the tail where being clipped costs nothing: a reader who
 *  searched the author's name has already matched it in the h1 and the URL.
 *
 *  It is longer than the ~600px Google renders, and that is accepted: what
 *  survives truncation is the part worth keeping. */
export function bookTitle(
  book: Pick<BookContent, "title" | "authors" | "rightsTier" | "pdfUrl">,
): string {
  const author = authorNames(book);
  if (tierAllowsDelivery(book.rightsTier) && book.pdfUrl) {
    return author ? `${book.title} PDF Download - ${author}` : `${book.title} PDF Download`;
  }
  const offer = `${book.title} বইয়ের দাম, রিভিউ ও সারসংক্ষেপ`;
  return author ? `${offer} - ${author}` : offer;
}

/** The h1 follows the same branch: "<title> PDF Download" vs bare title. */
export function bookH1(
  book: Pick<BookContent, "title" | "rightsTier" | "pdfUrl">,
): string {
  return tierAllowsDelivery(book.rightsTier) && book.pdfUrl
    ? `${book.title} PDF Download`
    : book.title;
}

/** ~150 chars. Download pages mention pages and size (the two facts a
 *  searcher scans a snippet for); Tier D descriptions are review-led. */
export function bookDescription(
  book: Pick<
    BookContent,
    "title" | "authors" | "rightsTier" | "pdfUrl" | "summary" | "pageCount" | "pdfSizeMB"
  >,
): string {
  const author = authorNames(book);
  if (tierAllowsDelivery(book.rightsTier) && book.pdfUrl) {
    const facts: string[] = [];
    if (book.pageCount) facts.push(`${toBengaliNumerals(book.pageCount)} পৃষ্ঠা`);
    if (book.pdfSizeMB) facts.push(`${toBengaliNumerals(book.pdfSizeMB)} MB`);
    const factStr = facts.length ? ` (${facts.join(", ")})` : "";
    const base = `${author ? `${bengaliGenitive(author)} ` : ""}${book.title} বইটির সম্পূর্ণ PDF ফ্রি ডাউনলোড করুন${factStr} অথবা অনলাইনে পড়ুন।`;
    return truncate(book.summary ? `${base} ${book.summary}` : base, 160);
  }
  const base = `${book.title}${author ? ` - ${author}` : ""}: রিভিউ, সারসংক্ষেপ, রেটিং ও দাম।`;
  return truncate(book.summary ? `${base} ${book.summary}` : base, 160);
}

/* ─────────────────────────── Author / Publisher ─────────────────────────── */

/** Mixed-tier pages: the title is generated from what the page contains.
 *  ≥1 free PDF → "<নামের> বই PDF Download - সব বইয়ের তালিকা"
 *  none        → "<নামের> সকল বই - তালিকা, রিভিউ ও দাম" */
export function authorTitle(
  author: Pick<AuthorContent, "name" | "freePdfCount">,
): string {
  const owner = bengaliGenitive(author.name);
  return author.freePdfCount > 0
    ? `${owner} বই PDF Download - সব বইয়ের তালিকা`
    : `${owner} সকল বই - তালিকা, রিভিউ ও দাম`;
}

/** The author page's own h1, without the SERP suffix.
 *
 *  IT LIVES HERE, next to authorTitle, because the two must branch together.
 *  The page used to build this string by hand — `${author.name} এর বই PDF
 *  Download` — which meant the h1 and the <title> could disagree about whether
 *  the page offers a PDF (two copies of one rule), and it spelled the possessive
 *  as a loose word, the Bengali equivalent of "Tagore 's books". */
export function authorHeading(
  author: Pick<AuthorContent, "name" | "freePdfCount">,
): string {
  const owner = bengaliGenitive(author.name);
  return author.freePdfCount > 0 ? `${owner} বই PDF Download` : `${owner} সকল বই`;
}

/** ~150 chars. The count leads, because it is the fact the page can prove. */
export function authorDescription(
  author: Pick<
    AuthorContent,
    "name" | "bookCount" | "freePdfCount" | "birthYear" | "deathYear"
  >,
): string {
  const years =
    author.birthYear && author.deathYear
      ? ` (${toBengaliNumerals(author.birthYear)}–${toBengaliNumerals(author.deathYear)})`
      : "";
  const parts: string[] = [
    `${bengaliGenitive(author.name)}${years} ${toBengaliNumerals(author.bookCount)}টি বইয়ের তালিকা`,
  ];
  if (author.freePdfCount > 0) {
    parts.push(`${toBengaliNumerals(author.freePdfCount)}টি ফ্রি PDF`);
  }
  parts.push("রিভিউ ও কেনার লিংক");
  /* The lifespan sits with the NAME, not at the end. It used to trail the whole
     sentence after an em-dash — "…কেনার লিংক — বইদ্বীপে (১৮৬১–১৯৪১)।" — which
     read as though বইদ্বীপ had the dates. It is also the first thing that
     disambiguates two authors of the same name, so it belongs in the part of the
     snippet Google is least likely to truncate. */
  return truncate(`${parts.join(", ")} বইদ্বীপে।`, 160);
}

export function publisherTitle(
  publisher: Pick<PublisherContent, "name" | "freePdfCount">,
): string {
  const owner = bengaliGenitive(publisher.name);
  return publisher.freePdfCount > 0
    ? `${owner} বই PDF Download`
    : `${owner} সকল বই - তালিকা ও দাম`;
}

/** The publisher page's own h1.
 *
 *  IT BRANCHES WITH publisherTitle, arm for arm, which is the whole reason it
 *  takes freePdfCount. It used to return a single unbranched `<নামের> বই` while
 *  the title said `<নামের> সকল বই - তালিকা ও দাম` on the no-PDF arm, so the h1
 *  named something narrower than the <title> above it — the one heading on the
 *  site that was not its title's opening words. (It also used to be hand-written
 *  at the call site as `${publisher.name} এর বই`, the loose possessive
 *  authorHeading fixes.) */
export function publisherHeading(
  publisher: Pick<PublisherContent, "name" | "freePdfCount">,
): string {
  const owner = bengaliGenitive(publisher.name);
  return publisher.freePdfCount > 0 ? `${owner} বই PDF Download` : `${owner} সকল বই`;
}

export function publisherDescription(
  publisher: Pick<PublisherContent, "name" | "bookCount" | "freePdfCount">,
): string {
  const free =
    publisher.freePdfCount > 0
      ? `, ${toBengaliNumerals(publisher.freePdfCount)}টি ফ্রি PDF`
      : "";
  return truncate(
    `${publisher.name} প্রকাশিত ${toBengaliNumerals(publisher.bookCount)}টি বই${free}, রিভিউ, দাম ও কেনার লিংক বইদ্বীপে।`,
    160,
  );
}

/* ─────────────────────────── Taxonomy / reader ─────────────────────────── */

/** The shared shape for every page that is a LIST of books — a genre, /popular,
 *  /new, a series, a curated তালিকা:
 *
 *      <subject> - ফ্রি PDF ও রিভিউ (<n>টি)
 *
 *  WHY THE COUNT IS IN THE TITLE: it is the one token that distinguishes this
 *  listing from the dozen other sites carrying the same genre name, it is
 *  checkable against the page (so it is not a claim Google has to take on
 *  trust), and it gives a searcher scanning a result page a reason to prefer
 *  this one. It also dates itself honestly: the number is regenerated on every
 *  build from the rows actually rendered.
 *
 *  WHY IT BRANCHES ON freePdfCount: this is the load-bearing rule at the top of
 *  the file applied to listings. A genre holding five in-copyright books has no
 *  free PDF to offer, and a title that says "ফ্রি PDF" over a grid of buy-only
 *  cards is precisely the doorway/thin-affiliate pattern. Such a page gets the
 *  review-and-price wording instead, and an empty listing gets no promise and no
 *  count at all. */
export function listingTitle(subject: string, bookCount: number, freePdfCount: number): string {
  if (bookCount < 1) return subject;
  const count = `(${toBengaliNumerals(bookCount)}টি)`;
  return freePdfCount > 0
    ? `${subject} - ফ্রি PDF ও রিভিউ ${count}`
    : `${subject} - রিভিউ, দাম ও কেনার লিংক ${count}`;
}

/** Genre: `<নামের> বই - ফ্রি PDF ও রিভিউ (<n>টি)`.
 *
 *  The name is inflected, because "উপন্যাস বই" is two nouns with nothing
 *  joining them; the genre has to own the noun (উপন্যাসের বই). */
export function categoryTitle(name: string, bookCount: number, freePdfCount: number): string {
  return listingTitle(`${bengaliGenitive(name)} বই`, bookCount, freePdfCount);
}

/** The free-PDF clause for a listing's DESCRIPTION, or an empty string.
 *
 *  A trailing ", " is included so a call site drops the clause cleanly by
 *  interpolating nothing.
 *
 *  ONE FUNCTION for the same reason listingTitle branches: a snippet is read
 *  before the page, so a description offering "ফ্রি PDF" above a buy-only grid
 *  misleads a searcher before they can see otherwise, and that is the
 *  thin-affiliate pattern the whole file is arranged to avoid. Six hub pages
 *  wrote this clause by hand, and a hand-written promise is one nobody rechecks
 *  when a genre's last public-domain book is reclassified. */
export function freePdfClause(freePdfCount: number): string {
  return freePdfCount > 0 ? `${toBengaliNumerals(freePdfCount)}টি ফ্রি PDF ডাউনলোড, ` : "";
}

/** Curated তালিকা: the editor's own title, given the listing treatment — but
 *  only as much of it as will actually be READ.
 *
 *  A তালিকা is the one listing on this site whose subject is hand-written, so it
 *  is the one place a 50-character sentence can arrive where the generated hubs
 *  produce twelve. Two things therefore have to be suppressed, and both are
 *  suppressed for the same reason: a template fragment that lands past Google's
 *  truncation point is not a title, it is noise that eats the editor's sentence.
 *
 *  1. AN EDITOR WHO ALREADY WROTE A NUMBER keeps it. Editors naturally write
 *     "শীতের ১০টি বই", and pushing that through listingTitle yields
 *     "শীতের ১০টি বই - ফ্রি PDF ও রিভিউ (১০টি)": the count stated twice, reading
 *     like a template that leaked onto the page. Matches Bengali digits AND ASCII
 *     ones, because an editor typing a Bengali title still reaches for the
 *     keyboard's own digits half the time.
 *
 *  2. AN EDITOR WHO ALREADY FILLED THE LINE keeps that too. "ক্লাসিক বাংলা
 *     উপন্যাস: যেগুলো একবার হলেও পড়া উচিত" is 50 characters, and the full
 *     treatment made it 777px against the ~600px Google renders a desktop result
 *     title in: cut at "ফ্রি PDF …", so the reader saw a severed promise and
 *     never reached the count the suffix exists to carry. The subject alone is
 *     562px with the layout's brand — a complete, readable line. So the widest
 *     form that fits wins, and there are three: promise + count, count alone,
 *     bare.
 *
 *  THE BUDGET IS IN CHARACTERS AND THAT IS A PROXY. Truncation is by pixel
 *  width, and Bengali does not convert cleanly: measured at 20px Arial with the
 *  system Bengali fallback, real titles on this site run 8.4–10.5px per
 *  character depending on how many conjuncts stack. The thresholds below are set
 *  from the worst of that range with margin, so a title near a boundary lands on
 *  the safe side rather than the exact side. To re-derive them, measure a
 *  candidate with canvas measureText at that font against a 600px budget; the
 *  suffix costs ~215px, " | বইদ্বীপ" ~76px, and " (nটি)" ~49px.
 *
 *  Only this function needs the budget. Every other title here is built from
 *  short generated subjects — the widest genre page measures 510px — so adding
 *  the same guard to listingTitle would be machinery for a case that cannot
 *  occur. */

/** Subject length that still leaves room for "- ফ্রি PDF ও রিভিউ (nটি)". */
const BUDGET_WITH_SUFFIX = 28;
/** Subject length that still leaves room for " (nটি)" alone. */
const BUDGET_WITH_COUNT = 44;

export function curatedListTitle(
  title: string,
  bookCount: number,
  freePdfCount: number,
): string {
  if (/[০-৯0-9]/.test(title) || bookCount < 1) return title;
  if (title.length <= BUDGET_WITH_SUFFIX) {
    return listingTitle(title, bookCount, freePdfCount);
  }
  if (title.length <= BUDGET_WITH_COUNT) {
    return `${title} (${toBengaliNumerals(bookCount)}টি)`;
  }
  return title;
}

/** The genre's own h1 and JSON-LD name, without the SERP suffix. */
export function categoryHeading(name: string): string {
  return `${bengaliGenitive(name)} বই`;
}

/** Series: `<name> সিরিজের সব বই ক্রমানুসারে (<n>টি)`
 *
 *  Not listingTitle: what a reader wants from a series page is the ORDER, not a
 *  free-PDF promise, so "ক্রমানুসারে" earns the position that wording would
 *  take. The count still comes along, for the same reason it does everywhere
 *  else. */
export function seriesTitle(name: string, bookCount: number): string {
  return bookCount > 0
    ? `${name} সিরিজের সব বই ক্রমানুসারে (${toBengaliNumerals(bookCount)}টি)`
    : `${name} সিরিজের সব বই ক্রমানুসারে`;
}

/** The series page's own h1: the title's subject without the ordering promise
 *  or the count. It used to read `${name} সিরিজ` while the title said
 *  `${name} সিরিজের সব বই ক্রমানুসারে`, so the page's strongest on-page signal
 *  named something narrower than the page. */
export function seriesHeading(name: string): string {
  return `${name} সিরিজের সব বই`;
}

/** Reader chapter: `<book> - <chapter> | অনলাইনে পড়ুন`
 *
 *  THE BOOK LEADS. A chapter name like "প্রথম পরিচ্ছেদ" is shared by every
 *  Bengali novel ever printed and matches no query on its own, so putting it
 *  first spent the most valuable position in the title on the least
 *  distinguishing token — and made the SERP entry read as a chapter that
 *  happens to belong to a book rather than a book you can read here. The book
 *  title is the token with search volume; the chapter is what keeps each of
 *  these titles unique.
 *
 *  THE AUTHOR IS DELIBERATELY GONE from this one. Four segments plus the
 *  template's "| বইদ্বীপ" overran the ~580px Google renders, and the author was
 *  the segment a reader least needed on a page they reached from the book. It
 *  is still in the chapter's JSON-LD and one click up on the book page.
 *
 *  TAKES AN OBJECT, not two positional strings: both fields are strings, so a
 *  swapped call site would have typechecked and quietly shipped the old order. */
export function chapterTitle({ book, chapter }: { book: string; chapter: string }): string {
  return `${book} - ${chapter} | অনলাইনে পড়ুন`;
}

/** Reader index (`/book/<slug>/read`): `<book> অনলাইনে পড়ুন - সব পরিচ্ছেদ (<n>টি)`
 *
 *  This URL used to 404 while every chapter under it resolved, which is the
 *  worst possible shape for a hierarchy: readers who trimmed a chapter off the
 *  address to find the contents hit a dead end, and Google saw a set of chapter
 *  pages hanging off a parent that returned 404. The page it names now is a
 *  table of contents, so the title says so and carries the chapter count as its
 *  distinguishing token. */
export function readerIndexTitle(book: string, chapterCount: number): string {
  return `${book} অনলাইনে পড়ুন - সব পরিচ্ছেদ (${toBengaliNumerals(chapterCount)}টি)`;
}

/* ─────────────────────────── Blog ─────────────────────────── */

/** The blog index's subject, shared by its `<title>` and its `<h1>`.
 *
 *  NOT "ব্লগ". That was the whole title, and a one-word title made of the most
 *  generic noun on the internet distinguishes this page from nothing — it has no
 *  search volume of its own, tells a searcher nothing about what the posts are
 *  about, and is the same string a thousand other Bengali sites emit. The subject
 *  has to name what the writing is ABOUT, because that is what someone types. */
export const BLOG_SUBJECT = "বই নিয়ে ব্লগ";

/** Blog index: `বই নিয়ে ব্লগ - বই আলোচনা ও পাঠ-পরামর্শ (<n>টি লেখা)`
 *
 *  Not listingTitle: a blog is a listing, but of ESSAYS, and listingTitle's
 *  count reads "(৮টি)" against an implied "বই". A post is not a book, so the
 *  unit is spelled out. The count comes along for the reason it does on every
 *  other listing — it is checkable, it dates itself, and it is the token that
 *  separates a blog with forty pieces from one with two.
 *
 *  TWO SUBJECT NOUNS, NOT THREE. This used to read "পাঠ-পরামর্শ, লেখক পরিচিতি ও
 *  বই আলোচনা", which measured 674px against the ~600px Google renders — it was
 *  cut at "(২টি লে…", so the count this function exists to carry never reached
 *  the reader, and the parenthesis broke mid-word. Dropping "লেখক পরিচিতি" is
 *  the right one to lose twice over: /author/<slug> is the page that actually
 *  holds author profiles, and a blog with no author-profile post in it was
 *  advertising content it does not have, which is the same rule the rest of this
 *  file follows about promising PDFs. At 533px it now fits with room to spare —
 *  558px at three digits of posts, so growth does not silently re-break it.
 *  "বই আলোচনা" leads because it is the higher-volume phrase of the two and this
 *  file's rule is that the distinguishing token goes first. */
export function blogIndexTitle(postCount: number): string {
  const subject = `${BLOG_SUBJECT} - বই আলোচনা ও পাঠ-পরামর্শ`;
  return postCount > 0
    ? `${subject} (${toBengaliNumerals(postCount)}টি লেখা)`
    : subject;
}

/* ──────────────────── Hub indexes (the parents of /x/<slug>) ──────────────────── */

/** THE DEFECT THESE FIVE FORMULAS EXIST FOR. /list/<slug>, /author/<slug>,
 *  /category/<slug>, /publisher/<slug> and /series/<slug> all resolved while
 *  their PARENTS 404'd — the same shape readerIndexTitle above was written to
 *  fix, five times over. A reader who trims a slug off the address to see what
 *  else is there hits a dead end, and a crawler sees five sets of pages hanging
 *  off nothing.
 *
 *  Each subject is exported on its own because it is also the page's `<h1>`: the
 *  site's invariant is that the h1 is the title's opening substring, and the one
 *  way to guarantee that is to build both from the same constant.
 *
 *  THE UNIT IS SPELLED OUT rather than left as listingTitle's bare "(nটি)".
 *  These pages count লেখক, প্রকাশনী, বিষয় and তালিকা — not books — and a bare
 *  count on a page of author cards reads as a book count. Authors take "জন",
 *  which is the Bengali counter for people; everything else takes "টি".
 *
 *  ALL FIVE FIT. Calibrated against blogIndexTitle above, which is the same
 *  register of Bengali and was actually measured at 533px for 60 characters
 *  including the template's " | বইদ্বীপ" — 8.9px per character. The longest of
 *  these five is 57 characters with the brand (~506px), so each has room
 *  against the ~600px Google renders even at three digits of rows. Re-measure
 *  with canvas measureText at 20px Arial with the system Bengali fallback
 *  before lengthening any of them; per-character width is font-dependent and
 *  the same string measures 561px in one stack and 612px in another. */

/** `/list` — the highest-volume of the five. "তালিকা" is what a Bengali reader
 *  searches for ("বই পড়ার তালিকা", "সেরা বইয়ের তালিকা"), so the noun leads and
 *  the qualifier follows it. */
export const LIST_SUBJECT = "বই পড়ার তালিকা";

export function listIndexTitle(listCount: number): string {
  const subject = `${LIST_SUBJECT} - সেরা বাংলা বইয়ের বাছাই`;
  return listCount > 0
    ? `${subject} (${toBengaliNumerals(listCount)}টি)`
    : subject;
}

export const AUTHOR_INDEX_SUBJECT = "বাংলা বইয়ের লেখক";

export function authorIndexTitle(authorCount: number): string {
  const subject = `${AUTHOR_INDEX_SUBJECT} - পরিচিতি ও সব বই`;
  return authorCount > 0
    ? `${subject} (${toBengaliNumerals(authorCount)}জন)`
    : subject;
}

export const CATEGORY_INDEX_SUBJECT = "বইয়ের সব বিষয়";

export function categoryIndexTitle(categoryCount: number): string {
  const subject = `${CATEGORY_INDEX_SUBJECT} - বিষয় অনুযায়ী বাংলা বই`;
  return categoryCount > 0
    ? `${subject} (${toBengaliNumerals(categoryCount)}টি)`
    : subject;
}

export const PUBLISHER_INDEX_SUBJECT = "বাংলা বইয়ের প্রকাশনী";

export function publisherIndexTitle(publisherCount: number): string {
  const subject = `${PUBLISHER_INDEX_SUBJECT} - প্রকাশকের সব বই`;
  return publisherCount > 0
    ? `${subject} (${toBengaliNumerals(publisherCount)}টি)`
    : subject;
}

export const SERIES_INDEX_SUBJECT = "বইয়ের সিরিজ";

export function seriesIndexTitle(seriesCount: number): string {
  const subject = `${SERIES_INDEX_SUBJECT} - সব বই ক্রমানুসারে`;
  return seriesCount > 0
    ? `${subject} (${toBengaliNumerals(seriesCount)}টি)`
    : subject;
}

/* ─────────────────────────── Quality floor ─────────────────────────── */

/** Thin author/publisher pages carry noindex until they are worth indexing:
 *  fewer than 2 books, or a bio under ~100 words, is a doorway-shaped page
 *  (plan §9.6). The page still renders and is still linked — readers can use
 *  it — it just does not ask Google to rank it yet. */
export function isThinEntityPage(bookCount: number, bioWordCount: number): boolean {
  return bookCount < 2 && bioWordCount < 100;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max / 2 ? lastSpace : max - 1).trimEnd()}…`;
}

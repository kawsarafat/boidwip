import { getPayloadPopulateFn } from "@payloadcms/richtext-lexical";
import { convertLexicalToHTMLAsync } from "@payloadcms/richtext-lexical/html-async";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import sanitizeHtml from "sanitize-html";
import type { BasePayload } from "payload";
import type { SerializedEditorState } from "lexical";
import type {
  Author as PayloadAuthor,
  BlogPost as PayloadBlogPost,
  Book as PayloadBook,
  BookChapter as PayloadBookChapter,
  Category as PayloadCategory,
  List as PayloadList,
  Media,
  Page,
  Publisher as PayloadPublisher,
  Series as PayloadSeries,
} from "@/payload-types";
import type {
  AuthorContent,
  BlogPostContent,
  BookChapterContent,
  BookChapterSummary,
  BookContent,
  CategoryContent,
  EntityRef,
  FaqItem,
  ListContent,
  PublisherContent,
  SeriesContent,
  StaticPage,
  TocEntry,
} from "@/lib/types";
import {
  DEFAULT_COVER_IMAGE,
  isRightsTier,
  isSafeHttpUrl,
  readingMinutes,
  tierAllowsDelivery,
  toBookSummary,
} from "@/lib/types";
import { COPYRIGHT_TERM_YEARS, isPublicDomainBD, publicDomainFromYear } from "@/lib/rights";
import { toBengaliNumerals } from "@/lib/numerals";

/** Turning a Payload document into the plain shape the page templates render.
 *
 *  Separate from lib/data.ts for one reason: the draft-preview route
 *  (app/(preview)/preview) has to render an unpublished document, and the
 *  data layer by definition only ever sees published ones. Preview therefore
 *  needs the same conversion — Lexical to HTML, the same sanitizer allowlist,
 *  the same cover fallback — applied to a different query.
 *
 *  Reimplementing that in the preview route is the exact failure AGENTS.md warns
 *  about for lib/payload/editor.ts and sanitizeContentHtml(): two copies of a
 *  content pipeline drift, and the drift is SILENT. A preview that renders
 *  markup the live page will strip is worse than no preview at all, because the
 *  editor approves what they were shown.
 *
 *  So there is one pipeline, here, and both callers use it. lib/data.ts re-exports
 *  what pages already imported from it, so nothing outside these two files had to
 *  change. */

// Content is written by trusted CMS editors, but sanitizing the rendered
// output anyway is cheap insurance: it means a compromised editor account, a
// mistake in content, or the CMS itself being tricked into writing bad markup
// can't turn into a stored-XSS hole affecting every visitor. Only a
// plain-content allowlist gets through, no script tags, no inline event
// handlers, no javascript: URLs.
//
// THIS ALLOWLIST AND lib/payload/editor.ts ARE A MATCHED PAIR. Whatever the
// Lexical editor can produce has to survive this function, and anything
// stripped here fails SILENTLY — the editor would show a table or a
// superscript, the live page would show nothing, and there would be no error
// anywhere to notice. Every tag below was checked against Payload's actual
// converters in @payloadcms/richtext-lexical/dist/features/converters/
// lexicalToHtml rather than guessed at. Re-check them when enabling a new
// editor feature.
//
// Deliberately absent: `style`. Payload's converters emit inline styles for
// table borders (`1px solid #ccc`), cell padding, and list markers. Dropping
// them is not a loss — @tailwindcss/typography's `prose` classes already
// style tables, cells and lists to match the rest of the site, so allowing
// Lexical's hardcoded values through would actually make CMS tables look
// foreign. Keeping `style` out also means there is no inline-CSS surface to
// have to reason about at all.
export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em", "b", "i", "u", "s",
      // Chemistry and physics content needs these constantly — H₂O, x², mⁿ.
      // Lexical's Subscript/Superscript features emit them directly.
      "sub", "sup",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "a", "img", "code", "pre",
      "table", "thead", "tbody", "tr", "th", "td", "hr",
      // Lexical wraps every table in <div class="lexical-table-container">.
      // Kept (with its class) because that wrapper is what makes a wide table
      // scroll sideways on a phone instead of breaking the page layout — see
      // the rule for it in app/(frontend)/globals.css.
      "div",
      // Lexical builds responsive images as <picture> with one <source> per
      // generated size from the Media collection. Without these two the
      // browser would fall back to the full-size <img> inside, which still
      // renders but throws away every resize the CMS just did.
      "picture", "source",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "loading", "decoding", "class", "width", "height"],
      source: ["media", "srcset", "type"],
      div: ["class"],
      // Structural, not cosmetic: a merged cell that loses its span silently
      // corrupts the shape of the whole table.
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // `srcset` is a URL-bearing attribute that sanitize-html does not
    // scheme-check by default (its default list is href/src/cite only).
    // Adding it costs nothing and closes the gap rather than relying on
    // browsers refusing to execute a javascript: image source.
    allowedSchemesAppliedToAttributes: ["href", "src", "cite", "srcset"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      // Lexical encodes underline and strikethrough as a styled <span>, not
      // as <u>/<s>. Since `style` is not allowed above, letting the span
      // through as-is would drop the formatting entirely. Rewriting it to the
      // semantic tag keeps the meaning, needs no inline CSS, and lands on
      // tags `prose` already styles. sanitize-html applies transforms BEFORE
      // the allowedTags check, so <span> itself never has to be allowed.
      span: (tagName, attribs) => {
        const style = attribs.style ?? "";
        if (style.includes("line-through")) return { tagName: "s", attribs: {} };
        if (style.includes("underline")) return { tagName: "u", attribs: {} };
        // Any other span carries no meaning worth keeping; dropping the tag
        // still preserves the text inside it.
        return { tagName: "span", attribs: {} };
      },
    },
  });
}

/** Lexical -> sanitized HTML. */
export type RichTextRenderer = (
  data: SerializedEditorState | null | undefined
) => Promise<string>;

/** Matches a whole h2 or h3 element in the SANITIZED html.
 *
 *  A regex over HTML is normally a mistake, and it would be one here too if it
 *  ran on arbitrary markup. It is safe on this specific input for one reason:
 *  `allowedAttributes` in sanitizeContentHtml lists no entry for h2/h3, so
 *  sanitize-html has already stripped every attribute from them and re-emitted
 *  them as exactly `<h2>` / `<h3>`. There is no attribute to mis-parse, no
 *  self-closing form, and headings cannot nest inside each other, so the
 *  non-greedy body match cannot run past its own closing tag.
 *
 *  If a future editor feature needs an attribute on a heading, add it to
 *  allowedAttributes AND replace this with a real parser. The failure mode
 *  otherwise is a mangled heading on a live page. */
const HEADING_RE = /<(h[23])>([\s\S]*?)<\/\1>/g;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Heading text for the TOC comes out of HTML, so entities have to be decoded
 *  or a title containing "&" would read as "&amp;" in the sidebar. React
 *  escapes it again on output, so this is a decode for display, not a hole. */
function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

/** Gives every h2/h3 in a chapter body a stable id and returns the table of
 *  contents alongside.
 *
 *  Ids are `section-1`, `section-2`, ... rather than a slug of the heading text
 *  on purpose. The headings here are Bengali, and a Bengali id means a URL
 *  fragment that is percent-encoded into forty unreadable bytes when shared,
 *  and that changes the moment an editor fixes a typo in the heading. A
 *  positional id is short, ASCII, and shareable. It does move if a section is
 *  inserted above it, which is the accepted trade: a slightly stale bookmark
 *  beats a fragment nobody can read or copy. */
export function withHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  let index = 0;

  const withIds = html.replace(HEADING_RE, (_match, tag: string, inner: string) => {
    index += 1;
    const id = `section-${index}`;
    const text = decodeEntities(inner.replace(/<[^>]*>/g, "")).trim();
    // An empty heading (an editor left a blank line styled as a heading) still
    // gets its id so numbering stays aligned with the document, but there is
    // nothing to put in a TOC link.
    if (text) toc.push({ id, text, level: tag === "h2" ? 2 : 3 });
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });

  return { html: withIds, toc };
}

/** Builds the renderer for one Payload instance.
 *
 *  The populate function is created once and closed over, because building it
 *  per call would re-resolve the collection config on every field. */
export async function makeRichTextRenderer(payload: BasePayload): Promise<RichTextRenderer> {
  // Resolves upload and internal-link nodes embedded in the rich text.
  // Needed even though documents are fetched at depth 1, because the
  // converter walks nodes the outer query does not populate.
  const populate = await getPayloadPopulateFn({
    currentDepth: 0,
    depth: 1,
    payload,
  });

  return async (data) => {
    if (!data) return "";
    const html = await convertLexicalToHTMLAsync({
      data,
      populate,
      // The surrounding page already provides the `prose` wrapper; Lexical's
      // own container div would just be a second, redundant one.
      disableContainer: true,
    });
    return sanitizeContentHtml(html);
  };
}

/** Narrows a Payload relationship/upload field, which is either the raw ID
 *  (depth 0) or the populated document (depth 1+). Everything here is
 *  fetched at depth 1, so the object branch is the expected one — this
 *  exists so a future depth change degrades to "no cover image" instead of
 *  rendering the string "42" as a URL. */
export function populated<T extends object>(
  value: number | string | T | null | undefined
): T | null {
  return value && typeof value === "object" ? (value as T) : null;
}

/* ─────────────────────────── Small shared helpers ─────────────────────────── */

type Rich = SerializedEditorState | null | undefined;

function asRich(value: unknown): Rich {
  return (value ?? null) as Rich;
}

function plainWordCount(data: Rich): number {
  if (!data) return 0;
  const text = convertLexicalToPlaintext({ data });
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Plain-text projection truncated for card summaries and meta descriptions.
 *  From the RICH TEXT, not the HTML — stripping tags with a regex is the kind
 *  of thing that quietly mangles the first table someone adds. */
function plainSummary(data: Rich, max = 200): string {
  if (!data) return "";
  const text = convertLexicalToPlaintext({ data }).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max / 2 ? lastSpace : max - 1).trimEnd()}…`;
}

function entityRef(
  doc: { slug: string; name?: string | null; title?: string | null } | null
): EntityRef | null {
  if (!doc?.slug) return null;
  const name = doc.name ?? doc.title ?? "";
  return name ? { slug: doc.slug, name } : null;
}

/** Media upload → URL string, or null. Only ever the object branch at the
 *  depths the data layer queries; see populated() above. */
function mediaUrl(value: PayloadBook["cover"]): string | null {
  return populated<Media>(value)?.url || null;
}

/* ─────────────────────────── Books ─────────────────────────── */

/** The one sentence a public-domain book page owes its reader: WHY the book is
 *  out of copyright, as arithmetic they can check rather than an assertion they
 *  have to take on trust.
 *
 *  Everything it needs is already in the database. The death years come from
 *  the author records the book is related to, and lib/rights.ts already holds
 *  the Bangladesh term (life + 60, from the year following death) with its own
 *  test table. So this costs no new field: it is the same number the admin
 *  rights assistant shows an editor, said out loud on the public page.
 *
 *  Returns null rather than guessing, in four cases that matter:
 *
 *   - the editor did not classify the book as public domain. The TIER is the
 *     editor's call, always (see lib/rights.ts); this note explains a decision,
 *     it never makes one.
 *   - any contributing death year is missing. "We don't know" must not read as
 *     "it's free" on a page a rights holder might one day be reading.
 *   - the arithmetic disagrees with the tier. A page that says "public domain"
 *     in the sidebar and "protected until 2073" in the footnote is worse than a
 *     page that says nothing; the contradiction is an admin problem to fix, not
 *     something to publish while it is being fixed.
 *
 *  The TRANSLATOR counts, and is the subtle half. A translation carries its own
 *  fresh copyright, so a public-domain original in an in-copyright translation
 *  is in-copyright AS PUBLISHED — the Books collection says as much next to the
 *  field. Copyright also runs from the LAST surviving contributor, so the
 *  governing year is the maximum, not the first author's. */
function publicDomainNoteFor(
  b: PayloadBook,
  rightsTier: string,
  authorDocs: ReadonlyArray<PayloadAuthor | null>
): string | null {
  if (rightsTier !== "public-domain") return null;

  const translator = populated<PayloadAuthor>(b.translator);
  const contributors = [...authorDocs, translator].filter(
    (a): a is PayloadAuthor => a !== null
  );
  if (contributors.length === 0) return null;

  const deathYears = contributors.map((a) => a.deathYear);
  if (deathYears.some((y) => typeof y !== "number" || !Number.isInteger(y))) return null;

  const governing = Math.max(...(deathYears as number[]));
  const pdFrom = publicDomainFromYear(governing);
  if (pdFrom === null || !isPublicDomainBD(governing)) return null;

  const who = contributors.length > 1 ? "সর্বশেষ লেখকের" : "লেখকের";
  return `${who} মৃত্যু ${toBengaliNumerals(governing)} সালে। বাংলাদেশের কপিরাইট আইনে সুরক্ষা চলে মৃত্যুর পরের বছর থেকে ${toBengaliNumerals(COPYRIGHT_TERM_YEARS)} বছর, তাই বইটি ${toBengaliNumerals(pdFrom)} সাল থেকে পাবলিক ডোমেইনে।`;
}

/** The one Book → BookContent pipeline, used by the data layer for published
 *  books and by the preview route for drafts. Enforces Tier D at RENDER time
 *  too: even if a hostile write slipped a pdf past the collection hook, the
 *  view model for an in-copyright book simply has no pdfUrl. Defense in
 *  depth for the site's single biggest legal exposure. */
export async function toBookContent(
  b: PayloadBook,
  toHtml: RichTextRenderer
): Promise<BookContent> {
  const cover = mediaUrl(b.cover);

  const synopsisHtml = await toHtml(asRich(b.synopsis));
  const reviewHtml = await toHtml(asRich(b.review));

  // The TOC navigates the page's longest prose block: the review when one
  // exists, the synopsis otherwise. Heading ids are assigned on whichever
  // was picked, so TOC links always point at the block that got the ids.
  const tocSource = reviewHtml || synopsisHtml;
  const { html: tocHtml, toc } = withHeadingIds(tocSource);
  const finalReviewHtml = reviewHtml ? tocHtml : reviewHtml;
  const finalSynopsisHtml = reviewHtml ? synopsisHtml : tocHtml;

  const rightsTier = isRightsTier(b.rightsTier) ? b.rightsTier : "in-copyright";
  const deliverable = tierAllowsDelivery(rightsTier);

  // Uploaded PDF wins over a pasted external link; only the pasted path can
  // carry a hostile scheme, so only it is checked.
  const uploadedPdf = mediaUrl(b.pdf);
  const externalPdf =
    b.pdfExternalUrl && isSafeHttpUrl(b.pdfExternalUrl) ? b.pdfExternalUrl : null;
  const pdfUrl = deliverable ? uploadedPdf || externalPdf : null;

  // The populated docs, not just the refs: publicDomainNoteFor() needs the
  // death years, and entityRef() throws everything but slug and name away.
  const authorDocs = (b.authors ?? []).map((a) => populated<PayloadAuthor>(a));
  const authors = authorDocs
    .map((a) => entityRef(a))
    .filter((a): a is EntityRef => a !== null);

  const categories = (b.categories ?? [])
    .map((c) => entityRef(populated<PayloadCategory>(c)))
    .filter((c): c is EntityRef => c !== null);

  const primaryCategory =
    entityRef(populated<PayloadCategory>(b.primaryCategory)) ?? categories[0] ?? null;

  const seriesDoc = populated<PayloadSeries>(b.series);
  const seriesRef = entityRef(seriesDoc);

  const faqItems: FaqItem[] = (b.faqItems ?? [])
    .filter((f) => f?.question && f?.answer)
    .map((f) => ({ question: f.question, answer: f.answer }));

  return {
    slug: b.slug,
    title: b.title,
    titleLatin: b.titleLatin || null,
    subtitle: b.subtitle || null,
    rightsTier,
    licenceName: b.licenceName || null,
    licenceUrl: b.licenceUrl && isSafeHttpUrl(b.licenceUrl) ? b.licenceUrl : null,
    // Checked again here even though the collection's validate already refused
    // a hostile scheme: this is the value React drops straight into an href,
    // and a row written before the validate existed would not have been asked.
    textSourceName: b.textSourceName || null,
    textSourceUrl:
      b.textSourceUrl && isSafeHttpUrl(b.textSourceUrl) ? b.textSourceUrl : null,
    publicDomainNote: publicDomainNoteFor(b, rightsTier, authorDocs),
    permissionNote:
      rightsTier === "permitted" ? "প্রকাশকের অনুমতিতে বিতরণ করা হচ্ছে।" : null,
    authors,
    publisher: entityRef(populated<PayloadPublisher>(b.publisher)),
    categories,
    primaryCategory,
    series: seriesRef ? { ...seriesRef, position: b.seriesNumber ?? null } : null,
    coverImage: cover || DEFAULT_COVER_IMAGE,
    hasCustomCover: Boolean(cover),
    synopsisHtml: finalSynopsisHtml,
    reviewHtml: finalReviewHtml,
    whoShouldRead: b.whoShouldRead || null,
    quotes: (b.quotes ?? []).map((q) => q.text).filter(Boolean),
    summary: b.subtitle || plainSummary(asRich(b.synopsis), 160),
    toc: toc.length >= 2 ? toc : [],
    printedToc: (b.tableOfContents ?? []).map((t) => ({
      title: t.title,
      page: t.page ?? null,
    })),
    faqItems,
    pdfUrl,
    pdfSizeMB: b.pdfSizeBytes ? Math.round((b.pdfSizeBytes / 1_048_576) * 10) / 10 : null,
    // Chapters are attached by the data layer (they live in their own
    // collection); the converter cannot query.
    chapters: [],
    rokomariUrl: b.rokomariUrl && isSafeHttpUrl(b.rokomariUrl) ? b.rokomariUrl : null,
    priceTaka: b.priceBdt ?? null,
    priceCheckedAt: b.priceCheckedAt ? new Date(b.priceCheckedAt).toISOString() : null,
    pageCount: b.bibliographic?.pages ?? b.pdfPages ?? null,
    firstPublishedYear: b.bibliographic?.firstPublished ?? null,
    isbn: b.bibliographic?.isbn13 || null,
    language: b.bibliographic?.language ?? "bn",
    ratingAverage: b.ratingAverage ?? null,
    ratingCount: b.ratingCount ?? 0,
    downloadCount: b.downloadCount ?? 0,
    featured: Boolean(b.featured),
    popular: Boolean(b.popular),
    // A draft may have no publishDate yet; new Date(null) is 1970, and a 1970
    // byline in preview is a bug an editor would report.
    publishDate: new Date(b.publishDate ?? b.updatedAt).toISOString(),
    updatedAt: new Date(b.updatedAt).toISOString(),
  };
}

/* ─────────────────────────── Book chapters ─────────────────────────── */

export function toBookChapterSummary(c: PayloadBookChapter): BookChapterSummary {
  return {
    slug: c.slug,
    title: c.title,
    order: c.chapterNumber,
    wordCount: c.wordCount ?? 0,
  };
}

export async function toBookChapterContent(
  c: PayloadBookChapter,
  toHtml: RichTextRenderer
): Promise<BookChapterContent> {
  const bodyHtml = await toHtml(asRich(c.body));
  const wordCount = c.wordCount ?? plainWordCount(asRich(c.body));
  return {
    ...toBookChapterSummary(c),
    wordCount,
    bodyHtml,
    // One formula, three call sites: see readingMinutes in lib/types.ts.
    readingTimeMinutes: readingMinutes(wordCount),
    updatedAt: new Date(c.updatedAt).toISOString(),
  };
}

/* ─────────────────── Authors / publishers / taxonomy ─────────────────── */

/** bookCount/freePdfCount are denormalised by hooks on the collection; the
 *  data layer recomputes them from the published set anyway (the hook value
 *  can lag a publish), so the converter takes them as arguments. */
export async function toAuthorContent(
  a: PayloadAuthor,
  toHtml: RichTextRenderer,
  counts: { bookCount: number; freePdfCount: number }
): Promise<AuthorContent> {
  return {
    slug: a.slug,
    name: a.name,
    nameLatin: a.nameLatin || null,
    nameAliases: (a.nameAliases ?? []).map((x) => x.alias).filter(Boolean),
    photo: mediaUrl(a.photo),
    bioHtml: await toHtml(asRich(a.bio)),
    bioWordCount: plainWordCount(asRich(a.bio)),
    birthYear: a.birthYear ?? null,
    deathYear: a.deathYear ?? null,
    freePdfCount: counts.freePdfCount,
    bookCount: counts.bookCount,
    updatedAt: new Date(a.updatedAt).toISOString(),
  };
}

export async function toPublisherContent(
  p: PayloadPublisher,
  toHtml: RichTextRenderer,
  counts: { bookCount: number; freePdfCount: number }
): Promise<PublisherContent> {
  return {
    slug: p.slug,
    name: p.name,
    nameLatin: p.nameLatin || null,
    logo: mediaUrl(p.logo),
    descriptionHtml: await toHtml(asRich(p.about)),
    website: p.website && isSafeHttpUrl(p.website) ? p.website : null,
    freePdfCount: counts.freePdfCount,
    bookCount: counts.bookCount,
    updatedAt: new Date(p.updatedAt).toISOString(),
  };
}

export async function toCategoryContent(
  c: PayloadCategory,
  toHtml: RichTextRenderer,
  bookCount: number
): Promise<CategoryContent> {
  return {
    slug: c.slug,
    name: c.name,
    nameLatin: c.nameLatin || null,
    descriptionHtml: await toHtml(asRich(c.description)),
    parent: entityRef(populated<PayloadCategory>(c.parent)),
    bookCount,
    updatedAt: new Date(c.updatedAt).toISOString(),
  };
}

export async function toSeriesContent(
  s: PayloadSeries,
  toHtml: RichTextRenderer,
  bookCount: number
): Promise<SeriesContent> {
  return {
    slug: s.slug,
    name: s.name,
    nameLatin: s.nameLatin || null,
    descriptionHtml: await toHtml(asRich(s.description)),
    bookCount,
    updatedAt: new Date(s.updatedAt).toISOString(),
  };
}

/* ─────────────────────────── Curated lists ─────────────────────────── */

/** List entries embed a book relationship each; the note is per-entry
 *  editorial prose ("WHY this book is on the list"). Unpublished or
 *  unpopulated books are dropped rather than rendered as holes. */
export async function toListContent(
  l: PayloadList,
  toHtml: RichTextRenderer,
  resolveBook: (bookId: number) => BookContent | undefined
): Promise<ListContent> {
  const entries: ListContent["entries"] = [];
  for (const entry of l.entries ?? []) {
    const raw = entry.book;
    const id = typeof raw === "object" && raw !== null ? raw.id : raw;
    const book = typeof id === "number" ? resolveBook(id) : undefined;
    if (!book) continue; // draft, scheduled or deleted — not a hole in the list
    entries.push({
      book: toBookSummary(book),
      noteHtml: await toHtml(asRich(entry.note)),
    });
  }
  return {
    slug: l.slug,
    title: l.title,
    descriptionHtml: await toHtml(asRich(l.intro)),
    entries,
    publishDate: new Date(l.publishDate ?? l.updatedAt).toISOString(),
    updatedAt: new Date(l.updatedAt).toISOString(),
  };
}

/* ─────────────────────────── Blog / pages ─────────────────────────── */

export async function toBlogPostContent(
  post: PayloadBlogPost,
  toHtml: RichTextRenderer,
  resolveBook: (bookId: number) => BookContent | undefined
): Promise<BlogPostContent> {
  const { html: bodyHtml, toc } = withHeadingIds(await toHtml(asRich(post.body)));
  // Counted from the RICH TEXT, not the rendered HTML: the heading ids and the
  // sanitizer's attributes are not words, and a tag-stripping regex over the
  // html would count them on the first table someone adds.
  const wordCount = plainWordCount(asRich(post.body));
  const books = (post.relatedBooks ?? [])
    .map((raw) => {
      const id = typeof raw === "object" && raw !== null ? raw.id : raw;
      return typeof id === "number" ? resolveBook(id) : undefined;
    })
    .filter((b): b is BookContent => Boolean(b))
    .map(toBookSummary);
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary || plainSummary(asRich(post.body), 160),
    coverImage: mediaUrl(post.coverImage),
    bodyHtml,
    toc: toc.length >= 2 ? toc : [],
    wordCount,
    readingTimeMinutes: readingMinutes(wordCount),
    books,
    publishDate: new Date(post.publishDate ?? post.updatedAt).toISOString(),
    updatedAt: new Date(post.updatedAt).toISOString(),
  };
}

export async function toStaticPage(p: Page, toHtml: RichTextRenderer): Promise<StaticPage> {
  return {
    slug: p.slug,
    title: p.title,
    bodyHtml: await toHtml(asRich(p.body)),
    updatedAt: new Date(p.updatedAt).toISOString(),
  };
}

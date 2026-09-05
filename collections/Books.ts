import type { CollectionConfig, Validate } from "payload";
import {
  RIGHTS_TIERS,
  getRightsTierLabel,
  isSafeHttpUrl,
  tierAllowsOnlineReading,
} from "../lib/types";
import { contentEditor } from "../lib/payload/editor";
import {
  authenticated,
  authenticatedFieldRead,
  publishedOrAuthenticated,
} from "../lib/payload/access";
import { rebuildOnDelete, rebuildOnPublish } from "../lib/payload/revalidate";

/** Books — the site's central collection; everything else on the site
 *  exists to describe, deliver, or discuss these records.
 *
 *  THE ONE HOOK THAT MATTERS MOST IN THIS FILE is `enforceRightsTier` below:
 *  a book whose `rightsTier` is "in-copyright" REFUSES to publish while it
 *  carries a pdf, an external PDF URL, or reader chapters. Field-level
 *  `condition` alone is not enough because a condition only hides a field in
 *  the UI — the value survives in the document and the REST API will still
 *  accept it. This is the single most important guard in the schema, and it
 *  belongs in a hook. Everything else on this site is a feature; this is the
 *  thing that keeps the site legal. */

const slugValidator: Validate = async (
  value: string | null | undefined,
  { req, id }: { req?: any; id?: string | number },
) => {
  if (!value) return "Slug is required.";
  if (!/^[a-z0-9-]+$/.test(value)) {
    return "Use lowercase letters, numbers and hyphens only (no spaces, no capitals, no Bengali characters).";
  }
  // The unique index in Postgres is the real guarantee. This check exists so
  // a clash is reported as a readable field error rather than a raw database
  // constraint violation after the editor has already hit save.
  if (!req?.payload) return true;
  const existing = await req.payload.find({
    collection: "books",
    where: {
      and: [
        { slug: { equals: value } },
        ...(id ? [{ id: { not_equals: id } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    // Drafts share the slug namespace with published docs, since both
    // resolve to the same URL once live.
    draft: true,
    overrideAccess: true,
  });
  if (existing?.totalDocs > 0) {
    return "Another book already uses this slug.";
  }
  return true;
};

export const Books: CollectionConfig = {
  slug: "books",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "rightsTier", "engagement", "publishDate", "_status"],
    group: "Catalogue",
    description:
      "Every book page on the site. A draft stays off the live site, and a publish date in the future holds a published book back until that date passes. The rule that trips people up: the rights tier decides what the page may offer, and an in-copyright book can never carry a PDF — saving one that does will fail.",
    listSearchableFields: ["title", "titleLatin", "slug"],
  },

  versions: {
    drafts: true,
    maxPerDoc: 20,
  },

  // (rightsTier, _status) is what the compliance dashboard counts against —
  // without it that count is a sequential scan over every book on every
  // admin load. (publisher, publishDate) backs the publisher shelf query.
  indexes: [
    { fields: ["rightsTier", "_status"] },
    { fields: ["publisher", "publishDate"] },
  ],

  access: {
    // Only published books are readable without being logged in, so an
    // unauthenticated request to the REST API can't enumerate drafts.
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    // Version history is the draft of an unpublished book by another name.
    // Payload derives readVersions from `read` when absent, and a `read`
    // that returns a WHERE clause on `_status` does not constrain the
    // versions table the same way — so this is stated outright.
    readVersions: authenticated,
  },

  hooks: {
    beforeValidate: [
      /** THE COMPLIANCE GATE. Refuses to publish an in-copyright book that
       *  carries any deliverable file, and refuses distributable tiers
       *  without a stated legal basis. Runs on the API layer, not the UI
       *  layer, so it cannot be bypassed by a REST call. */
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data;

        // EVERY FIELD THIS GATE READS IS MERGED WITH THE STORED DOCUMENT
        // FIRST, and that is the difference between a gate and a decoration.
        // `data` in beforeValidate is the INCOMING PATCH, not the resulting
        // document: `PATCH /api/books/<id> {"_status":"published"}` arrives
        // here with `rightsTier`, `pdf` and `takedownStatus` all undefined.
        // Read straight off `data` and every check silently passes — the
        // in-copyright book with a PDF already attached publishes, which is
        // exactly the outcome this hook exists to prevent. `pick` prefers the
        // incoming value whenever the request mentions the field AT ALL
        // (including an explicit null, which is how a file gets cleared) and
        // falls back to the stored one otherwise.
        const pick = <T,>(incoming: T | undefined, existing: T | undefined) =>
          incoming !== undefined ? incoming : existing;

        const status = pick(data._status, originalDoc?._status);
        const publishing = status === "published";
        const tier = pick(data.rightsTier, originalDoc?.rightsTier) as
          | string
          | undefined;
        const rightsBasis = pick(data.rightsBasis, originalDoc?.rightsBasis) as
          | string
          | undefined;
        const takedownStatus = pick(data.takedownStatus, originalDoc?.takedownStatus);

        if (tier === "in-copyright") {
          const hasFile = Boolean(
            pick(data.pdf, originalDoc?.pdf) ||
              pick(data.pdfExternalUrl, originalDoc?.pdfExternalUrl) ||
              pick(data.epub, originalDoc?.epub),
          );
          if (hasFile && publishing) {
            throw new Error(
              "এই বইটির rights tier হলো “কপিরাইটকৃত” — PDF/EPUB ফাইল বা এক্সটার্নাল লিংকসহ এটি প্রকাশ করা যাবে না। ফাইলগুলো সরান, অথবা টিয়ার পরিবর্তনের আগে আইনি ভিত্তি নিশ্চিত করুন।",
            );
          }
        } else if (publishing && tier && !rightsBasis?.trim()) {
          // A distributable tier without a stated legal basis is a takedown
          // letter waiting to happen — the basis is the audit trail.
          throw new Error(
            "যে বই ডাউনলোডযোগ্য (public-domain / open-licence / permitted), তার “Rights basis” এক বাক্যে লিখতে হবে — কেন এটি বিতরণযোগ্য।",
          );
        }

        // Reader chapters make the full text public, which is the same
        // violation via another door — so this check is NOT nested inside the
        // in-copyright branch. `permitted` (Tier C) fails it too: written
        // permission to distribute a PDF is not permission to republish the
        // work as HTML on our own domain, and tierAllowsOnlineReading is the
        // one function that decides that (collections/BookChapters.ts refuses
        // to attach the chapter for the same reason). Hoisting it here is what
        // blocks the reclassification path: a Tier A book with chapters that
        // is edited down to `permitted` and re-published now stops, instead of
        // quietly becoming a Tier C book serving full text.
        //
        // The id comes from `originalDoc`, not `data`. `data.id` is undefined
        // on virtually every update — Payload carries the id in the route
        // params and the original document, not in the submitted values — so
        // the old `data.id` condition meant this query never ran at all.
        const bookId = originalDoc?.id ?? data.id;
        if (publishing && bookId && req?.payload && !tierAllowsOnlineReading(tier ?? "")) {
          const chapters = await req.payload.find({
            collection: "book-chapters",
            where: { book: { equals: bookId } },
            limit: 1,
            depth: 0,
            // Drafts count: an unpublished chapter still holds the full text
            // and is one publish away from being live.
            draft: true,
            overrideAccess: true,
          });
          if (chapters?.totalDocs > 0) {
            throw new Error(
              tier === "in-copyright"
                ? "এই কপিরাইটকৃত বইটির অধীনে রিডার-অধ্যায় (book-chapters) রয়েছে — সেগুলো না সরিয়ে বইটি প্রকাশ করা যাবে না।"
                : "এই টিয়ারে (অনুমতিপ্রাপ্ত) অনলাইন রিডার চালু করা যায় না — অনুমতি PDF বিতরণের, নিজের সাইটে পূর্ণ টেক্সট প্রকাশের নয়। বইটির অধীনে থাকা রিডার-অধ্যায়গুলো সরান, অথবা টিয়ার পাবলিক ডোমেইন / উন্মুক্ত লাইসেন্স রাখুন।",
            );
          }
        }

        // A removed (takedown) book must not be re-published until the
        // status is cleared — see plan §14.2.
        if (publishing && takedownStatus === "removed") {
          throw new Error(
            "এই বইটি টেকডাউন অনুরোধে সরানো হয়েছে (takedown status: removed)। পুনরায় প্রকাশের আগে স্ট্যাটাস পরিষ্কার করুন।",
          );
        }
        void operation;
        return data;
      },
    ],
    beforeChange: [
      /** Accountability: stamp who published a distributable book. Read-only
       *  in the admin; set here, not by the editor. */
      ({ data, req, originalDoc }) => {
        if (!data) return data;
        const crossingIntoPublished =
          data._status === "published" && originalDoc?._status !== "published";
        if (crossingIntoPublished && req?.user) {
          data.rightsReviewedBy = req.user.id;
        }
        return data;
      },
    ],
    afterChange: [rebuildOnPublish],
    afterDelete: [rebuildOnDelete],
  },

  /** THE SHAPE OF THIS SCREEN, AND WHY IT IS TABS.
   *
   *  Fifty-six fields is more than one screen can hold, and the previous
   *  layout put twenty-three of them in the 325px sidebar: seven relationship
   *  pickers, the rights audit trail, a bibliographic group and four
   *  read-only counters, all sharing the rail whose job is to answer "is this
   *  live?". The seven tabs below are the editor's actual jobs — name it,
   *  write it, classify it, clear it legally, attach the files, price it,
   *  watch it — and the sidebar is cut back to the six fields that answer one
   *  question at a glance.
   *
   *  EVERY TAB HERE IS UNNAMED, which is a schema decision and not a styling
   *  one. Payload flattens an unnamed tab (and a `row`) before a field ever
   *  reaches Postgres — see flattenTopLevelFields, which hoists both
   *  unconditionally — so `title` is still `title` and `bibliographic.isbn13`
   *  is still `bibliographic.isbn13`, and this whole reorganisation needs no
   *  migration. Giving one of these tabs a `name` would nest everything under
   *  it and rewrite the table. Don't.
   *
   *  `rightsTier` STAYS IN THE SIDEBAR although there is now a Rights tab,
   *  and that is the one deliberate inconsistency here. It is the field that
   *  decides whether this page may legally carry a PDF at all, lib/render.ts
   *  gates delivery on it, and a compliance gate that can be scrolled out of
   *  sight is a compliance gate you forget. Visible on every tab is the
   *  point. */
  fields: [
    {
      type: "tabs",
      tabs: [
        /* ---------------- Overview: what it is called ---------------- */
        {
          label: "Overview",
          description:
            "The names this book is known by. The search-result preview at the bottom is live — it shows what Google will print for this page as you type.",
          fields: [
            {
              // One row, because these two are one decision: the
              // transliteration is typed straight after the title, and side
              // by side is what catches a Banglish spelling that does not
              // match the Bengali.
              type: "row",
              fields: [
                {
                  name: "title",
                  type: "text",
                  required: true,
                  admin: {
                    description:
                      'বাংলা শিরোনাম — the <h1> and the headline in search results, e.g. "অপেক্ষা".',
                  },
                },
                {
                  name: "titleLatin",
                  type: "text",
                  label: "Title (Latin / Banglish)",
                  admin: {
                    description:
                      'Transliteration, e.g. "Opekkha". Feeds Banglish search and the OG card. Not shown on the page.',
                  },
                },
              ],
            },
            {
              name: "subtitle",
              type: "textarea",
              admin: {
                description:
                  "One-line summary shown under the title and used as the meta description seed. Aim for roughly 120–160 characters.",
              },
            },
            {
              name: "originalTitle",
              type: "text",
              admin: {
                description: "For translations: the original work's title.",
                condition: (data) => Boolean(data?.translator) || Boolean(data?.originalTitle),
              },
            },
            {
              // Live Google-result preview. A `ui` field with a `Field`
              // component, kept at the END of this tab so the writer sees the
              // finished snippet once title, subtitle, slug and tier are set.
              // Its formula mirrors lib/seo.ts and must be changed in step
              // with it.
              name: "serpPreview",
              type: "ui",
              label: "Search result preview",
              admin: {
                components: {
                  Field: "/components/payload/seo/SerpPreview#default",
                },
              },
            },
          ],
        },

        /* ---------------- Content: everything you write ---------------- */
        {
          label: "Content",
          description:
            "The words that make this page worth indexing. Synopsis is required; for an in-copyright book the review is the page.",
          fields: [
            {
              name: "synopsis",
              type: "richText",
              required: true,
              editor: contentEditor,
              admin: {
                description:
                  "আপনার নিজের লেখা সারসংক্ষেপ — স্ক্র্যাপ করা ব্যাক-কভার নয়। এটাই পেজটিকে thin content হওয়া থেকে বাঁচায়।",
              },
            },
            {
              name: "review",
              type: "richText",
              editor: contentEditor,
              admin: {
                description:
                  "সম্পাদকীয় রিভিউ — থিম, কার জন্য বইটি, লেখকের ধারায় এর অবস্থান। কপিরাইটকৃত (Tier D) বইয়ের পেজের মূল কনটেন্ট এটাই।",
              },
            },
            {
              name: "whoShouldRead",
              type: "textarea",
              label: "কারা পড়বেন",
              admin: {
                description:
                  "২–৩ বাক্য: এই বইটি কাদের ভালো লাগবে। কেনার সিদ্ধান্তে অস্বাভাবিক রকম কাজ করে।",
              },
            },
            {
              name: "tableOfContents",
              type: "array",
              label: "সূচিপত্র",
              labels: { singular: "Entry", plural: "Entries" },
              admin: {
                initCollapsed: true,
                description:
                  "The PRINTED book's contents page, as plain text. Not the online reader — reader chapters are their own collection.",
              },
              fields: [
                { name: "title", type: "text", required: true },
                { name: "page", type: "number" },
              ],
            },
            {
              name: "quotes",
              type: "array",
              label: "উদ্ধৃতি",
              labels: { singular: "Quote", plural: "Quotes" },
              admin: {
                initCollapsed: true,
                description:
                  "স্মরণীয় লাইন — পাঠকেরা মনে-রাখা লাইন দিয়ে বই খোঁজেন, প্রতিটি উদ্ধৃতি একটি long-tail সার্চ এন্ট্রি পয়েন্ট।",
              },
              fields: [{ name: "text", type: "textarea", required: true }],
            },
            {
              name: "faqItems",
              type: "array",
              label: "FAQ",
              labels: { singular: "Question", plural: "Questions" },
              admin: {
                initCollapsed: true,
                description:
                  "Rendered on the page and as FAQPage JSON-LD — for readers and LLM answer engines, not for SERP rows (Google restricted those in 2023).",
              },
              fields: [
                { name: "question", type: "text", required: true },
                { name: "answer", type: "textarea", required: true },
              ],
            },
            {
              name: "awards",
              type: "array",
              label: "পুরস্কার",
              admin: { initCollapsed: true },
              fields: [
                { name: "name", type: "text", required: true },
                { name: "year", type: "number" },
              ],
            },
            {
              name: "adaptations",
              type: "array",
              label: "চলচ্চিত্র / নাটক রূপান্তর",
              admin: {
                initCollapsed: true,
                description: "Film and TV adaptations are high-volume queries in their own right.",
              },
              fields: [
                { name: "title", type: "text", required: true },
                { name: "kind", type: "select", options: ["film", "tv", "web-series", "theatre"] },
                { name: "year", type: "number" },
              ],
            },
          ],
        },

        /* ---------------- Classification: how it is found ---------------- */
        {
          label: "Classification",
          description:
            "Who made it and where it sits in the catalogue. Every relationship on this tab is a hub page the book will link to, so an empty one costs the book a route in.",
          fields: [
            {
              name: "authors",
              type: "relationship",
              relationTo: "authors",
              hasMany: true,
              required: true,
              index: true,
              admin: {
                description:
                  "hasMany on purpose: anthologies, co-authors. Order matters — first is the byline.",
              },
            },
            {
              name: "translator",
              type: "relationship",
              relationTo: "authors",
              admin: {
                description:
                  "Same collection, different role. NOTE: a public-domain original under an in-copyright translation is still in-copyright as published.",
              },
            },
            {
              name: "publisher",
              type: "relationship",
              relationTo: "publishers",
              index: true,
              admin: {
                description: "Nullable: public-domain texts you typeset yourself have none.",
              },
            },
            {
              name: "categories",
              type: "relationship",
              relationTo: "categories",
              hasMany: true,
              admin: {
                description: "Every category shelf this book should appear on.",
              },
            },
            {
              name: "primaryCategory",
              type: "relationship",
              relationTo: "categories",
              required: true,
              admin: {
                description: "Drives the breadcrumb trail. Must also appear in categories above.",
              },
            },
            {
              // The series and its number are one thought, and the number is
              // meaningless without the series beside it.
              type: "row",
              fields: [
                {
                  name: "series",
                  type: "relationship",
                  relationTo: "series",
                  admin: {
                    description: "Leave empty for a standalone book.",
                  },
                },
                {
                  name: "seriesNumber",
                  type: "number",
                  admin: {
                    description: "হিমু #৭ — sorts the series page.",
                    condition: (data) => Boolean(data?.series),
                  },
                },
              ],
            },
            {
              // A NAMED group, and it stays named: the stored paths are
              // `bibliographic.isbn13` and friends, lib/data.ts reads them by
              // those names, and un-nesting it would be a migration. All that
              // changes here is where it renders — out of the 325px sidebar,
              // where a seven-field group containing a checksummed ISBN was
              // unusable, and into the main column, byte-identical.
              name: "bibliographic",
              type: "group",
              label: "Bibliographic details",
              admin: {
                description:
                  "The printed edition's own facts, used for the facts strip and the Book schema. All optional — but the ISBN is checksummed, so a typo is caught here rather than by Google.",
              },
              fields: [
                {
                  name: "isbn13",
                  type: "text",
                  label: "ISBN-13",
                  validate: ((value: string | null | undefined) => {
                    if (!value) return true;
                    const digits = value.replace(/[- ]/g, "");
                    if (!/^\d{13}$/.test(digits)) {
                      return "ISBN-13 is exactly 13 digits (ISBN-10 is not accepted — Google's book systems reject it).";
                    }
                    // Standard ISBN-13 checksum: alternating 1/3 weights.
                    const sum = digits
                      .split("")
                      .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
                    if (sum % 10 !== 0) return "Checksum failed — one of the digits is wrong.";
                    return true;
                  }) as Validate,
                },
                {
                  type: "row",
                  fields: [
                    { name: "firstPublished", type: "number", label: "First published (year)" },
                    { name: "editionYear", type: "number" },
                    { name: "pages", type: "number" },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "language",
                      type: "select",
                      defaultValue: "bn",
                      options: [
                        { value: "bn", label: "বাংলা" },
                        { value: "en", label: "English" },
                        { value: "ar", label: "আরবি" },
                        { value: "hi", label: "হিন্দি" },
                        { value: "other", label: "অন্যান্য" },
                      ],
                    },
                    {
                      name: "binding",
                      type: "select",
                      options: [
                        { value: "hardcover", label: "Hardcover" },
                        { value: "paperback", label: "Paperback" },
                      ],
                    },
                    { name: "weightGrams", type: "number" },
                  ],
                },
              ],
            },
          ],
        },

        /* ---------------- Rights: why this book is legal ---------------- */
        {
          label: "Rights",
          description:
            "The audit trail behind the rights tier in the sidebar. Everything here except the licence pair and the text source is logged-in-only: it is our legal reasoning about someone else's work. The licence and the source are the parts a reader is entitled to see, so those four fields are public.",
          fields: [
            {
              name: "rightsBasis",
              type: "textarea",
              label: "Rights basis",
              // Our own legal reasoning about someone else's work. Useful to a
              // moderator, and to nobody else — see the evidence block below for
              // why that means a field-level rule and not an admin condition.
              access: { read: authenticatedFieldRead },
              admin: {
                description:
                  'WHY it is distributable, one sentence: "শরৎচন্দ্র মৃত্যু ১৯৩৮, টেক্সট Bengali Wikisource থেকে, ID …". Required to publish any downloadable tier.',
                condition: (data) => Boolean(data?.rightsTier) && data?.rightsTier !== "in-copyright",
              },
            },
            {
              // Both halves of one citation: most CC licences require the
              // licence to be named AND linked, so a name without a URL is a
              // half-finished attribution. Side by side, that is obvious.
              type: "row",
              fields: [
                {
                  name: "licenceName",
                  type: "text",
                  label: "Licence name",
                  admin: {
                    description: 'Tier B: the licence to attribute, e.g. "CC BY-SA 4.0".',
                    condition: (data) => data?.rightsTier === "open-licence",
                  },
                },
                {
                  name: "licenceUrl",
                  type: "text",
                  label: "Licence URL",
                  admin: {
                    description: "Links the licence name on the public page.",
                    condition: (data) => data?.rightsTier === "open-licence",
                  },
                  validate: ((value: string | null | undefined) => {
                    if (!value) return true;
                    if (!isSafeHttpUrl(value)) return "Enter a full http:// or https:// URL.";
                    return true;
                  }) as Validate,
                },
              ],
            },
            {
              /** WHERE THE TEXT CAME FROM, AND THE ONLY FIELD IN THIS TAB A
               *  READER SEES BY DEFAULT.
               *
               *  `rightsBasis` above already records the provenance, and cannot
               *  be the thing that shows it: it is `authenticatedFieldRead`
               *  because it mixes provenance with OUR legal reasoning about
               *  someone else's work. Splitting the citation out is what makes
               *  it publishable. A reader is owed where the text came from; they
               *  are not owed our reasoning, and we are not obliged to publish
               *  it.
               *
               *  Two things depend on this pair being public. Google's spam
               *  policy on Scraping names "republishing content from other sites
               *  without adding any original content or value, or even citing
               *  the original source" — an unattributed public-domain text is
               *  the exact shape it describes, however lawful the copying was.
               *  And a published blog post already promises readers that every
               *  book page says why the book is public domain. Until this field
               *  existed, no page could keep that promise. */
              type: "row",
              fields: [
                {
                  name: "textSourceName",
                  type: "text",
                  label: "Text source",
                  admin: {
                    description:
                      'Where this text was transcribed from, in Bengali, as the reader should see it: "বাংলা উইকিসংকলন", "ইন্টারনেট আর্কাইভ". Public. Fill it in for any book whose text or PDF we serve.',
                    condition: (data) => data?.rightsTier !== "in-copyright",
                  },
                },
                {
                  name: "textSourceUrl",
                  type: "text",
                  label: "Text source URL",
                  admin: {
                    description:
                      "Deep link to the source page for THIS book, not the site's front page. Links the source name on the public page.",
                    condition: (data) => data?.rightsTier !== "in-copyright",
                  },
                  validate: ((value: string | null | undefined) => {
                    if (!value) return true;
                    if (!isSafeHttpUrl(value)) return "Enter a full http:// or https:// URL.";
                    return true;
                  }) as Validate,
                },
              ],
            },
            {
              name: "rightsEvidence",
              type: "array",
              label: "Permission evidence",
              /** THE AUDIT TRAIL FOR TIER C, AND THE MOST SENSITIVE BLOCK IN THE
               *  SCHEMA. A rights holder's name, their email address, the text of
               *  their private email, and the signed permission document — third
               *  party personal data, held because a takedown notice may one day have
               *  to be answered with it.
               *
               *  `admin.condition` below hides this in the editing UI when the tier
               *  is not `permitted`. That is ALL it does: the values stayed in the
               *  document and shipped in full to anyone who called
               *  `GET /api/books?limit=100`, because books are (and must remain)
               *  publicly readable. Only field-level read access removes a field from
               *  an otherwise public document, so that is what this is. */
              access: { read: authenticatedFieldRead },
              admin: {
                initCollapsed: true,
                description:
                  "For permitted tier: date, contact, scope, pasted email text, optional uploaded permission document. Never served publicly — logged-in users only.",
                condition: (data) => data?.rightsTier === "permitted",
              },
              fields: [
                {
                  name: "date",
                  type: "date",
                  required: true,
                  access: { read: authenticatedFieldRead },
                },
                // The rule on the array already drops all of this, and Payload never
                // even walks in here once the parent is denied. These are restated on
                // EVERY field, not just the two carrying a third party's personal
                // data, so the rule travels WITH the field: the day one of them is
                // lifted out of the array into a group, a tab, or its own collection,
                // it arrives already closed rather than newly public. It also means
                // the invariant holds without depending on what Payload does to a
                // denied array — over the wire it leaves the key behind as `[]`
                // rather than deleting it, and a version that left the rows behind
                // instead would still leak nothing from in here.
                {
                  name: "contact",
                  type: "text",
                  required: true,
                  access: { read: authenticatedFieldRead },
                },
                { name: "scope", type: "text", access: { read: authenticatedFieldRead } },
                {
                  name: "emailText",
                  type: "textarea",
                  access: { read: authenticatedFieldRead },
                },
                {
                  name: "document",
                  type: "upload",
                  label: "Permission document",
                  // NOT `media`. Media is served from a public R2 bucket with
                  // `disablePayloadAccessControl`, which makes every object in it a
                  // permanent unauthenticated URL — a signed permission letter put
                  // there is public the moment it is uploaded, whatever this field's
                  // access rule says, because the URL bypasses Payload entirely.
                  // `evidence-files` is a separate collection on a separate bucket
                  // whose bytes are served THROUGH Payload's access control.
                  relationTo: "evidence-files",
                  access: { read: authenticatedFieldRead },
                  admin: {
                    description:
                      "Upload the signed permission letter / screenshot here. Stored in the private evidence bucket, not in Media.",
                  },
                },
              ],
            },
            {
              name: "rightsReviewedBy",
              type: "relationship",
              relationTo: "users",
              // Who on staff signed this off. Internal accountability; also the one
              // field on Books that would otherwise expose a `users` document
              // (id, name, email) to an anonymous reader through depth population.
              access: { read: authenticatedFieldRead },
              admin: {
                readOnly: true,
                description:
                  "Set automatically when the book is published. Accountability, not decoration.",
              },
            },
            {
              name: "takedownStatus",
              type: "select",
              defaultValue: "none",
              options: [
                { value: "none", label: "None" },
                { value: "notice-received", label: "Notice received" },
                { value: "removed", label: "Removed" },
              ],
              // "notice-received" is a description of this site's live legal
              // exposure. It is nobody's business but ours which books are
              // currently under complaint, and publishing that list invites
              // the rest.
              access: { read: authenticatedFieldRead },
              admin: {
                description:
                  '"Removed" blocks re-publishing until cleared. Takedown handling: acknowledge fast, remove fast, log everything.',
              },
            },
          ],
        },
        /* ---------------- Files: what the reader gets ---------------- */
        {
          label: "Files",
          description:
            "The cover, and the file the page delivers. Everything but the cover is hidden while the rights tier is কপিরাইটকৃত, and the publish hook refuses the book outright if a file is attached anyway.",
          fields: [
            {
              name: "cover",
              type: "upload",
              relationTo: "media",
              filterOptions: { mimeType: { contains: "image" } },
              admin: {
                description:
                  "প্রচ্ছদ (portrait, ~2:3)। Without one, the site falls back to /default-cover.svg on the page and the generated OG image for social previews.",
              },
            },
            {
              name: "pdf",
              type: "upload",
              relationTo: "media",
              label: "PDF ফাইল",
              filterOptions: { mimeType: { contains: "pdf" } },
              admin: {
                description:
                  "শুধুমাত্র Tier A/B/C বইয়ের জন্য। কপিরাইটকৃত বইতে ফাইল থাকলে বইটি প্রকাশ করা যাবে না — এটি hook দিয়ে আটকানো আছে।",
                condition: (data) => data?.rightsTier !== "in-copyright",
              },
            },
            {
              name: "pdfExternalUrl",
              type: "text",
              label: "…or an external PDF link",
              admin: {
                description:
                  "Only for a PDF hosted somewhere else you have verified is legal (Wikisource, a publisher's own free release). The uploaded file above always wins if both are set.",
                condition: (data) => data?.rightsTier !== "in-copyright" && !data?.pdf,
              },
              // React does not sanitize href values, so a pasted `javascript:` URL
              // would execute on click. lib/data.ts checks again at build time
              // (defence in depth); rejecting here means the editor finds out
              // immediately.
              validate: ((value: string | null | undefined) => {
                if (!value) return true;
                if (!isSafeHttpUrl(value)) return "Enter a full http:// or https:// URL.";
                return true;
              }) as Validate,
            },
            {
              // Both describe the same file and both appear on the same
              // download button, so they are entered together or not at all.
              type: "row",
              fields: [
                {
                  name: "pdfPages",
                  type: "number",
                  admin: {
                    description: "PDF-র পৃষ্ঠাসংখ্যা — ডাউনলোড বাটনে দেখানো হয়।",
                    condition: (data) => Boolean(data?.pdf || data?.pdfExternalUrl),
                  },
                },
                {
                  name: "pdfSizeBytes",
                  type: "number",
                  admin: {
                    description:
                      "ফাইলের আকার (bytes) — বাটনে MB হিসেবে দেখানো হয়, যাতে কেউ মোবাইল ডেটায় ৯০ MB অন্ধভাবে না নামায়।",
                    condition: (data) => Boolean(data?.pdf || data?.pdfExternalUrl),
                  },
                },
              ],
            },
            {
              name: "epub",
              type: "upload",
              relationTo: "media",
              label: "EPUB (optional)",
              admin: {
                description: "Same rights rule as the PDF. Offered alongside it when present.",
                condition: (data) => data?.rightsTier !== "in-copyright",
              },
            },
          ],
        },
        /* ---------------- Buying: where a printed copy comes from ---------------- */
        {
          label: "Buying",
          description:
            "Where a reader buys the printed book. Prices are a snapshot you took, not a feed — the page hides a figure older than 60 days rather than quoting a stale one.",
          fields: [
            {
              name: "rokomariUrl",
              type: "text",
              label: "Rokomari product URL",
              admin: {
                description:
                  "PLAIN product URL only, e.g. https://www.rokomari.com/book/1336/shunno — the affiliate parameters are appended at render time from env, never stored. When the program changes you edit one file, not every book.",
              },
              validate: ((value: string | null | undefined) => {
                if (!value) return true;
                if (!isSafeHttpUrl(value)) return "Enter a full http:// or https:// URL.";
                try {
                  const u = new URL(value);
                  if (
                    /(^|\.)rokomari\.com$/i.test(u.hostname) &&
                    (u.searchParams.has("affId") || u.searchParams.has("affs"))
                  ) {
                    return "Paste the PLAIN product URL without affId/affs — affiliate parameters are added automatically at render time.";
                  }
                } catch {
                  /* isSafeHttpUrl already validated */
                }
                return true;
              }) as Validate,
            },
            {
              // Sale price beside list price, because the only reason to record
              // the second is to sit next to the first.
              type: "row",
              fields: [
                {
                  name: "priceBdt",
                  type: "number",
                  label: "দাম (৳)",
                  admin: { description: "Rokomari-তে সর্বশেষ দেখা বিক্রয়মূল্য।" },
                },
                {
                  name: "mrpBdt",
                  type: "number",
                  label: "মুদ্রিত মূল্য (৳)",
                  admin: {
                    description: "শুধু নিজে দেখে থাকলে দিন — কখনো ডিসকাউন্ট বানিয়ে দেখানো হয় না।",
                  },
                },
              ],
            },
            {
              name: "priceCheckedAt",
              type: "date",
              admin: {
                date: { pickerAppearance: "dayOnly" },
                description:
                  "দাম কবে যাচাই করা হয়েছে। ৬০ দিনের বেশি পুরোনো হলে পেজে সংখ্যার বদলে “দাম দেখুন” দেখানো হয় — নিয়মটা কম্পোনেন্টে, সম্পাদকের স্মৃতিতে নয়।",
              },
            },
            {
              name: "stockStatus",
              type: "select",
              options: [
                { value: "in-stock", label: "In stock" },
                { value: "out-of-stock", label: "Out of stock" },
                { value: "preorder", label: "Preorder" },
              ],
              admin: { description: "Only claim stock you have checked." },
            },
            {
              name: "otherStores",
              type: "array",
              label: "অন্যান্য দোকান",
              labels: { singular: "Store", plural: "Stores" },
              admin: {
                initCollapsed: true,
                description: "Any other shop that stocks this edition. Rokomari above is the primary.",
              },
              fields: [
                { name: "name", type: "text", required: true },
                {
                  name: "url",
                  type: "text",
                  required: true,
                  validate: ((value: string | null | undefined) => {
                    if (!value) return "URL is required.";
                    if (!isSafeHttpUrl(value)) return "Enter a full http:// or https:// URL.";
                    return true;
                  }) as Validate,
                },
                { name: "price", type: "number" },
              ],
            },
          ],
        },
        /* ---------------- Performance: what happened next ---------------- */
        {
          label: "Performance",
          description:
            "Read-only. Every figure here is denormalised by a hook — the download beacon and the Reviews afterChange — so typing over one only makes the panel disagree with the site until the next write.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "downloadCount",
                  type: "number",
                  defaultValue: 0,
                  admin: {
                    readOnly: true,
                    description: "Updated by the download beacon, not by editors.",
                  },
                },
                {
                  name: "ratingAverage",
                  type: "number",
                  admin: {
                    readOnly: true,
                    description: "Denormalised from approved reviews. Never hand-edited.",
                  },
                },
                {
                  name: "ratingCount",
                  type: "number",
                  defaultValue: 0,
                  admin: {
                    readOnly: true,
                    description: "How many approved reviews the average is built from.",
                  },
                },
              ],
            },
            {
              // List-view only: a `ui` field with a Cell and no Field renders
              // nothing here, and it lives inside a tab because
              // flattenTopLevelFields hoists unnamed tabs with
              // keepPresentationalFields, so `defaultColumns` still finds it.
              name: "engagement",
              type: "ui",
              label: "Engagement",
              admin: {
                components: {
                  Cell: "/components/payload/list/EngagementCell#default",
                },
              },
            },
          ],
        },
      ],
    },
    /* ---------------- THE SIDEBAR: "is this live, and may it be?" ----------------
     *
     * Six fields, and each one earns its place by being needed on EVERY tab.
     * The twenty-three that used to be here are all above, next to the work
     * they belong to. */
    {
      name: "previewLinks",
      type: "ui",
      admin: {
        position: "sidebar",
        components: {
          Field: "/components/payload/PreviewLinks#default",
        },
      },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description:
          "URL segment — /book/opekkha. Lowercase letters, numbers and hyphens only. Changing this after publishing breaks every existing link, so treat it as permanent.",
      },
      validate: slugValidator,
    },
    {
      name: "rightsTier",
      type: "select",
      required: true,
      // NO DEFAULT, on purpose: an editor must choose. A default of
      // "in-copyright" sounds safe but silently hides the decision; a
      // default of anything else is a liability.
      options: RIGHTS_TIERS.map((value) => ({
        value,
        label: `${getRightsTierLabel(value)} (${value})`,
      })),
      index: true,
      admin: {
        position: "sidebar",
        description:
          "The compliance gate — the Rights tab holds the evidence for whatever you pick here. public-domain: লেখকের মৃত্যুর ৬০ বছর পার (বাংলাদেশ আইন)। open-licence: CC বা প্রকাশকের উন্মুক্ত লাইসেন্স। permitted: লিখিত অনুমতি ফাইলে আছে। in-copyright: বাকি সব — কোনো PDF নয়, কখনোই।",
        components: {
          // In the list this is a tinted pill rather than the raw select value,
          // because scanning a page of books for the one that may not carry a
          // PDF should not require reading four hyphenated words per row.
          Cell: "/components/payload/list/RightsTierCell#default",
        },
      },
    },
    {
      name: "publishDate",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description:
          "A future date holds the book back even after publishing — the daily cron brings it live once the date passes.",
      },
    },
    {
      name: "popular",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description:
          'Hand-picks this book for the "জনপ্রিয়" rail. With nothing flagged, that rail falls back to most recent.',
      },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Eligible for the homepage hero shelf.",
      },
    },
  ],
};

export default Books;

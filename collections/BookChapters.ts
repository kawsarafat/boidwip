import type { CollectionConfig, Validate } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publishedOrAuthenticated } from "../lib/payload/access";
import { rebuildOnDelete, rebuildOnPublish } from "../lib/payload/revalidate";
import { getRightsTierLabel, isRightsTier, tierAllowsOnlineReading } from "../lib/types";

/** BookChapters — the online reader, and the biggest SEO asset on the site
 *  (plan §5.7, §9.4).
 *
 *  One document per chapter of a Tier A (public-domain) full text. A PDF is
 *  a nearly opaque document to a search engine and a terrible experience on
 *  a phone; a 40-chapter Tagore novel published as HTML is 40 indexable
 *  pages of genuinely valuable, entirely legal Bengali literary text — each
 *  carrying a buy button shown to the most committed readers a book site
 *  will ever have (someone on chapter 30 of 40 has demonstrated more intent
 *  than any other signal).
 *
 *  THE RIGHTS COUPLING: chapters may only ever belong to a book whose tier
 *  allows full text — Tier A (public-domain) and Tier B (open-licence) only,
 *  the question `tierAllowsOnlineReading()` in lib/types.ts answers for every
 *  caller. Tier C ("permitted") is excluded on purpose: that permission covers
 *  distributing a PDF, not republishing the work as HTML on our own domain.
 *  The validation below refuses to attach a chapter to a book outside those two
 *  tiers, and Books' own beforeValidate refuses to publish a book outside them
 *  that has chapters — both directions are guarded, so neither an editor nor a
 *  REST call can create the illegal combination, in either order. */
export const BookChapters: CollectionConfig = {
  slug: "book-chapters",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "book", "chapterNumber", "_status"],
    group: "Catalogue",
    description:
      "One document per chapter of a full text we may legally republish, each its own page at /book/<book>/read/<chapter>. Only public-domain and open-licence books accept chapters — permitted does not, because permission to hand out a PDF is not permission to republish the work as HTML here.",
    listSearchableFields: ["title", "slug"],
  },

  versions: {
    drafts: true,
    maxPerDoc: 20,
  },

  // The public URL is /book/<book>/read/<slug>, so a chapter slug only has to
  // be unique WITHIN a book. Two books may both legitimately have a
  // "prothom-porichchhed". Enforced by Postgres, not just application code.
  indexes: [{ fields: ["book", "slug"], unique: true }],

  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    readVersions: authenticated,
  },

  hooks: {
    beforeValidate: [
      /** The rights guard from the chapter's side: a chapter cannot attach
       *  to a book whose tier forbids full text. Checked on the API layer so
       *  a REST call cannot bypass it either.
       *
       *  THE BOOK ID IS MERGED WITH THE STORED DOCUMENT, not read off `data`.
       *  `data` in beforeValidate is the incoming PATCH: `PATCH
       *  /api/book-chapters/<id> {"_status":"published"}` carries no `book`
       *  field at all, so the original `if (!data?.book) return data` handed
       *  every publish straight through — including the publish of a chapter
       *  whose book had since been reclassified to in-copyright. The guard
       *  only means something if it runs on the document that results.
       *
       *  The tier test is `tierAllowsOnlineReading`, not a hand-written pair
       *  of comparisons. The two used to be written out separately here and in
       *  lib/data.ts and disagreed about `permitted`, so a Tier C book with
       *  chapters was refused by the CMS and rendered by the site. */
      async ({ data, req, originalDoc }) => {
        const incomingBook = data?.book;
        const bookRef = incomingBook !== undefined ? incomingBook : originalDoc?.book;
        if (!bookRef || !req?.payload) return data;
        const bookId = typeof bookRef === "object" ? bookRef?.id : bookRef;
        if (!bookId) return data;
        const book = await req.payload.findByID({
          collection: "books",
          id: bookId,
          depth: 0,
          overrideAccess: true,
        });
        if (book && !tierAllowsOnlineReading(String(book.rightsTier ?? ""))) {
          const label = isRightsTier(book.rightsTier)
            ? getRightsTierLabel(book.rightsTier)
            : String(book.rightsTier ?? "unset");
          throw new Error(
            `রিডার-অধ্যায় শুধুমাত্র public-domain বা open-licence বইয়ে যুক্ত করা যায় — এই বইটির টিয়ার (${label}) তা অনুমোদন করে না। “অনুমতিপ্রাপ্ত” টিয়ারে অনুমতি PDF বিতরণের, নিজের ডোমেইনে পূর্ণ টেক্সট প্রকাশের নয়।`,
          );
        }
        return data;
      },
    ],
    afterChange: [rebuildOnPublish],
    afterDelete: [rebuildOnDelete],
  },

  /** FIVE FIELDS, so no tabs: the chapter body wants the whole main column and
   *  everything else is a one-line answer. The only change here is that the two
   *  numbers now sit on one line — they are both "where does this chapter fall",
   *  and stacked they looked like two unrelated settings. */
  fields: [
    // ---------------- main column ----------------
    {
      name: "title",
      type: "text",
      required: true,
      admin: {
        description: 'অধ্যায়ের শিরোনাম, e.g. "প্রথম পরিচ্ছেদ" or the chapter\'s own name.',
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      editor: contentEditor,
      admin: {
        description:
          "অধ্যায়ের সম্পূর্ণ টেক্সট। Source and fidelity note goes in the book's rightsBasis, not here.",
      },
    },

    // ---------------- sidebar ----------------
    {
      name: "book",
      type: "relationship",
      relationTo: "books",
      required: true,
      index: true,
      admin: {
        position: "sidebar",
        description:
          "Which book this chapter belongs to. Saving against a book whose rights tier forbids full text is refused, in both directions.",
      },
    },
    {
      type: "row",
      admin: { position: "sidebar" },
      fields: [
        {
          name: "chapterNumber",
          type: "number",
          required: true,
          admin: {
            description: "Orders the reader navigation. 1-based.",
          },
        },
        {
          name: "wordCount",
          type: "number",
          admin: {
            description: "Shown as reading time.",
          },
        },
      ],
    },
    {
      name: "slug",
      type: "text",
      required: true,
      admin: {
        position: "sidebar",
        description:
          "URL segment: /book/<book>/read/<slug>. Lowercase letters, numbers and hyphens only. Unique within the book.",
      },
      validate: (async (
        value: string | null | undefined,
        { req, data, id }: { req?: any; data?: any; id?: string | number },
      ) => {
        if (!value) return "Slug is required.";
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Use lowercase letters, numbers and hyphens only (no spaces, no capitals, no Bengali characters).";
        }
        // The compound unique index in Postgres is the real guarantee; this
        // reports the clash as a readable field error instead of a raw
        // constraint violation.
        const book = data?.book;
        if (!req?.payload || !book) return true;
        const bookId = typeof book === "object" ? book?.id : book;
        if (!bookId) return true;
        const existing = await req.payload.find({
          collection: "book-chapters",
          where: {
            and: [
              { slug: { equals: value } },
              { book: { equals: bookId } },
              ...(id ? [{ id: { not_equals: id } }] : []),
            ],
          },
          limit: 1,
          depth: 0,
          draft: true,
          overrideAccess: true,
        });
        if (existing?.totalDocs > 0) {
          return "Another chapter of this book already uses this slug.";
        }
        return true;
      }) as Validate,
    },
  ],
};

export default BookChapters;

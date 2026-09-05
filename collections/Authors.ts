import type { CollectionConfig, Validate } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publicRead } from "../lib/payload/access";
import { rebuildAlways, rebuildOnDelete } from "../lib/payload/revalidate";
import { isSafeHttpUrl } from "../lib/types";

/** Authors — the primary entity hub of the catalogue (plan §5.2).
 *
 *  `deathYear` is not decoration: it is the input to the rights-tier
 *  arithmetic in lib/rights.ts (deathYear + 60 < currentYear is the
 *  Bangladesh public-domain test), computed and shown in the admin next to
 *  every book by that author. One field turning a legal question into a
 *  visible number is most of what makes the tier system operable at scale.
 *
 *  No drafts (authors are structure, not content) — so hooks use
 *  rebuildAlways: a publish-boundary check on a collection without
 *  `_status` would silently never fire, a known Payload trap this codebase
 *  documents for draft-less collections.
 *
 *  TWO TABS, because an author record answers two different questions: what
 *  do we call this person and what have we written about them (Profile), and
 *  what are the facts a rights decision and a Person JSON-LD node need
 *  (Life and works). Both tabs are unnamed, so no stored path changes. */

const slugValidator: Validate = async (
  value: string | null | undefined,
  { req, id }: { req?: any; id?: string | number },
) => {
  if (!value) return "Slug is required.";
  if (!/^[a-z0-9-]+$/.test(value)) {
    return "Use lowercase letters, numbers and hyphens only (no spaces, no capitals, no Bengali characters).";
  }
  if (!req?.payload) return true;
  const existing = await req.payload.find({
    collection: "authors",
    where: {
      and: [{ slug: { equals: value } }, ...(id ? [{ id: { not_equals: id } }] : [])],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing?.totalDocs > 0) return "Another author already uses this slug.";
  return true;
};

export const Authors: CollectionConfig = {
  slug: "authors",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "deathYear", "bookCount", "featured"],
    group: "Taxonomy",
    description:
      "One record per writer, and the hub page every byline links to. Death year is the field that matters most: death + 60 years is the Bangladesh public-domain test, so filling it in is what lets a book be classified at all.",
    listSearchableFields: ["name", "nameLatin"],
  },

  access: {
    // Authors are always public — they are navigation structure, and hiding
    // them would break every byline on the site.
    read: publicRead,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },

  hooks: {
    afterChange: [rebuildAlways],
    afterDelete: [rebuildOnDelete],
  },

  fields: [
    {
      type: "tabs",
      tabs: [
        /* ---------------- Profile: who they are ---------------- */
        {
          label: "Profile",
          description:
            "The names readers search for, and the biography that makes this page worth indexing. Under 100 words with fewer than two books, the page stays noindex on purpose.",
          fields: [
            {
              // Bengali name and transliteration are one decision, typed one
              // after the other.
              type: "row",
              fields: [
                {
                  name: "name",
                  type: "text",
                  required: true,
                  admin: { description: "বাংলা নাম — হুমায়ূন আহমেদ।" },
                },
                {
                  name: "nameLatin",
                  type: "text",
                  label: "Name (Latin)",
                  admin: {
                    description: '"Humayun Ahmed" — feeds Banglish search and the OG card.',
                  },
                },
              ],
            },
            {
              name: "nameAliases",
              type: "array",
              label: "নামের বিকল্প বানান",
              labels: { singular: "Spelling", plural: "Spellings" },
              admin: {
                initCollapsed: true,
                description:
                  'হুমায়ূন আহমেদ is also searched as "হুমায়ুন আহমেদ", "humayun ahmed" — this array is what makes the site findable.',
              },
              fields: [{ name: "alias", type: "text", required: true }],
            },
            {
              name: "bio",
              type: "richText",
              editor: contentEditor,
              admin: {
                description:
                  "জীবনী — নিজের ভাষায়, উইকিপিডিয়ার কপি নয়। ১০০ শব্দের কম ও ২টির কম বই হলে পেজটি noindex থাকে।",
              },
            },
            {
              // Out of the 325px sidebar: an upload widget needs room to show
              // the thumbnail it just accepted.
              name: "photo",
              type: "upload",
              relationTo: "media",
              filterOptions: { mimeType: { contains: "image" } },
              admin: {
                description: "Portrait, optional. Used on the author page and in Person JSON-LD.",
              },
            },
          ],
        },
        /* ---------------- Life and works: the facts ---------------- */
        {
          label: "Life and works",
          description:
            "Dates, place, and the outbound links that back this page up. Death year drives the rights arithmetic, so it is the one field here with legal weight.",
          fields: [
            {
              // The two years are one fact — a lifespan — and reading them on
              // one line is how you notice a typo in either.
              type: "row",
              fields: [
                {
                  name: "birthYear",
                  type: "number",
                  admin: { description: "Year only. Approximate is better than empty." },
                },
                {
                  name: "deathYear",
                  type: "number",
                  admin: {
                    description:
                      "মৃত্যুসাল — খালি মানে জীবিত। এটি রাইটস-টিয়ার অ্যাসিস্ট্যান্টের ইনপুট: মৃত্যু + ৬০ বছর < বর্তমান বছর হলে পাবলিক ডোমেইন।",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "birthPlace",
                  type: "text",
                  admin: { description: "District or city, as it would be written in Bengali." },
                },
                {
                  name: "nationality",
                  type: "text",
                  admin: { description: "Feeds Person JSON-LD." },
                },
              ],
            },
            {
              name: "notableWorks",
              type: "relationship",
              relationTo: "books",
              hasMany: true,
              admin: {
                description: "Hand-picked highlights shown first on the author page.",
              },
            },
            {
              name: "externalLinks",
              type: "array",
              label: "External links",
              labels: { singular: "Link", plural: "Links" },
              admin: {
                initCollapsed: true,
                description:
                  "Wikipedia, official site. Outbound authority links help E-E-A-T and feed Person JSON-LD sameAs.",
              },
              fields: [
                { name: "label", type: "text", required: true },
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
              ],
            },
          ],
        },
      ],
    },
    /* ---------------- sidebar: the URL and the two flags ---------------- */
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description: "URL segment — /author/humayun-ahmed. Treat as permanent once published.",
      },
      validate: slugValidator,
    },
    {
      name: "bookCount",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Denormalised — maintained by the Books hooks, never hand-edited.",
      },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Shown on the homepage author rail.",
      },
    },
  ],
};

export default Authors;

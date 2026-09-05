import type { CollectionConfig, Validate } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publishedOrAuthenticated } from "../lib/payload/access";
import { rebuildOnDelete, rebuildOnPublish } from "../lib/payload/revalidate";

/** Lists — curated collections and buying guides (plan §13.3): "১০টি সেরা
 *  মুক্তিযুদ্ধের বই", "ক্লাস এইটের জন্য গণিত গাইড". These convert at 3–5×
 *  a book page because a reader arriving at a list has already decided to
 *  buy SOMETHING — the list's job is to help them choose which.
 *
 *  Each entry is a book plus an editor's note on WHY it is on the list; the
 *  note is the value, the list is just the shape. A list with empty notes
 *  is a thin page and the validation refuses it. */

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
    collection: "lists",
    where: {
      and: [{ slug: { equals: value } }, ...(id ? [{ id: { not_equals: id } }] : [])],
    },
    limit: 1,
    depth: 0,
    draft: true,
    overrideAccess: true,
  });
  if (existing?.totalDocs > 0) return "Another list already uses this slug.";
  return true;
};

export const Lists: CollectionConfig = {
  slug: "lists",
  // The nav label. It read "Lists (lists)" — the slug leaking into the plural,
  // which is what the sidebar printed.
  labels: { singular: "Reading list", plural: "Reading lists" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "publishDate", "_status"],
    group: "Editorial",
    description:
      "Curated lists and buying guides — the best-converting page type on the site, because a reader who opens one has already decided to buy something. Each entry needs a note saying why the book is on the list; three entries is the minimum and the note is the whole value.",
    listSearchableFields: ["title", "slug"],
  },

  versions: {
    drafts: true,
    maxPerDoc: 20,
  },

  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    readVersions: authenticated,
  },

  hooks: {
    afterChange: [rebuildOnPublish],
    afterDelete: [rebuildOnDelete],
  },

  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: { description: 'তালিকার শিরোনাম — "১০টি সেরা মুক্তিযুদ্ধের বই"।' },
    },
    {
      name: "intro",
      type: "richText",
      required: true,
      editor: contentEditor,
      admin: {
        description:
          "ভূমিকা: কে এই তালিকাটি চাইবে, বাছাইয়ের মানদণ্ড কী। এটিই পেজকে র‍্যাংক করায়।",
      },
    },
    {
      name: "entries",
      type: "array",
      required: true,
      minRows: 3,
      labels: { singular: "Book", plural: "Books" },
      admin: {
        description: "ক্রম অনুযায়ী বই — প্রতিটির সাথে কেন-এই-বইটি নোট।",
      },
      fields: [
        {
          name: "book",
          type: "relationship",
          relationTo: "books",
          required: true,
        },
        {
          name: "note",
          type: "richText",
          required: true,
          editor: contentEditor,
          admin: {
            description: "কেন এই বইটি তালিকায় — নোটটাই পেজের মূল্য, তালিকাটা শুধু কাঠামো।",
          },
        },
      ],
    },

    {
      // Out of the rail: the list's own artwork, judged at a size the sidebar
      // does not have.
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      filterOptions: { mimeType: { contains: "image" } },
      admin: {
        description: "Optional header image for the list page and the guides rail.",
      },
    },

    // ---------------- sidebar ----------------
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description: "URL segment — /list/muktijuddho-shera-boighor.",
      },
      validate: slugValidator,
    },
    {
      name: "publishDate",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description: "A future date holds the list back until it passes.",
      },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Shown on the homepage guides rail.",
      },
    },
  ],
};

export default Lists;

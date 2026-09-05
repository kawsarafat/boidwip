import type { CollectionConfig, Validate } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publicRead } from "../lib/payload/access";
import { rebuildAlways, rebuildOnDelete } from "../lib/payload/revalidate";

/** Series (plan §5.5) — quietly one of the best-converting page types on a
 *  book site: someone who has read হিমু #3 wants #4, in order, and will buy
 *  it. The series page sorts by the books' own `seriesNumber` and marks
 *  which entries we have and which we do not. */

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
    collection: "series",
    where: {
      and: [{ slug: { equals: value } }, ...(id ? [{ id: { not_equals: id } }] : [])],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing?.totalDocs > 0) return "Another series already uses this slug.";
  return true;
};

export const Series: CollectionConfig = {
  slug: "series",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "author", "bookCount"],
    group: "Taxonomy",
    description:
      "A named run of books — হিমু, মিসির আলি, ফেলুদা. You do not add books here: each book joins by setting its own series and series number, and this page sorts by that number.",
    listSearchableFields: ["name", "nameLatin"],
  },

  access: {
    read: publicRead,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },

  hooks: {
    afterChange: [rebuildAlways],
    afterDelete: [rebuildOnDelete],
  },

  /** Seven fields: no tab strip, one row, and the cover out of the rail. */
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          admin: { description: "বাংলা নাম — হিমু।" },
        },
        {
          name: "nameLatin",
          type: "text",
          label: "Name (Latin)",
          admin: { description: '"Himu" — feeds Banglish search.' },
        },
      ],
    },
    {
      name: "description",
      type: "richText",
      editor: contentEditor,
      admin: {
        description:
          "What holds the run together — the recurring character, the setting, the order to read it in. A series page with no text is a list of covers.",
      },
    },
    {
      // Out of the 325px sidebar: this is artwork, and artwork is judged at a
      // size the rail does not have.
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      filterOptions: { mimeType: { contains: "image" } },
      admin: {
        description: "Optional image for the series page header and the series rail.",
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
        description: "URL segment — /series/himu.",
      },
      validate: slugValidator,
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "authors",
      admin: {
        position: "sidebar",
        description: "The writer of the run. Leave empty for a multi-author series.",
      },
    },
    {
      name: "bookCount",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Denormalised — maintained by hooks, never hand-edited.",
      },
    },
  ],
};

export default Series;

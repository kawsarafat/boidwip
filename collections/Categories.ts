import type { CollectionConfig, Validate } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publicRead } from "../lib/payload/access";
import { rebuildAlways, rebuildOnDelete } from "../lib/payload/revalidate";

/** Categories — genres and subjects (plan §5.4).
 *
 *  KEEP THE TREE SHALLOW: two levels (উপন্যাস › ঐতিহাসিক উপন্যাস), enforced
 *  below. Three-level genre trees produce pages with four books on them,
 *  which is thin content by another name.
 *
 *  `description` is a richText and should be a real 150-word introduction,
 *  not a sentence — it is what makes a genre page rank instead of being a
 *  bare grid. */

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
    collection: "categories",
    where: {
      and: [{ slug: { equals: value } }, ...(id ? [{ id: { not_equals: id } }] : [])],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing?.totalDocs > 0) return "Another category already uses this slug.";
  return true;
};

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "parent", "order", "featured"],
    group: "Taxonomy",
    description:
      "The genre shelves, at most two levels deep (উপন্যাস › ঐতিহাসিক উপন্যাস) — a third level is refused on save. The description is not a caption: a genre page ranks on a real ~150-word introduction and stays a bare grid without one.",
    listSearchableFields: ["name", "nameLatin"],
  },

  access: {
    read: publicRead,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },

  hooks: {
    beforeValidate: [
      /** The two-level rule: a category whose parent itself has a parent is
       *  the third level, and it is refused here rather than discovered as a
       *  thin page after launch. */
      async ({ data, req, originalDoc }) => {
        if (!data?.parent || !req?.payload) return data;
        const parentId = typeof data.parent === "object" ? data.parent?.id : data.parent;
        if (!parentId) return data;
        // `originalDoc` first: `data.id` is absent on virtually every update
        // (the id travels in the URL, not the payload), so a check written
        // against `data.id` alone never fires on the operation it is meant to
        // guard — the same trap that made the book/chapter check in
        // collections/Books.ts inert.
        const selfId = originalDoc?.id ?? data.id;
        if (selfId && String(parentId) === String(selfId)) {
          throw new Error("A category cannot be its own parent.");
        }
        const parent = await req.payload.findByID({
          collection: "categories",
          id: parentId,
          depth: 0,
          overrideAccess: true,
        });
        if (parent?.parent) {
          throw new Error(
            "সর্বোচ্চ দুই স্তর: এই প্যারেন্ট ক্যাটাগরিটির নিজেরই একটি প্যারেন্ট আছে। তিন-স্তরের জনরা-ট্রি মানে চারটি বইয়ের পাতলা পেজ।",
          );
        }
        // A category that is itself a parent cannot be given a parent: that
        // would push its own children to level three by the back door,
        // which the check above cannot see because it only looks upwards.
        if (selfId) {
          const children = await req.payload.find({
            collection: "categories",
            where: { parent: { equals: selfId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          if (children?.totalDocs > 0) {
            throw new Error(
              "এই ক্যাটাগরির অধীনে সাব-ক্যাটাগরি আছে, তাই এটিকে অন্য কারও অধীনে নেওয়া যাবে না — নিলে তার সন্তানগুলো তৃতীয় স্তরে চলে যায়।",
            );
          }
        }
        return data;
      },
    ],
    afterChange: [rebuildAlways],
    afterDelete: [rebuildOnDelete],
  },

  /** EIGHT FIELDS, SO NO TABS. A tab strip over eight fields is furniture, not
   *  navigation. What this screen needed was the two names on one line and the
   *  icon out of a 325px rail it could not be judged in. */
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          admin: { description: "বাংলা নাম — উপন্যাস, কবিতা, ইসলামি বই।" },
        },
        {
          name: "nameLatin",
          type: "text",
          label: "Name (Latin)",
          admin: { description: '"Uponnash" — feeds Banglish search.' },
        },
      ],
    },
    {
      name: "description",
      type: "richText",
      editor: contentEditor,
      admin: {
        description:
          "এই জনরার সত্যিকারের ভূমিকা (~১৫০ শব্দ) — এটিই পেজটিকে র‍্যাংক করায়, খালি গ্রিড করায় না।",
      },
    },
    {
      // Was in the sidebar, where an upload widget has no room to show what it
      // accepted. Nothing about the stored value changes.
      name: "icon",
      type: "upload",
      relationTo: "media",
      filterOptions: { mimeType: { contains: "image" } },
      admin: {
        description: "Optional square image for the homepage category grid.",
      },
    },

    // ---------------- sidebar: the URL, the tree, the ordering ----------------
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description: "URL segment — /category/uponnash.",
      },
      validate: slugValidator,
    },
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories",
      admin: {
        position: "sidebar",
        description: "উপন্যাস › ঐতিহাসিক উপন্যাস। Two levels maximum — enforced on save.",
      },
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        description: "Sort order in navigation. Lower first.",
      },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Shown in the homepage category grid.",
      },
    },
  ],
};

export default Categories;

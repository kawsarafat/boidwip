import type { CollectionConfig, Validate } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publishedOrAuthenticated } from "../lib/payload/access";
import { rebuildOnDelete, rebuildOnPublish } from "../lib/payload/revalidate";
import { liveLinkField, wordCount } from "../lib/payload/fields";

/** BlogPosts — editorial articles at /blog/<slug>: author retrospectives,
 *  বইমেলা coverage, reading-culture pieces. Distinct from Lists (which is a
 *  structured list of books) — a blog post is prose that may REFERENCE
 *  books, and the referenced books render as a card rail beside the text. */

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
    collection: "blog-posts",
    where: {
      and: [{ slug: { equals: value } }, ...(id ? [{ id: { not_equals: id } }] : [])],
    },
    limit: 1,
    depth: 0,
    draft: true,
    overrideAccess: true,
  });
  if (existing?.totalDocs > 0) return "Another post already uses this slug.";
  return true;
};

export const BlogPosts: CollectionConfig = {
  slug: "blog-posts",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "publishDate", "_status", "liveLink"],
    group: "Editorial",
    description:
      "Prose at /blog/<slug> — author retrospectives, বইমেলা coverage, reading-culture pieces. Use a reading list instead when the piece is really a ranked set of books; a post is writing that happens to mention books, and the ones you link render as a rail beside the text.",
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
      admin: { description: "The headline, in Bengali. Also the <h1> and the SERP title." },
    },
    {
      name: "summary",
      type: "textarea",
      admin: {
        description: "Meta description and card text. ~120–160 characters.",
        // The figure that matters here is the CHARACTER count in the line above,
        // which the counter shows alongside words for plain-string fields. No
        // word target: Google truncates on width, not on words.
        components: wordCount(),
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      editor: contentEditor,
      admin: {
        description: "The article itself.",
        // 600 words is where a post stops competing with the thin round-ups this
        // site is trying to outrank. Advisory, and the tooltip says so; the count
        // itself is also what lib/render.ts stores as the post's wordCount.
        components: wordCount({
          target: 600,
          why: "Nothing blocks a shorter post, but under ~600 words it competes with the thin round-ups this site is meant to beat.",
        }),
      },
    },
    {
      // Out of the rail: an upload widget needs the room.
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      filterOptions: { mimeType: { contains: "image" } },
      admin: {
        description: "Header image, also used for the social card.",
      },
    },

    liveLinkField,
    // ---------------- sidebar ----------------
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description: "URL segment — /blog/boimela-2026.",
      },
      validate: slugValidator,
    },
    {
      name: "relatedBooks",
      type: "relationship",
      relationTo: "books",
      hasMany: true,
      admin: {
        position: "sidebar",
        description:
          'Books referenced by the post — rendered as the "এই লেখায় যে বইগুলো" rail. A draft book with nothing but a title can go here too: the post publishes, the book waits in the dashboard\'s Needs attention list, and its title and cover show in the rail without a link.',
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
        description: "A future date holds the post back until it passes.",
      },
    },
  ],
};

export default BlogPosts;

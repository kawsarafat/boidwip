import type { CollectionConfig } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publishedOrAuthenticated } from "../lib/payload/access";
import { rebuildOnDelete, rebuildOnPublish } from "../lib/payload/revalidate";
import { isReservedRouteSlug } from "../lib/types";
import { liveLinkField, wordCount } from "../lib/payload/fields";

// The reserved-slug list lives in lib/types.ts (RESERVED_ROUTE_SLUGS): it
// names every app-owned root segment AND every content-namespace prefix
// (book, author, publisher, category, series, list, search, blog, new,
// popular), so a page can never shadow a real route.

/** Standalone pages — About, Contact, Privacy Policy, Disclosure, DMCA.
 *
 *  These live at the site root (/about, /contact). No
 *  other collection shares the root URL space here (books live under /book,
 *  authors under /author, …), so the only collision to guard against is a
 *  page slug that matches an app route prefix — which the reserved-slug
 *  check below refuses at save time, because a static segment always beats
 *  [slug] in Next's matcher and the page would mysteriously never render. */
export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "updatedAt", "_status", "liveLink"],
    group: "Editorial",
    description:
      "The site's own fixed pages — About, Contact, Privacy Policy, Disclosure, DMCA — living at the top level, e.g. /about. A slug that collides with a route the app already owns is refused on save, because a static segment always wins in Next's matcher and the page would simply never appear.",
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
      name: "title",
      type: "text",
      required: true,
      admin: {
        description: "Shown as the page heading and in the browser tab.",
      },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          "URL segment — /about, /contact, /privacy-policy. Lowercase letters, numbers and hyphens only.",
      },
      validate: async (
        value: string | null | undefined,
        { req, id }: { req?: any; id?: string | number }
      ) => {
        if (!value) return "Slug is required.";
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Use lowercase letters, numbers and hyphens only (no spaces, no capitals).";
        }

        if (isReservedRouteSlug(value)) {
          return `"${value}" is a reserved URL used by the site itself. Choose a different slug.`;
        }

        // Uniqueness against other pages, reported as a readable error
        // rather than a raw constraint violation from the unique index.
        if (req?.payload) {
          const clash = await req.payload.find({
            collection: "pages",
            where: { slug: { equals: value } },
            limit: 1,
            depth: 0,
            draft: true,
            overrideAccess: true,
          });
          const other = clash?.docs?.[0];
          if (other && String(other.id) !== String(id ?? "")) {
            return `Another page already uses the slug "${value}".`;
          }
        }
        return true;
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      editor: contentEditor,
      // No target. These are About, Contact, Privacy Policy: a privacy policy is
      // as long as it needs to be, and a word quota on one would be theatre.
      admin: { components: wordCount() },
    },
    liveLinkField,
  ],
};

export default Pages;

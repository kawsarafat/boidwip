import type { CollectionConfig, Validate } from "payload";
import { contentEditor } from "../lib/payload/editor";
import { authenticated, publicRead } from "../lib/payload/access";
import { rebuildAlways, rebuildOnDelete } from "../lib/payload/revalidate";
import { isSafeHttpUrl } from "../lib/types";

/** Publishers — the second analogue of Subjects (plan §5.3).
 *
 *  Two fields the other taxonomy collections do not have:
 *   - `permissionStatus` turns the publisher-outreach effort (§14.4) from an
 *     inbox into a pipeline you can query: which publishers have we asked
 *     for distribution permission, who granted, who refused.
 *   - `rokomariPublisherUrl` — Rokomari has publisher pages; linking to them
 *     (affiliated at render time) from our publisher page converts, because
 *     someone browsing আফসার ব্রাদার্স is browsing, not searching.
 *
 *  `permissionStatus` is the one field that stays in the sidebar rather than
 *  moving into a tab, for the same reason `rightsTier` does on Books: it is
 *  the answer to "may we distribute anything of theirs", and an answer you
 *  have to go looking for is one you stop checking. */

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
    collection: "publishers",
    where: {
      and: [{ slug: { equals: value } }, ...(id ? [{ id: { not_equals: id } }] : [])],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing?.totalDocs > 0) return "Another publisher already uses this slug.";
  return true;
};

const urlValidator = ((value: string | null | undefined) => {
  if (!value) return true;
  if (!isSafeHttpUrl(value)) return "Enter a full http:// or https:// URL.";
  return true;
}) as Validate;

export const Publishers: CollectionConfig = {
  slug: "publishers",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "permissionStatus", "bookCount"],
    group: "Taxonomy",
    description:
      "One record per publishing house, and the hub page their books link to. Permission status is the outreach pipeline: only a publisher marked Granted can have books moved to the permitted rights tier, and the evidence still goes on the book.",
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

  fields: [
    {
      type: "tabs",
      tabs: [
        /* ---------------- Profile ---------------- */
        {
          label: "Profile",
          description:
            "What the house is called and what it publishes. The about text is what keeps this hub page out of thin-content territory.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "name",
                  type: "text",
                  required: true,
                  admin: { description: "বাংলা নাম — আফসার ব্রাদার্স।" },
                },
                {
                  name: "nameLatin",
                  type: "text",
                  label: "Name (Latin)",
                  admin: { description: '"Afsar Brothers" — feeds Banglish search.' },
                },
              ],
            },
            {
              name: "about",
              type: "richText",
              editor: contentEditor,
              admin: { description: "প্রকাশনীর পরিচিতি — পেজটিকে thin হওয়া থেকে বাঁচায়।" },
            },
            {
              // Out of the sidebar for the same reason as every other upload in
              // this project: a 325px rail cannot show you the logo you just
              // picked.
              name: "logo",
              type: "upload",
              relationTo: "media",
              filterOptions: { mimeType: { contains: "image" } },
              admin: { description: "Optional. Shown on the publisher page." },
            },
          ],
        },

        /* ---------------- Contact and outreach ---------------- */
        {
          label: "Contact",
          description:
            "How to reach them, and where their own pages live. This is the tab you open before sending a distribution-permission request.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "establishedYear",
                  type: "number",
                  admin: { description: "Year founded, if known." },
                },
                {
                  name: "address",
                  type: "text",
                  admin: { description: "Street address, as printed on their books." },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "website",
                  type: "text",
                  admin: { description: "Their own site. Full http:// or https:// URL." },
                  validate: urlValidator,
                },
                {
                  name: "contactEmail",
                  type: "email",
                  admin: {
                    description: "Where a permission request goes. Never shown publicly.",
                  },
                },
              ],
            },
            {
              name: "rokomariPublisherUrl",
              type: "text",
              label: "Rokomari publisher URL",
              admin: {
                description:
                  "Rokomari's page for this publisher — plain URL, affiliate params are added at render time.",
              },
              validate: urlValidator,
            },
          ],
        },
      ],
    },
    /* ---------------- sidebar: the URL and the permission answer ---------------- */
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description: "URL segment — /publisher/afsar-brothers.",
      },
      validate: slugValidator,
    },
    {
      name: "permissionStatus",
      type: "select",
      defaultValue: "none",
      options: [
        { value: "none", label: "Not contacted" },
        { value: "contacted", label: "Contacted" },
        { value: "granted", label: "Granted" },
        { value: "refused", label: "Refused" },
      ],
      admin: {
        position: "sidebar",
        description:
          "Distribution-permission outreach pipeline. Granted → books can move to the permitted tier (with evidence on the book).",
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

export default Publishers;

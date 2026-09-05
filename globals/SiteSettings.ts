import type { GlobalConfig } from "payload";
import { authenticated, publicRead } from "../lib/payload/access";
import { rebuildOnGlobalChange } from "../lib/payload/revalidate";

/** Site-wide settings edited from the admin panel — things that appear on
 *  every page (name, tagline, social links, footer) or steer the homepage
 *  (featured shelves). One document, no drafts.
 *
 *  A save here triggers a DEPLOYMENT, not a cache invalidation. The previous
 *  wording ("cached under the `settings` tag so a save is visible on the next
 *  request without a redeploy") described a mechanism that did not exist:
 *  `cacheComponents` is off in next.config.mjs, so nothing in the project ever
 *  carried a `settings` tag for `revalidateTag()` to clear. Every field here is
 *  rendered on every page, so the change is site-wide by definition and there
 *  is no narrower trigger to make — see lib/payload/revalidate.ts.
 *
 *  What does NOT belong here: anything an engineer sets once per environment
 *  (URLs, credentials, affiliate IDs). Those live in env vars, because a
 *  wrong value there should require a deploy — not be one accidental admin
 *  edit away from production. The affiliate DISPLAY strings (disclosure
 *  wording, button labels) are editorial and live in AffiliateSettings. */
export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Site Settings",
  admin: {
    group: "Settings",
    description:
      "Name, tagline, social links and homepage shelves. Saving triggers a rebuild; the change is live when that deployment finishes (usually a couple of minutes).",
  },
  access: {
    read: publicRead,
    update: authenticated,
  },
  hooks: {
    afterChange: [rebuildOnGlobalChange],
  },
  fields: [
    {
      name: "siteName",
      type: "text",
      required: true,
      defaultValue: "বইদ্বীপ",
      admin: {
        description: "Shown in the header, footer and page titles.",
      },
    },
    {
      name: "tagline",
      type: "text",
      defaultValue: "বাংলা বইয়ের দ্বীপে স্বাগতম",
      admin: {
        description: "Short line under the site name on the homepage hero.",
      },
    },
    {
      name: "siteDescription",
      type: "textarea",
      admin: {
        description:
          "Fallback meta description for pages that do not compute their own. One or two sentences.",
      },
    },
    {
      name: "defaultOgImage",
      type: "upload",
      relationTo: "media",
      admin: {
        description:
          "Fallback social-share image (1200×630) used when a page has no image of its own.",
      },
    },
    {
      type: "collapsible",
      label: "Homepage shelves",
      admin: {
        description:
          "Curated rows on the homepage. Leave a shelf empty to hide it — the automatic Latest and Popular rows always render.",
      },
      fields: [
        {
          name: "heroBook",
          type: "relationship",
          relationTo: "books",
          admin: {
            description:
              "Optional single book spotlighted at the top of the homepage. Leave empty for the default hero.",
          },
        },
        {
          name: "featuredLists",
          type: "relationship",
          relationTo: "lists",
          hasMany: true,
          maxRows: 3,
          admin: {
            description: "Up to three curated lists promoted on the homepage.",
          },
        },
        {
          name: "featuredCategories",
          type: "relationship",
          relationTo: "categories",
          hasMany: true,
          maxRows: 8,
          admin: {
            description:
              "Categories shown in the homepage browse strip, in this order.",
          },
        },
      ],
    },
    {
      type: "collapsible",
      label: "Social & contact",
      fields: [
        {
          name: "socialLinks",
          type: "array",
          labels: { singular: "Link", plural: "Links" },
          admin: {
            description: "Footer social links, in display order.",
          },
          fields: [
            {
              name: "label",
              type: "text",
              required: true,
              admin: { description: "e.g. Facebook, YouTube, X" },
            },
            {
              name: "url",
              type: "text",
              required: true,
              validate: (value: string | null | undefined) => {
                if (!value) return "URL is required.";
                try {
                  const u = new URL(value);
                  if (u.protocol !== "https:" && u.protocol !== "http:") {
                    return "Must be an http(s) URL.";
                  }
                } catch {
                  return "Not a valid URL.";
                }
                return true;
              },
            },
          ],
        },
        {
          name: "contactEmail",
          type: "email",
          admin: {
            description: "Shown on the contact page and in DMCA notices.",
          },
        },
      ],
    },
    {
      name: "footerNote",
      type: "textarea",
      admin: {
        description:
          "Optional extra line in the footer (e.g. a mission statement). Copyright line is automatic.",
      },
    },
  ],
};

export default SiteSettings;

import type { CollectionConfig } from "payload";
import { authenticated } from "../lib/payload/access";

/** Permission letters, signed releases, screenshots of a rights holder's
 *  email — the Tier C audit trail, and the only uploads on this site that
 *  must never be publicly reachable.
 *
 *  WHY THIS IS NOT JUST A FIELD ON `media`. Media is served straight out of a
 *  public R2 bucket: `disablePayloadAccessControl: true` in payload.config.ts
 *  means the stored URL IS the object's public URL, and every request for it
 *  goes to Cloudflare without ever touching Payload. That is the correct
 *  trade for a book cover — it keeps images off the function budget and lets
 *  the CDN cache them — and it is catastrophic for a signed permission
 *  letter, because no access rule Payload can express is on the path the
 *  bytes actually travel. A rights holder's letter uploaded to `media` is
 *  public from the moment it finishes uploading, and stays public after the
 *  book is deleted.
 *
 *  So evidence gets its own collection, on its own bucket, with
 *  `disablePayloadAccessControl` DELIBERATELY ABSENT. Payload then serves the
 *  file itself from `/api/evidence-files/file/<filename>` and runs `read`
 *  below before streaming a byte. The URL stored in the database is that
 *  route, not an R2 URL, so there is nothing to leak by leaking the row.
 *
 *  The `read: authenticated` rule is therefore doing two jobs at once here,
 *  unlike on every other collection: gating the metadata AND gating the file
 *  contents. That is the whole reason for the separate collection.
 *
 *  A note on what this does NOT fix: objects already uploaded to the public
 *  media bucket stay public. Existing evidence has to be found in that bucket
 *  and deleted by hand — see the R2 audit step in SECURITY.md. */
export const EvidenceFiles: CollectionConfig = {
  slug: "evidence-files",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "description", "mimeType", "filesize", "createdAt"],
    // Grouped with Media rather than under Settings: an editor looking for an
    // uploaded file should find every upload collection in one place, and the
    // distinction that matters (public bucket vs. login-gated route) is stated
    // in the description rather than hidden in the nav.
    group: "Files",
    description:
      "Permission letters, signed releases and screenshots of a rights holder's email — the audit trail behind every “permitted” book. Unlike Media, these are served through a logged-in route and never from the public bucket, so they stay private. Attach one from a book's Permission evidence block.",
  },

  access: {
    // The only collection on the site with no public read at all. On an
    // upload collection this rule also gates the FILE, not just the row —
    // see the header.
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },

  upload: {
    // A permission letter arrives as a PDF, a photo of a signed page, an
    // email screenshot, or the raw .eml. Everything else is a mistake worth
    // rejecting at the door.
    mimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "message/rfc822",
      "text/plain",
    ],

    // NO imageSizes, and focalPoint off. Both are deliberate and both have a
    // schema consequence: Payload only adds the focalX/focalY columns when a
    // collection asks for cropping or resizing, so declining them here keeps
    // this table to the base upload columns. Resizing evidence would also be
    // actively wrong — a downscaled screenshot of an email can lose the
    // header line that makes it evidence.
    focalPoint: false,

    // Not served through next/image (it is behind a login and never rendered
    // on the site), so the admin list shows the generic file icon rather than
    // asking for a thumbnail that was never generated.
    adminThumbnail: () => null,
  },

  hooks: {
    beforeValidate: [
      /** Refuses to accept evidence when there is nowhere private to put it.
       *
       *  With the evidence bucket unconfigured the s3 plugin skips this
       *  collection and Payload falls back to local disk — which on Vercel is
       *  an ephemeral, per-invocation filesystem. The upload would report
       *  success and the file would be gone by the next request: a permission
       *  letter that the compliance record says exists and that nobody can
       *  produce when a takedown notice arrives. Loud failure is strictly
       *  better. Local development is exempt, where local disk is the point. */
      ({ data, req }) => {
        const isProduction = process.env.NODE_ENV === "production";
        if (isProduction && !process.env.R2_EVIDENCE_BUCKET) {
          req?.payload?.logger?.error(
            "[evidence-files] upload refused: R2_EVIDENCE_BUCKET is not configured",
          );
          throw new Error(
            "R2_EVIDENCE_BUCKET is not configured, so there is no private bucket to store permission evidence in. Set it in the project's environment variables before uploading evidence — see .env.example.",
          );
        }
        return data;
      },
    ],
  },

  fields: [
    {
      name: "description",
      type: "textarea",
      admin: {
        description:
          "What this document is and who it came from — “Prothoma Prokashon-এর অনুমতি ইমেইল, ১২ মার্চ ২০২৬”. The filename is rarely enough a year later.",
      },
    },
  ],
};

export default EvidenceFiles;

import type { CollectionConfig } from "payload";
import { authenticated, publicRead } from "../lib/payload/access";

/** Every uploaded file — chapter cover images and full-chapter PDFs alike.
 *
 *  Files live in Cloudflare R2, wired up by the storage-s3 plugin in
 *  payload.config.ts. Only the FILENAME is stored here, never a full URL:
 *  the public base (r2.dev subdomain today, a custom domain later) comes
 *  from NEXT_PUBLIC_R2_PUBLIC_URL at render time. That way switching
 *  domains is an environment-variable change instead of a rewrite of every
 *  row in the database — which is exactly the trap the old Cloudinary
 *  setup fell into by storing absolute URLs in the Markdown frontmatter. */
export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "alt", "mimeType", "filesize"],
    group: "Files",
    description:
      "Every public upload — book covers, blog headers, images placed inside a chapter. Files go straight to Cloudflare R2 and are served from there, so anything uploaded here is world-readable the moment it finishes. Permission letters and other private documents belong in Evidence files instead.",
  },
  access: {
    // Files are served straight from R2's public URL anyway
    // (disablePayloadAccessControl in payload.config.ts), so a restrictive
    // read here would protect the metadata row while the file it describes
    // stays public — security theatre with a maintenance cost.
    read: publicRead,
    // Upload, replace and delete all require a login. Worth stating outright
    // on this collection in particular: an unauthenticated create here would
    // not merely add a database row, it would let a stranger write arbitrary
    // files into a billed object store.
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  upload: {
    // Accepts both roles this collection serves. Anything else is rejected
    // at upload time rather than silently stored and later failing to
    // render — a stray .docx would otherwise sit in the bucket looking
    // like a valid book PDF. EPUB accepted for the optional ebook field.
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "application/pdf",
      "application/epub+zip",
    ],

    // Pre-generated variants, so a 4 MB phone photo is never shipped to a
    // reader on mobile data. The variants are PORTRAIT (~2:3),
    // because book covers are portrait — a grid of 40 covers renders the
    // card size, and serving the original to each is the whole LCP budget.
    // The names line up with where each is used:
    //   thumbnail -> tiny cover chips (sidebar lists, admin)
    //   card      -> BookCard grids (the workhorse)
    //   hero      -> the cover panel at the top of a book page
    //   og        -> 1200x630 LANDSCAPE, the one non-portrait size, because
    //                it is what Facebook and Twitter actually want; the OG
    //                composer letterboxes the portrait cover onto it.
    // withoutEnlargement stops a small upload being upscaled into a blurry
    // mess; Payload simply omits a size the original is too small for.
    imageSizes: [
      { name: "thumbnail", width: 160, height: 240, position: "centre", withoutEnlargement: true },
      { name: "card", width: 320, height: 480, position: "centre", withoutEnlargement: true },
      { name: "hero", width: 640, height: 960, position: "centre", withoutEnlargement: true },
      { name: "og", width: 1200, height: 630, position: "centre", withoutEnlargement: true },
    ],

    // Lets editors crop meaningfully rather than always centre-cropping,
    // which matters for cover art where the subject sits off-centre.
    focalPoint: true,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      // Optional on purpose. Chapter covers are decorative — they sit
      // directly beside a heading that already states the chapter name, so
      // CoverImage renders alt="" for them, which is the correct
      // accessibility treatment (a screen reader announcing the title
      // twice is worse than silence). This field exists for images used
      // INSIDE article bodies, where the picture carries real meaning and
      // the body converter does emit the alt attribute.
      admin: {
        description:
          "Needed only for images placed inside a chapter body, where the picture carries meaning. Cover images are decorative and ignore this; PDFs don't use it at all.",
      },
    },
    {
      name: "credit",
      type: "text",
      admin: {
        description:
          "Optional attribution, if the image came from a source that requires crediting.",
      },
    },
  ],
};

export default Media;

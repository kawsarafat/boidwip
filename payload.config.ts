import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { s3Storage } from "@payloadcms/storage-s3";
import sharp from "sharp";

// RELATIVE IMPORTS, NOT THE "@/" ALIAS — deliberately, and the same goes for
// everything reachable from this file (the collections and lib/payload/*).
// Next's bundler resolves "@/" from tsconfig paths, but Payload's CLI loads
// this config through tsx instead, outside the bundler, where that mapping is
// not guaranteed. The difference is invisible until you run it: `next build`
// compiles fine while `payload generate:types`, `generate:importmap` and every
// `migrate` command die on a module-not-found. Payload's own templates use
// relative paths throughout the config graph for exactly this reason.
import { Authors } from "./collections/Authors";
import { BlogPosts } from "./collections/BlogPosts";
import { BookChapters } from "./collections/BookChapters";
import { Books } from "./collections/Books";
import { Categories } from "./collections/Categories";
import { EvidenceFiles } from "./collections/EvidenceFiles";
import { Lists } from "./collections/Lists";
import { Media } from "./collections/Media";
import { Pages } from "./collections/Pages";
import { Publishers } from "./collections/Publishers";
import { Reviews } from "./collections/Reviews";
import { Series } from "./collections/Series";
import { Users } from "./collections/Users";
import { AffiliateSettings } from "./globals/AffiliateSettings";
import { SiteSettings } from "./globals/SiteSettings";
import { contentEditor } from "./lib/payload/editor";
import { emailAdapter } from "./lib/payload/email";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/** Refuses to boot without a variable rather than substituting a default.
 *
 *  Only used for the two secrets where a silent fallback is worse than a
 *  crash: PAYLOAD_SECRET (a guessable value means forgeable admin sessions)
 *  and DATABASE_URL (an undefined connection string surfaces later as an
 *  unrelated-looking Drizzle error). Everything else in this config is
 *  genuinely optional and degrades on purpose — the R2 block below is the
 *  clearest example. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env locally, or to the project's environment variables in Vercel. See .env.example.`
    );
  }
  return value;
}

/** Cloudflare R2 is S3-compatible, so the official S3 adapter drives it —
 *  there is no separate R2 plugin to install. Two R2-specific details:
 *  `region` must be the literal string "auto" (R2 has no regions), and the
 *  endpoint is derived from the account ID.
 *
 *  The plugin is switched off when credentials are absent so the CMS still
 *  boots and can be worked on locally before R2 exists, falling back to
 *  local disk. `alwaysInsertFields` below is what makes that safe: it keeps
 *  the storage columns in the database schema either way, so the schema
 *  verified locally is byte-for-byte the schema production will use. Without
 *  it, a local run would quietly produce a DIFFERENT set of tables from the
 *  deployed one — the exact class of "worked on my machine" divergence this
 *  migration is meant to avoid. */
const hasR2Credentials = Boolean(
  process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
);

/** A SECOND, SEPARATE BUCKET, holding nothing but permission evidence.
 *
 *  It has to be a different bucket rather than a different prefix in the same
 *  one, because "public" is a property of the bucket in R2, not of the key:
 *  the media bucket has public access switched on so `disablePayloadAccessControl`
 *  can hand out its URLs directly, and an `evidence/` folder inside it would
 *  inherit exactly that. Two buckets is the only arrangement where the
 *  evidence objects have no unauthenticated URL at all — see
 *  collections/EvidenceFiles.ts.
 *
 *  Unset is a supported state (local development, and any install with no
 *  Tier C books yet): the plugin instance below switches off, uploads fall
 *  back to local disk, and the collection's own hook refuses evidence uploads
 *  in production so the fallback can never silently swallow a legal document. */
const evidenceBucket = process.env.R2_EVIDENCE_BUCKET ?? "";

/** Shared by both storage plugin instances. Same account, same credentials,
 *  different buckets — so this is stated once rather than copied, where a
 *  later endpoint or region edit could reach one bucket and miss the other. */
const r2ClientConfig = {
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  // R2 has no regions; "auto" is the literal value it requires.
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
  // R2 expects path-style addressing (endpoint/bucket/key) rather than
  // the virtual-host style AWS defaults to.
  forcePathStyle: true,
};

/** Public base URL for uploaded files. Only the filename is stored in the
 *  database, so moving from the r2.dev subdomain to a custom domain later is
 *  an environment-variable change rather than a rewrite of every row — which
 *  is precisely the trap the old Cloudinary setup fell into by baking
 *  absolute URLs into the Markdown frontmatter. */
const r2PublicBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");

const serverURL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export default buildConfig({
  serverURL,

  admin: {
    user: Users.slug,
    // Payload compiles a map of every custom admin component at build time.
    // Regenerate with `npm run generate:importmap` after adding one.
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Components are named by PATH, not imported — that is what keeps this
    // config loadable by Payload's CLI (which runs outside Next's bundler and
    // could not compile a .tsx file or a CSS module). Paths are resolved from
    // `importMap.baseDir` above.
    components: {
      // Branding. Both slots render one shared tile
      // (components/payload/branding/BrandMark.tsx) that mirrors
      // public/icon.svg, so the CMS carries the same mark as the site's favicon
      // rather than a second, nearly-identical one.
      //
      // Icon goes in the app header's breadcrumb (a 16px box); Logo appears on
      // the login screen and nowhere else, which is why it is a full lockup with
      // a wordmark — Payload's login view renders no heading of its own, so this
      // is the only thing on that page naming the system.
      //
      // Those are the only two branding slots Payload offers, and between them
      // they name the product on the login screen and in a 16px breadcrumb glyph.
      // Everywhere else in the panel — every list, every editor — had nothing on
      // screen saying what the editor was signed in to. Hence `beforeNav` below.
      graphics: {
        Icon: "/components/payload/branding/Icon#default",
        Logo: "/components/payload/branding/Logo#default",
      },
      // The sidebar's brand block, filling the empty strip Payload reserves at the
      // top of the nav (`--nav-padding-block-start: var(--app-header-height)`).
      // `beforeNav` renders inside `.nav__scroll` and above `nav.nav__wrap`, so it
      // is the first thing in the sidebar's own scroll column, which is exactly
      // where that strip is. See components/payload/branding/NavBrand.tsx and the
      // sidebar section of app/(payload)/theme/chrome.css.
      beforeNav: ["/components/payload/branding/NavBrand#default"],
      // The /admin index. Payload's own is one card per collection — thirteen
      // rectangles of equal weight, answering only "where do I click for a
      // list". This one answers "what needs me" first: the moderation queue's
      // depth, books whose rights tier promises a PDF that is not there, covers
      // and synopses missing from published books, takedown notices. Each number
      // is a count and a link built from the same conditions, so clicking it
      // lands on exactly the rows it counted. The collection grid is still there,
      // underneath, grouped the way the sidebar is.
      //
      // A server component: every number on it is a `payload.count()`.
      // See components/payload/dashboard/.
      views: {
        dashboard: {
          Component: "/components/payload/dashboard/Dashboard#default",
        },
      },
      // Turnstile challenge on the login screen. Renders in Payload's own
      // beforeLogin slot and, on a passed challenge, sets the gate cookie that
      // the Users collection's beforeOperation hook requires before it will
      // check a password. Renders nothing when the public key is unset, so the
      // stock login page is unchanged on an install without Turnstile. See
      // lib/payload/loginTurnstile.ts.
      beforeLogin: ["/components/payload/auth/LoginTurnstile#default"],
      // Wraps the whole admin app, so useConfirm() works from any custom
      // component in it. Payload renders providers listed here as children of
      // its own RootProvider, which means this one sits INSIDE ModalProvider and
      // TranslationProvider — the reason the dialog can be built on Payload's
      // existing modal container and use its Cancel/Confirm translations rather
      // than shipping a parallel implementation of both.
      //
      // This is the replacement for window.confirm and window.alert. Nothing in
      // this project may call either: a native dialog is unstyled, unthemed,
      // blocks the whole tab, and on mobile Safari renders with the site's
      // hostname above the message.
      //
      // NavDefaultOpen opens the docked sidebar by default on desktop-width
      // screens. Payload force-collapses the nav at <=1440px and only restores
      // the stored preference above that, so any normal laptop starts collapsed;
      // this pass-through provider (inside NavProvider, so it can call useNav)
      // opens it once on mount. See the component header for why it's a timeout.
      providers: [
        "/components/payload/modals/ConfirmProvider#default",
        "/components/payload/nav/NavDefaultOpen#default",
      ],
    },
    // The account chip in the top-right corner of every authenticated screen.
    //
    // Not a `components` key: `avatar` is its own field on the admin config, and
    // its default is `"gravatar"` — which is not a placeholder graphic. Payload
    // renders `<img src="https://www.gravatar.com/avatar/<md5(email)>?...">`, so
    // the panel made a cross-origin request on every page load, told gravatar.com
    // an MD5 of the signed-in editor's email plus the admin URL it was called
    // from, and got back the generic silhouette, because nobody here has a
    // Gravatar account. On a project whose whole cost model is "no request-time
    // dependencies", that is the only one left in the panel.
    //
    // The replacement is a server component: it receives `user` as a prop, so it
    // draws an initial with no fetch and no client JavaScript. See
    // components/payload/branding/AccountAvatar.tsx.
    avatar: {
      Component: "/components/payload/branding/AccountAvatar#default",
    },
    meta: {
      titleSuffix: " — বইদ্বীপ CMS",
      // The admin's own favicon. Without this Payload serves its own, which is
      // the one piece of default branding that survives every stylesheet in
      // app/(payload)/theme — a tab strip with the CMS in it would still show
      // Payload's mark next to the site's.
      //
      // MetaConfig extends Next's Metadata, so this is the same shape as the
      // frontend layout's `icons`, and it points at the same file: one mark for
      // the site, the manifest and the CMS.
      icons: [{ rel: "icon", type: "image/svg+xml", url: "/icon.svg" }],
      // Turns off Payload's per-page Open Graph image generator, which is on by
      // default and mounts /api/og to render one at request time. Admin URLs are
      // behind a login and are never shared as links, so every one of those
      // renders would be for a crawler that cannot get past the login screen.
      defaultOGImageType: "off",
    },
    dateFormat: "d MMM yyyy, h:mm a",
  },

  // Ordered the way the admin nav should read: the catalogue first (books and
  // the entities they hang off), then editorial, then moderation and plumbing.
  collections: [
    Books,
    BookChapters,
    Authors,
    Publishers,
    Categories,
    Series,
    Lists,
    BlogPosts,
    Pages,
    Reviews,
    Media,
    EvidenceFiles,
    Users,
  ],

  // Site-wide singletons: navigation/footer/homepage curation, and the
  // affiliate-programme registry every buy-link resolves against.
  globals: [SiteSettings, AffiliateSettings],

  // GraphQL is switched OFF, and the two route files under
  // app/(payload)/api/graphql* were deleted with it.
  //
  // Nothing in this project queries GraphQL: the build reads the Local API
  // (lib/data.ts) and the admin uses REST. Leaving it mounted therefore added
  // no capability, only a publicly reachable endpoint whose whole purpose is
  // to accept arbitrary nested queries. On a site whose entire cost model is
  // "zero database traffic at request time", a stranger POSTing deeply nested
  // relationship queries is the cheapest way to burn Neon compute and Vercel
  // function invocations. Access control would still hide unpublished drafts;
  // it would not stop the query from running.
  //
  // To bring it back: delete this block, restore the two route files from git
  // history (`app/(payload)/api/graphql/route.ts` and
  // `.../graphql-playground/route.ts`), and set a `maxComplexity`.
  graphQL: {
    disable: true,
  },

  // Caps how deep a REST caller can make Payload follow relationships.
  // Payload's default maxDepth is 10, and `?depth=10` on a collection whose
  // documents point at each other is a self-inflicted amplification attack:
  // one cheap HTTP request fans out into hundreds of database reads. Nothing
  // here needs more than the cover/pdf/subject one level down, so 2 is
  // generous and 1 is what the app actually asks for.
  defaultDepth: 1,
  maxDepth: 2,

  // Upload ceiling, enforced before the file is streamed anywhere. Without
  // it the practical limit is whatever the platform allows, which means a
  // single mistaken drag-and-drop of a 300 MB video can be pushed into the
  // R2 bucket and billed. 15 MB comfortably fits a scanned chapter PDF and a
  // full-resolution cover photo.
  upload: {
    limits: {
      fileSize: 15_000_000,
    },
  },

  // Default editor for any rich-text field that doesn't specify its own.
  // Chapters and Pages both set this explicitly; naming it here as well
  // means a future field can't accidentally get Lexical's full default
  // feature set, which would emit HTML the sanitizer then silently strips.
  editor: contentEditor,

  db: postgresAdapter({
    pool: {
      connectionString: requireEnv("DATABASE_URL"),
    },
    // Schema changes are applied by real migration files, in EVERY
    // environment including local development. `push` (Drizzle's auto-sync)
    // is off deliberately, not just in production:
    //
    //  - Against production it is dangerous outright. It can drop a column to
    //    reconcile a diff, and on a live site that is data loss.
    //  - Against development it is quietly worse than useless here, because
    //    it makes the schema drift WITHOUT producing a migration file. You
    //    change a collection, dev silently syncs, everything works locally,
    //    and Vercel then deploys with no migration to apply — the exact
    //    "worked on my machine" failure this migration is meant to avoid.
    //
    // Workflow after changing any collection:
    //   npm run payload migrate:create   # writes ./migrations/*.ts
    //   npm run payload migrate          # applies it locally
    // then commit the migration. `npm run build` runs `migrate` first, so
    // production applies the identical file.
    push: false,
    migrationDir: path.resolve(dirname, "migrations"),
  }),

  // Signs auth tokens, so a predictable value means anyone can forge an admin
  // session. The previous `process.env.PAYLOAD_SECRET || ""` had a comment
  // claiming it "fails loudly" — it did not. An empty string is a perfectly
  // valid HMAC key: Payload boots, issues signed cookies, and every one of
  // them is forgeable by anybody who guesses that the secret is "". This
  // throws instead, which is what the comment always meant to describe.
  secret: requireEnv("PAYLOAD_SECRET"),

  // Outbound SMTP, used by exactly one thing: the admin forgot-password mail.
  //
  // `undefined` when neither the Gmail App Password pair nor the Brevo pair is
  // set, and that is load-bearing rather than tidy. Two traps sit behind this
  // one key. Payload's fallback when `email` is absent is `consoleEmailAdapter`,
  // which logs "Email attempted without being configured" and reports SUCCESS —
  // so a reset appears to send and the link only ever reaches a server log; the
  // beforeOperation guard on Users refuses the operation outright instead. And
  // @payloadcms/email-nodemailer, invoked with no transport, creates an
  // ethereal.email test account over the network and prints its credentials, so
  // it must not be reached unconfigured — hence a function that returns
  // undefined without importing the package rather than a spread or a ternary
  // that calls the adapter anyway. Brevo wins when both providers are set. See
  // lib/payload/email.ts.
  email: emailAdapter(),

  // Image resizing for the Media collection's imageSizes.
  sharp,

  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },

  // Restricts which origins may submit authenticated requests to the API,
  // so a third-party page can't drive the CMS using a logged-in editor's
  // cookie.
  csrf: [serverURL],
  cors: [serverURL],

  plugins: [
    s3Storage({
      enabled: hasR2Credentials,
      // Keeps the database schema identical whether or not R2 is configured
      // — see the note above `hasR2Credentials`.
      alwaysInsertFields: true,
      bucket: process.env.R2_BUCKET ?? "",
      collections: {
        media: {
          prefix: "media",
          // Files are served straight from R2's public URL instead of being
          // proxied through Payload. On a static site that matters twice
          // over: it keeps image requests off Vercel's function invocation
          // budget entirely, and it lets next/image and the browser cache
          // them at the CDN edge.
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) => {
            const key = [prefix, filename].filter(Boolean).join("/");
            return `${r2PublicBase}/${key}`;
          },
        },
      },
      config: r2ClientConfig,
    }),

    /** The evidence bucket. A second plugin instance, not a second entry in
     *  the one above, because `bucket` is a property of the instance —
     *  one s3Storage() call can only ever address one bucket.
     *
     *  The two omissions are the entire point of this block:
     *
     *  NO `disablePayloadAccessControl`. Leaving it off (the default) is what
     *  makes Payload serve these files itself, through
     *  /api/evidence-files/file/<filename>, running the collection's `read`
     *  rule first. Setting it here would hand out R2 URLs and make the access
     *  rule decorative — the audit's finding, exactly.
     *
     *  NO `generateFileURL`. The media instance rewrites URLs to the public
     *  r2.dev base; doing that here would write a public-bucket-shaped URL
     *  into the database for a file that is not in the public bucket.
     *
     *  `prefix` still applies, so evidence lands under `evidence/` inside its
     *  own bucket — useful when reading the bucket by hand, and it keeps the
     *  `prefix` column meaningful for this collection too. */
    s3Storage({
      enabled: hasR2Credentials && Boolean(evidenceBucket),
      // Same reason as the media instance: the columns exist in the schema
      // whether or not the bucket is configured, so a locally verified
      // migration matches production byte for byte.
      alwaysInsertFields: true,
      bucket: evidenceBucket,
      collections: {
        "evidence-files": {
          prefix: "evidence",
        },
      },
      config: r2ClientConfig,
    }),
  ],
});

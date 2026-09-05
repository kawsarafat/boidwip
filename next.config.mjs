import { withPayload } from "@payloadcms/next/withPayload";

/** Hostname that uploaded media is served from. next/image refuses to
 *  optimize a remote image whose host isn't explicitly allowlisted (an
 *  open image proxy would otherwise let anyone route arbitrary traffic
 *  through this site's CDN quota), and Content-Security-Policy needs the
 *  same host in img-src. Both are derived from the one environment
 *  variable so they can never drift apart. */
function r2Hostname() {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const R2_HOST = r2Hostname();

/** Google's ad stack does not live behind one hostname, and the set grows.
 *  Listed once and reused across script-src / img-src / connect-src /
 *  frame-src, because a directive that is missing one of them fails as
 *  "the ad unit renders blank" with nothing in the console pointing at CSP.
 *
 *  adtrafficquality.google is the newest of these (Google's invalid-traffic
 *  verification beacons, rolled out 2024) and is the one most likely to be
 *  absent from a policy copied off an older blog post. */
const GOOGLE_ADS_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.google.com",
  "https://*.doubleclick.net",
  "https://*.adtrafficquality.google",
].join(" ");

/** Only a path built by `pathFor()` in lib/payload/slugHistory.ts: a leading
 *  slash and one or more `[a-z0-9-]` segments.
 *
 *  These rows come out of the database, and `source` is not a literal — Next
 *  compiles it as a path-to-regexp pattern. A stored value containing `:`, `*`,
 *  `(` or `?` would therefore either match far more than the one URL it is
 *  supposed to move, or throw inside `checkCustomRoutes` and fail the build.
 *  Neither is an acceptable outcome for a row that only has to survive being
 *  read; anything that does not look exactly like a slug path is dropped. */
const REDIRECT_PATH = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

/** No sane rename history reaches this. It exists so that a namespace nobody
 *  has been watching cannot silently put ten thousand patterns in the route
 *  manifest, every one of them evaluated ahead of the filesystem on every
 *  request that misses. */
const REDIRECT_LIMIT = 1000;

/** Permanent redirects for slugs that have been renamed.
 *
 *  Written by lib/payload/slugHistory.ts when an editor changes a slug, read
 *  here once per build. See that file's header for the shape and the reasoning;
 *  this end of the contract is deliberately dumb — it reads `{from, to}` pairs
 *  and emits redirects, and knows nothing about which collection lives under
 *  which URL prefix.
 *
 *  IT USES `pg` DIRECTLY, WHICH IS NOT A SHORTCUT. next.config.mjs is loaded by
 *  Next as plain ESM outside the bundler, so it cannot import anything through
 *  the `@/` alias or `@payload-config`, and pulling in `getPayload()` would boot
 *  a whole Payload instance (and run its access-control graph) to read eight
 *  rows out of one table. `pg` is already a dependency of the Postgres adapter.
 *
 *  IT FAILS OPEN, ALWAYS. A build machine with no reachable database — CI
 *  running `next build` to typecheck the app, a contributor without a local
 *  Postgres — must still build. The cost of the catch is that a genuine
 *  connection problem produces a deployment whose old URLs 404 again rather
 *  than a failed deployment, which is why it warns loudly on the way out.
 *
 *  WHY BUILD TIME IS THE RIGHT TIME. `redirects()` is evaluated once and baked
 *  into the route manifest, and every public route here is prerendered with
 *  `dynamicParams = false` — so a renamed slug is a hard 404 (via
 *  app/global-not-found.tsx) until a deployment happens. A slug change already
 *  triggers one, so the redirect lands in the same deployment that moves the
 *  page. */
async function slugRedirects() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return [];

  let client;
  try {
    const { default: pg } = await import("pg");
    client = new pg.Client({
      connectionString,
      // A build must not hang on an unreachable database. Ten seconds is
      // generous for one indexed prefix scan and short enough that a wedged
      // connection surfaces as the warning below rather than as a stuck build.
      connectionTimeoutMillis: 10_000,
      statement_timeout: 10_000,
      application_name: "boidwip-build-redirects",
    });
    await client.connect();

    // Expiry lives in the row's own envelope (`exp`) rather than in a column —
    // Postgres has no TTL, so the reader checks it. Mirrors kvList().
    const { rows } = await client.query(
      `SELECT "data" FROM "payload_kv" WHERE "key" LIKE $1 ESCAPE '\\'`,
      ["bdw:redirect:%"],
    );

    const now = Date.now();
    const bySource = new Map();

    for (const row of rows) {
      const envelope = row?.data;
      if (!envelope || typeof envelope !== "object") continue;
      if (typeof envelope.exp === "number" && envelope.exp <= now) continue;

      const value = envelope.v;
      if (!value || typeof value !== "object") continue;
      const { from, to } = value;
      if (typeof from !== "string" || typeof to !== "string") continue;
      if (!REDIRECT_PATH.test(from) || !REDIRECT_PATH.test(to)) continue;
      // A self-redirect is an infinite loop, not a no-op.
      if (from === to) continue;
      if (bySource.has(from)) continue;

      bySource.set(from, to);
    }

    // Sorted so two builds of the same database produce byte-identical route
    // manifests; `payload_kv` has no meaningful row order to inherit.
    const pairs = [...bySource.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    if (pairs.length > REDIRECT_LIMIT) {
      console.warn(
        `[redirects] ${pairs.length} stored redirects exceeds the ${REDIRECT_LIMIT} cap; keeping the first ${REDIRECT_LIMIT}.`,
      );
      pairs.length = REDIRECT_LIMIT;
    }

    if (pairs.length > 0) {
      console.log(`[redirects] ${pairs.length} old slug(s) will redirect permanently.`);
    }

    return pairs.map(([source, destination]) => ({
      source,
      destination,
      // 301, not `permanent: true` (which emits 308). Both are permanent and
      // both are understood by every search engine that matters, but 308 is
      // HTTP/1.1-era-unknown: a client that does not recognise it is required
      // to NOT follow it automatically. These are page URLs reached by GET,
      // where 308's only distinguishing feature — preserving the method and
      // body — buys nothing, so there is no reason to pay that compatibility
      // cost.
      statusCode: 301,
    }));
  } catch (error) {
    console.warn(
      `[redirects] could not read stored redirects; building without them. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  } finally {
    // `next build` exits when the event loop drains, so a live client would
    // keep the process alive after the build finished.
    try {
      await client?.end();
    } catch {
      // Already gone, or never connected.
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // LOAD-BEARING, and it fails silently if removed. This is what makes Next
    // pick up app/global-not-found.tsx, which is the only 404 that unmatched
    // URLs ever see here.
    //
    // The ordinary app/not-found.tsx convention cannot cover that case in this
    // app: the global 404 is resolved at the app root and needs a root layout to
    // render inside, and there is no app/layout.tsx — (frontend), (payload) and
    // (preview) each render their own <html>, so there are three root layouts and
    // an unmatched URL belongs to none of them. Next's own docs name "multiple
    // root layouts" as the reason global-not-found exists. Without this flag the
    // file is ignored and every 404 falls back to Next's built-in default: English
    // text, no lang attribute, no stylesheet, no navigation. Nothing warns.
    //
    // Experimental since 15.4 and unchanged in 16.3.1 (see
    // node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js, which
    // swaps the /_not-found route's root layout for this file only when the flag
    // is on). If a future upgrade stabilises or renames it, follow the rename —
    // do not just delete it.
    globalNotFound: true,
  },

  // Nothing is listed here on purpose, and the empty array is deliberate rather
  // than leftover. It used to carry @resvg/resvg-js, a native addon whose
  // platform-specific binary (@resvg/resvg-js-win32-x64-msvc and friends) Next's
  // bundler cannot follow into a module; left bundled, the cover-title compositor
  // threw "could not resolve @resvg/resvg-js-win32-x64-msvc" at runtime, which the
  // build never catches. That compositor now shapes its Bengali text with libvips
  // (sharp.text) instead — see the header of lib/ai/coverTitle.ts for why resvg had
  // to go — and withPayload appends sharp itself to this list rather than replacing
  // it, so sharp needs no entry. Add one here for any native addon of OUR OWN that
  // a server module require()s.
  serverExternalPackages: [],

  // Drops the `X-Powered-By: Next.js` response header. Version-fingerprinting
  // a site is the first step of looking up known CVEs against it, and this
  // header volunteers the framework to anyone running a scanner.
  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    // R2 is the only remote image host. Cloudinary used to be listed here
    // as well; it was removed once no chapter referenced a Cloudinary URL
    // any more, so an unused host can't sit in the allowlist indefinitely.
    remotePatterns: R2_HOST
      ? [
          {
            protocol: "https",
            hostname: R2_HOST,
          },
        ]
      : [],
    // Only the widths the layout actually asks for. next/image will generate
    // (and cache, and bill) a variant for every entry in this list that a
    // `sizes` attribute can resolve to, so trimming the default eleven-entry
    // list to the eight this design uses is a direct reduction in both build
    // output and image-optimization invocations.
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536],
    imageSizes: [96, 128, 200, 256, 384],
    // A year. Uploaded media is immutable in practice: Payload writes a new
    // filename rather than overwriting, so a long TTL can never serve a stale
    // image, and it keeps repeat visitors off the optimizer entirely.
    minimumCacheTTL: 31_536_000,
  },

  // Old-slug redirects, read out of `payload_kv` at build time. Redirects are
  // matched BEFORE the filesystem, so an entry whose source is also a live page
  // would shadow that page — which is why slugHistory.ts drops a redirect the
  // moment its old slug is taken back into use.
  async redirects() {
    return slugRedirects();
  },

  // Security headers applied to every response. These cost nothing at
  // runtime (set once, served by Vercel's edge) and close off several
  // common low-effort attack classes.
  async headers() {
    // A real Content-Security-Policy that still allows every third-party
    // script this site actually uses (AdSense, Vercel Analytics/Speed
    // Insights, Cusdis comments, Google Fonts).
    //
    // ON 'unsafe-inline' IN script-src — this is a deliberate, permanent
    // decision rather than an oversight, and it is worth being precise about
    // because it is the one genuine weakness in this policy:
    //
    //   The strict alternatives are nonces and hashes. A nonce must be a
    //   fresh random value generated per RESPONSE, which requires rendering
    //   the page per request. Every public page here is prerendered at build
    //   time and served as a static file from the CDN — there is no
    //   per-request render in which to mint a nonce, and adding one would
    //   convert every page into a serverless function, which is the single
    //   thing this architecture exists to avoid (see AGENTS.md). Hashes fail
    //   for a different reason: the inline scripts are per-page JSON-LD whose
    //   content differs on every chapter page, so the hash list would have to
    //   be regenerated per page and shipped in a per-page header, which
    //   static hosting cannot express either.
    //
    //   What is still bought here: 'unsafe-inline' permits inline script, but
    //   the src allowlist is unchanged, so an injected `<script src=...>`
    //   pointing anywhere off this list is still blocked, as is any attempt
    //   to exfiltrate over fetch/XHR (connect-src) or to load a plugin
    //   (object-src 'none'). The realistic injection path this does NOT stop
    //   is inline script reaching the page through CMS content — which is why
    //   sanitizeContentHtml() in lib/render.ts is the actual control for that,
    //   and why its allowlist has no <script>, no event-handler attributes
    //   and no javascript: scheme. CSP is the second layer here, not the
    //   first.
    //
    // ON 'unsafe-eval' — development only, and it is not optional there. React's
    // dev build uses eval() to reconstruct component stacks for the error
    // overlay; without it every dev-time error arrives with no callstack and the
    // console fills with "eval() is not supported in this environment" instead
    // of the actual problem. `next build` sets NODE_ENV=production, so the
    // production policy that ships to Vercel never contains it.
    const isDev = process.env.NODE_ENV === "development";
    const devScriptSrc = isDev ? " 'unsafe-eval'" : "";

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${devScriptSrc} ${GOOGLE_ADS_HOSTS} https://challenges.cloudflare.com https://va.vercel-scripts.com`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${
        R2_HOST ? ` https://${R2_HOST}` : ""
      } ${GOOGLE_ADS_HOSTS} https://*.gstatic.com https://*.2mdn.net`,
      // next/font self-hosts Google Fonts at build time, so no external font
      // host is needed. data: covers inlined icon fonts if one is ever added.
      "font-src 'self' data:",
      `connect-src 'self' https://vitals.vercel-insights.com https://challenges.cloudflare.com ${GOOGLE_ADS_HOSTS}`,
      `frame-src 'self' https://challenges.cloudflare.com ${GOOGLE_ADS_HOSTS}`,
      // Nothing on this site should ever be framed by anyone. This is the
      // modern replacement for X-Frame-Options (which is kept below purely
      // for browsers that predate CSP level 2) and, unlike it, it is honoured
      // for nested frames too.
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      // The only form on the site posts to Payload's own API. An injected
      // form that tried to POST a visitor's input to an attacker's collector
      // would be refused by the browser.
      "form-action 'self'",
      "manifest-src 'self'",
      "media-src 'self'",
      "worker-src 'self' blob:",
    ].join("; ");

    // Transport- and capability-level headers, kept in their own list because
    // BOTH rules below need them: they have nothing to do with how a page loads
    // its scripts and styles, which is the only reason the admin needs a reduced
    // CSP at all. Sharing the list is what stops the two rules from drifting.
    const transportHeaders = [
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
      },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      // Severs the window.opener relationship for anything this site opens or
      // is opened by, which is what stops a popup from reaching back into the
      // page that spawned it.
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];

    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ...transportHeaders,
      { key: "Content-Security-Policy", value: csp },
    ];

    // Applied to /admin and /api. These are not public surfaces and must not
    // appear in search results — a `/admin` login page indexed under the
    // site's own name is free reconnaissance, and an indexed REST endpoint
    // can leak document shapes into search snippets. robots.txt already
    // disallows both, but robots.txt is a crawling directive, not an indexing
    // one: a page linked from elsewhere can still be indexed while
    // uncrawled. X-Robots-Tag is the header that actually forbids indexing.
    const noIndex = { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" };

    return [
      {
        // Applied everywhere EXCEPT /admin. Payload's admin is a single-page
        // React app that inlines its own styles and workers and does not fit
        // this policy.
        //
        // ANCHORED, and the anchor is the fix. `(?!admin)` alone excludes every
        // path that merely BEGINS with those five letters, because the lookahead
        // is a prefix test with nothing pinning its end: `/admin-notice` and
        // `/administration` failed this rule and also failed `/admin/:path*`
        // below, so they were served with NO security headers at all — no CSP,
        // no HSTS, no nosniff, no frame protection. Those are ordinary public
        // slugs (collections/Pages.ts will happily accept either), so this was
        // one CMS entry away from being a real hole rather than a hypothetical
        // one. `admin$|admin/` matches only the admin route itself and things
        // under it.
        source: "/((?!admin$|admin/).*)",
        headers: securityHeaders,
      },
      {
        // The admin cannot take the full policy above, but "cannot take the
        // full policy" is not the same as "cannot take a policy". These
        // directives are the ones Payload's SPA is indifferent to, and they
        // cover the attacks that actually apply to an authenticated admin
        // panel: being framed by a hostile page (clickjacking an editor into
        // clicking Delete), having a plugin embedded, having <base> rewritten
        // to redirect every relative URL, and having a form silently
        // retargeted to an off-site collector. Notably absent are script-src
        // and style-src, which is exactly why this is a subset — the admin
        // inlines both.
        //
        // `transportHeaders` is shared with the public rule rather than omitted
        // here, which it used to be. The admin was the one authenticated surface
        // on the site and the only one with no HSTS, no Permissions-Policy and no
        // COOP — backwards, since this is where a downgraded request carries a
        // session cookie. None of the three touches how Payload loads its own
        // assets, so none of them was the reason for the reduced policy.
        source: "/admin/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...transportHeaders,
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          noIndex,
        ],
      },
      { source: "/api/:path*", headers: [noIndex] },
      // The draft-preview route (app/(preview)/) renders unpublished content
      // for a logged-in editor. It is behind an auth check, but a noindex
      // header costs nothing and removes any chance of a draft URL that got
      // pasted into a chat app ending up in an index.
      { source: "/preview", headers: [noIndex] },
      {
        // Fingerprinted build assets are immutable by construction — the hash
        // in the filename changes when the contents do. Next sets this for
        // /_next/static itself; this covers the two hand-placed public files
        // that are equally safe to cache hard.
        source: "/:file(default-cover.svg|icon.svg)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, must-revalidate" }],
      },
    ];
  },
};

// withPayload injects the aliases and server-external packages Payload needs
// to run inside the Next build (its database driver and sharp must not be
// bundled). The Payload admin route group will not compile without it.
export default withPayload(nextConfig);

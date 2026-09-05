# বইদ্বীপ (Boidwip)

A Bengali book website: free PDF downloads of public-domain and licensed books,
chapter-by-chapter online reading, reader reviews with star ratings, Rokomari
affiliate buy links, curated lists, and hubs for authors, publishers,
categories and series — plus a blog.

- **Production**: whatever `NEXT_PUBLIC_SITE_URL` is set to (`https://boidwip.com`)
- **Admin panel**: `/admin`
- **GitHub**: https://github.com/kawsarafat/boidwip

## Stack

| layer | what |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack; every public page prerendered) |
| CMS | Payload 3 (Local API at build, REST for the admin + public writes) |
| Database | Postgres (Neon in production) via `@payloadcms/db-postgres` |
| Media | Cloudflare R2 through `@payloadcms/storage-s3` |
| Styling | Tailwind CSS with design tokens (warm-paper light + dark theme) |
| Anti-spam | Cloudflare Turnstile (reviews + admin login, both optional) |
| Fonts | Noto Sans Bengali (site), subset Noto Sans Bengali + Latin (OG card) |

## Architecture: the site is a build artefact

`lib/data.ts` reads Payload's Local API during `next build`, every public route
prerenders from that snapshot, and **nothing queries Postgres at request time.**

Publishing therefore has exactly one meaning: trigger a deployment. Collection
hooks call `queueRebuild()`, which POSTs `VERCEL_DEPLOY_HOOK_URL` at most once
per ~90 seconds — the debounce claim is atomic and lives in Postgres, because
one editor action fires several hooks and Vercel functions share no memory. See
`lib/payload/revalidate.ts`.

The trade-off is real and editors have to be told: **a publish is visible when
the deployment finishes, not when Save is pressed** — typically a couple of
minutes. `/preview` shows a draft immediately. A deploy hook that is unreachable
never fails the save; it records that a build is owed, and the daily cron sweeps
that up.

Next's Cache Components (`'use cache'`, `cacheTag()`, `revalidateTag()`) are
**not** enabled, and tag invalidation is not what this project does. It could
not: every route pairs `generateStaticParams()` with `dynamicParams = false`, so
a slug that did not exist at build time is a 404 whatever a cache is told. A new
book becomes reachable by being built, and only by being built.

The only dynamic routes are the admin (`/admin/[[...segments]]`), Payload's
REST API (`/api/[...slug]`), the daily cron (`/api/cron/rebuild`) and draft
preview (`/preview`). Everything public is ○ (static) or ● (SSG) in the build
route table — check it after any route change.

Readers write to the database in exactly one place: review submission
(`POST /api/reviews/submit`), which is length-checked, Turnstile-verified,
rate-limited by salted IP hash, and lands as `pending` in a moderation queue.

## Rights tiers: the compliance gate

Every book carries a `rightsTier` (`lib/types.ts`):

| tier | PDF delivery |
| --- | --- |
| `public-domain` | ✅ (author died 60+ years ago, Bangladesh copyright term) |
| `open-licence` | ✅ (CC or similar) |
| `permitted` | ✅ (explicit permission on file) |
| `in-copyright` | ❌ — buy links only |

`tierAllowsDelivery()` is checked everywhere a PDF could surface (download
button, sitemap priority, search's free-only filter, structured data), and
`isRightsTier()` fails closed: an unknown tier is treated as `in-copyright`.

## Collections

12 collections + 2 globals, all in `collections/` and registered in
`payload.config.ts`:

- **Books** — the centre. Title (Bengali + Latin), synopsis, PDF (upload or
  external URL), rights tier, authors/publisher/categories/series relations,
  buy links, bibliographic block, SERP preview field.
- **BookChapters** — the online reader's per-chapter content.
- **Authors / Publishers / Categories / Series** — entity hubs. Draft-less
  (structure, not content), so their hooks use `rebuildAlways`.
- **Lists** — curated shelves ("১০টি সেরা …").
- **Reviews** — reader reviews, moderated, created only via `/submit`.
- **BlogPosts** — the blog, can reference books.
- **Pages** — freeform static pages; slugs validated against
  `RESERVED_ROUTE_SLUGS`.
- **Media** — R2-backed uploads with portrait cover variants.
- **Users** — admin auth (Turnstile-gated login when configured).

Globals: **SiteSettings** (featured books, footer) and **AffiliateSettings**
(Rokomari affiliate ID).

## Local development

```bash
npm install
cp .env.example .env        # fill DATABASE_URL + PAYLOAD_SECRET (the two required vars)
npm run payload migrate     # apply migrations
npm run seed                # optional: public-domain launch content, idempotent
npm run dev                 # http://localhost:3000  (port 3000 always — CSRF/CORS derive from it)
```

First admin user: visit `/admin` and use the create-first-user screen, or
create one through the Local API.

Schema changes:

```bash
npm run payload migrate:create   # writes migrations/*.ts — commit it
npm run payload migrate
npm run generate:types
```

After registering a new admin component by string path:

```bash
npm run generate:importmap       # commit app/(payload)/admin/importMap.js
```

## Checks: types, lint, unit tests, end-to-end

```bash
npm run typecheck    # tsc --noEmit — tests are typechecked too
npm run lint         # eslint .  (`next lint` was removed in Next 16)
npm test             # vitest: rights tiers, seo helpers, search, affiliate links
npm run build        # payload migrate && next build — required before test:e2e
npm run test:e2e     # playwright, against that production build
```

`npm run test:e2e` deliberately does not build. `playwright.config.ts` starts
`next start`, which needs a build to already exist: half of what these specs
assert — prerendered HTML, the sitemap, canonical tags, whether a route really
was statically generated — does not exist under `next dev`, which would pass a
suite that a deploy then fails. The first run also needs
`npx playwright install chromium`.

Both Playwright projects matter. `chromium` runs the API and SEO specs; `mobile`
(Pixel 7) runs `*.mobile.spec.ts`, because the navigation drawer is `lg:hidden`
and those specs assert nothing on a desktop viewport.

Two variables change what the suite does:

| var | effect |
| --- | --- |
| `E2E_BASE_URL` | test a deployed URL instead of starting a local server. Writes then default to off, so the review-submission spec skips. |
| `E2E_ALLOW_WRITES=1` | re-enable that one spec. Only for a database whose moderation queue you are willing to dirty. |

`.github/workflows/ci.yml` runs all of the above on every pull request, plus a
generated-file drift check (`payload-types.ts`, the admin import map). Its
end-to-end job migrates and seeds a throwaway Postgres before building, because
a build against an empty database produces an empty site and a suite of green
skips that assert nothing. `npm run seed` is that same fixture locally.

## Environment variables

Required (the app will not boot without them):

| var | what |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `PAYLOAD_SECRET` | random 32+ bytes; signs sessions and cookies |

Recommended in production:

| var | what |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | canonical origin (`https://boidwip.com`) — serverURL, CSRF, CORS, sitemap, OG all derive from it |
| `VERCEL_DEPLOY_HOOK_URL` | how publishing reaches visitors at all (see the architecture note). Unset on a deployed site means every edit stays invisible until the daily cron. **Treat it as a credential** — anyone holding it can trigger unlimited builds, which is why nothing in the codebase logs it. |
| `CRON_SECRET` | guards `/api/cron/rebuild`, which brings future-dated books live on the day and retries a build a failed publish left owed. Unset and the route refuses every request. |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET` | Cloudflare R2 media storage (all four or none — falls back to local disk) |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | the bucket's public base URL (`https://pub-….r2.dev` or a custom domain) |
| `R2_EVIDENCE_BUCKET` | a **second, private** bucket holding permission evidence for Tier C books. Create it with no public access and no custom domain: the only path to those files is `/api/evidence-files/file/<name>`, which runs an authenticated read rule first. Bind a public hostname to it and that control is gone. Required in production if any book is `permitted`. |

Optional, degrade gracefully when unset (see `.env.example` for the full
annotated list): Turnstile key pairs (reviews + admin login), SMTP/Brevo/Gmail
email for forgot-password, affiliate IDs, the AI keys.

## Deploying (Vercel)

1. Create a Neon Postgres database; put its pooled connection string in
   `DATABASE_URL`.
2. Import the GitHub repo into Vercel; set the variables above in Project →
   Settings → Environment Variables.
3. `npm run build` runs `payload migrate` first, so schema is applied on
   every deploy.
4. Point the domain at Vercel and make sure `NEXT_PUBLIC_SITE_URL` matches it
   exactly (scheme included).
5. **Create the deploy hook and paste it into `VERCEL_DEPLOY_HOOK_URL`**
   (Settings → Git → Deploy Hooks, for the production branch). Without this step
   the CMS works and publishing does nothing visible — on a statically generated
   site, "publish" and "deploy" are the same event.
6. After first deploy: log into `/admin`, fill SiteSettings, and start adding
   books.

Three deploy steps are **dashboard actions, not code**, and each one is a
control that silently does not exist until somebody clicks it:

- **A rate limit on `POST /api/reviews/submit`** (Vercel → Firewall). The
  application limiter is atomic and per salted IP hash, but it runs *after* the
  request reaches a function; a platform rule is what stops a flood from
  costing invocations at all. The endpoint's own allowance is the shape to
  mirror — a handful of submissions per IP per window.
- **A `Content-Disposition: attachment` Transform Rule** on the R2 bucket's
  public hostname (Cloudflare). PDFs are served straight from R2; this is what
  makes the link download rather than open a viewer.
- **A private evidence bucket** with no public access and no custom domain, if
  any book is Tier C. See `R2_EVIDENCE_BUCKET` above.

The daily cron (`/api/cron/rebuild`, guarded by `CRON_SECRET`) is configured in
`vercel.json`. It brings future-dated books live on the day — their `publishDate`
is honoured by `lib/data.ts`, and nothing rebuilds on its own just because a
clock moved — retries a deployment that a failed publish left owed, and prunes
expired rows from `payload_kv`.

## Project layout

```
app/
  (frontend)/        public site: home, book, read, author, publisher,
                     category, series, list, blog, search, new, popular,
                     static pages, sitemap, rss, og.png
  (payload)/         the admin: Payload UI + six-file unlayered theme
  (preview)/         draft preview, cookie-gated
  api/cron/          daily rebuild sweep
  global-not-found.tsx, manifest.ts, robots.ts   (root on purpose — see AGENTS.md)
collections/         Payload collections (relative imports only)
components/          public site components
components/payload/  admin-only components, registered by string path
lib/                 data layer, seo, rights, render, types, numerals, ads
lib/payload/         rebuild hooks, review submission, email, turnstile gate
migrations/          Payload migrations — commit every one
content-seed/        idempotent public-domain launch content (npm run seed)
tests/unit/          vitest — pure functions, no database
tests/e2e/           playwright — against a real production build
.github/             CI, the dependency audit, Dependabot
assets/fonts/        OG-card font subsets (~6KB each)
```

## The documents

- **README.md** (this file) — what the project is and how to run it.
- **AGENTS.md** — the traps: everything that fails silently and the reasons
  behind non-obvious decisions. Read it before changing config, theme,
  metadata files, or anything touching publishing and rebuilds.
- **SECURITY.md** — the threat model, the access rules, and the repository and
  dashboard settings that are not code (branch protection, secret scanning, the
  firewall rule, the private evidence bucket).
- **ADMIN-REDESIGN.md** — the admin panel's structure: why the edit screens are
  tabbed, how the seven nav groups were chosen, what the `/admin` dashboard
  counts, and the argument that none of it touches the database schema. Read it
  before moving a field between the sidebar and a tab.

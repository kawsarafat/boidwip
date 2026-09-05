# Security Review

A review of the codebase as it stands after the Payload migration, grouped by
what was found and what was done about it. The Decap-era version of this
document is in git history; the findings below supersede it entirely, because
the attack surface changed shape rather than shrinking.

The headline change: there is now a **database and an authenticated backend**
inside the app. Decap had almost no attack surface of its own — it never ran a
server or touched a database. Payload does both. That makes the two most
important controls on this site its access-control rules and its patch cadence,
not anything about the frontend.

Three things to read before the findings, because they change how the rest of the
document should be read:

- **Access control is field-level, not just collection-level.** Payload grants a
  collection's `read` rule to every field inside it, which is how finding 18
  happened. *Access control — the part that matters most now* is the section that
  matters most in this file.
- **A third of these controls are not in the repository.** Branch protection,
  required status checks, secret scanning, the review-endpoint rate limit and the
  private evidence bucket are dashboard settings. *Settings that are not code*
  lists them; each one silently does not exist until somebody sets it, and none
  can be verified by reading this repo.
- **One finding is still open operationally.** Finding 18's code fix shipped; the
  sweep of permission letters already sitting in the public R2 bucket has not
  happened. See the standing obligation immediately below.

---

## Standing obligations (not bugs — things that must keep happening)

### Keep Payload patched
Payload disclosed a CVSS 9.8 SQL injection vulnerability in one of its database
adapters in 2025–26. It was patched promptly, and that is the point: with a
self-hosted backend, **applying security patches is an ongoing task**, not a
one-time setup step. Read the release notes rather than bumping blindly — the
five Payload packages (`payload`, `db-postgres`, `richtext-lexical`,
`storage-s3`, `next`) are pinned to one exact version on purpose and must move
together.

This is now automated rather than remembered: `.github/dependabot.yml` opens a
weekly grouped PR for the Payload packages (one group precisely because a tree
holding two of them at different versions typically fails at runtime, not at
install), and `.github/workflows/audit.yml` runs `npm audit --audit-level=high`
every Monday and on any change to `package.json` or the lockfile. Automation
opens the PR; a human still reads the release notes.

### Audit the public media bucket for evidence files, then rotate
**This is the outstanding item from the evidence finding below, and it is not
something code can do.** Permission letters uploaded before `evidence-files`
existed went to the public R2 media bucket, where the stored URL *is* the
object's public URL. Those objects are still public, and they stay public after
the book row is deleted. Someone has to list the media bucket, identify every
permission letter, email screenshot and signed release in it, download a copy
into the private evidence bucket, delete the public object, and re-attach it
through a book's "Permission evidence" block. Until that is signed off, treat
every pre-existing evidence file as disclosed — which means telling the rights
holders whose private email text was in them if any of it was personal data.

The `file_id` columns on `books_rights_evidence` and
`_books_v_version_rights_evidence` are deliberately retained until that audit is
complete: they are what points at the old public objects, and dropping them
before the sweep would erase the list of what needs deleting.

### Rotate the migration-era credentials
The Neon connection string, R2 access key pair, Cloudflare API token and Vercel
deploy hook URL were all pasted into a chat transcript while the migration was
being built. They work; that is the problem. Rotate them.

`VERCEL_DEPLOY_HOOK_URL` is the one most likely to be mistaken for a config
value rather than a credential. Anyone holding it can trigger unlimited
production builds, which is both a billing and an availability problem, and it
needs no other authentication. Nothing in the codebase logs it — not on the
success path, not in an error, not in the cron's response body — and that
property has to survive future edits to `lib/payload/revalidate.ts` and
`app/(frontend)/api/cron/rebuild/route.ts`.

### Delete the obsolete secrets from Vercel
`ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASSWORD`, `GITHUB_OAUTH_CLIENT_ID`,
`GITHUB_OAUTH_CLIENT_SECRET`. Nothing reads them since Decap was removed. An
unused live secret is a liability with no compensating benefit.

Same for `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` if they were ever set.
`npm run seed` (`content-seed/seed.mts`) creates public-domain *content* and no
user account; the first admin is made through Payload's "create first user"
screen. A password sitting in an environment variable that no code reads is the
worst of both worlds — it grants nothing and it leaks something.

---

## Settings that are not code, and therefore do not exist until somebody sets them

Everything else in this document is enforced by a file in this repository. The
controls in this section are not, and each one silently does not exist until it
is clicked. They are listed here because a reviewer reading only the code would
conclude they were in place.

**Repository (GitHub → Settings):**

| setting | why |
| --- | --- |
| Branch protection on `main` | The whole value of CI is that a red suite blocks a merge. Without protection, `.github/workflows/ci.yml` is advisory decoration. |
| Required status checks: `typecheck, lint, unit tests` **and** `build and end-to-end` | Both jobs, by name. Requiring only the fast one passes a broken build. |
| Require a pull request before merging | Nothing should reach `main` without the checks having run on it. |
| Secret scanning **with push protection** | Push protection is the half that matters: scanning tells you a credential leaked, push protection stops the push that leaks it. This repository's history has already had credentials pasted near it (see above). |
| Dependabot alerts + security updates enabled | `.github/dependabot.yml` schedules version updates; alerts are the separate switch that reports advisories against what is installed. |

**Vercel:**

| setting | why |
| --- | --- |
| A firewall rate limit on `POST /api/reviews/submit` | The application limiter (below) is atomic and per salted IP hash, but it runs *after* the request has reached a function. A platform rule is what stops a flood from costing invocations at all. Mirror the endpoint's own shape: a handful of submissions per IP per ten minutes. |
| `CRON_SECRET` set | Unset, `/api/cron/rebuild` refuses every request — the correct failure direction, but it means scheduled books never go live and an owed rebuild is never retried. |
| The deploy hook created and `VERCEL_DEPLOY_HOOK_URL` set | On a statically generated site, "publish" and "deploy" are the same event. Unset, every edit stays invisible until the daily cron. |

**Cloudflare:**

| setting | why |
| --- | --- |
| A **private** R2 bucket for `R2_EVIDENCE_BUCKET` — no public access, no custom domain | The only path to an evidence file is `/api/evidence-files/file/<name>`, which runs an authenticated read rule first. Bind a public hostname to that bucket and the control is gone, exactly as it was gone for `media`. |
| `Content-Disposition: attachment` Transform Rule on the media bucket's public hostname | Not a security control; PDFs are served straight from R2, and this is what makes a download link download. |
| Turnstile site keys' **Domains** list includes every host that serves the form | A sitekey that does not list the host renders nothing (Cloudflare error 300030). With the admin login gate enforced that is a hard lockout — see the robustness finding at the end of this document. |

---


## Access control — the part that matters most now

Every collection sets `access` explicitly rather than relying on defaults.
Reviewed one collection at a time, because a single wrong default here is worse
than any other finding in this document. There are thirteen of them now
(`payload.config.ts`), and Payload mounts a full REST API for each at
`/api/<slug>` the moment it is registered.

The rules themselves live in one file, `lib/payload/access.ts`, and the
collections import them by name (`authenticated`, `publishedOrAuthenticated`,
`publicRead`, `authenticatedFieldRead`, `canAccessAdmin`). Payload already denies
unauthenticated writes by default, so this is not a fix for an open hole — it is
the difference between "the default happens to be safe" and "the file states the
rule", and only the second survives a future edit. Most collections were setting
only `read`, which reads to the next person as if writes had been considered and
left open, and gives no anchor for a comment explaining why.

**Users** (`collections/Users.ts`) — the critical one. A publicly creatable user
collection on a CMS means anyone can register themselves and edit the site.

- `create`, `read`, `update` all require `req.user`. No public sign-up, and no
  public listing of who holds an account.
- `unlock` requires it too. It is the operation that clears the lockout in the
  next bullet, so it is the one whose default is worth stating out loud rather
  than inheriting: an unauthenticated unlock would turn a 10-minute brake into a
  no-op. Payload's default already required a user; now the file says so.
- `delete` additionally refuses to delete the requesting user's own account,
  which prevents locking yourself out of the CMS entirely.
- `admin: canAccessAdmin` states who may load the panel at all. Behaviourally
  the same test as `authenticated`, but it cannot reuse that function: Payload
  types the `admin` operation as returning strictly boolean while `Access` may
  also return a WHERE clause, so the narrower signature is the correct one and a
  mistaken assignment is a type error instead of something that silently works.
- `maxLoginAttempts: 5` with a 10-minute `lockTime`. Without this the login
  endpoint is an unlimited brute-force oracle; Basic Auth, which this replaced,
  offered no such limit.
- `tokenExpiration` is 2 hours — short enough that a forgotten session on a
  borrowed machine expires on its own.
- Cookies are `sameSite: "Lax"` and `secure` in production.

**Books, BookChapters, BlogPosts, Lists and Pages** — the draft-enabled
collections. `read` returns `{ _status: { equals: "published" } }` for
unauthenticated requests. This matters specifically because of the REST API
above: without it, anyone could enumerate unpublished drafts over HTTP.
`create`, `update`, `delete` and `readVersions` all require authentication.

`readVersions` is the one worth spelling out, because unset it inherits `read` —
and version history is where every earlier draft of a now-published document
lives. Whether that inherited `_status` filter lands correctly on the versions
table (where the field is nested under `version`) is not something to leave to
inference on the one endpoint whose whole content is drafts. Requiring auth
outright removes the question.

The build reads through the Local API, which bypasses access control by design,
and filters `_status` explicitly instead.

**Authors, Publishers, Categories, Series and Media** — `read` is public,
deliberately. Entity names appear on every page of the site and media files are
served from a public R2 bucket, so there is nothing here that gating would
protect. Writes are authenticated. These four have no draft state at all, which
is why their rebuild hook is `rebuildAlways` rather than `rebuildOnPublish` — a
publish-boundary check on a document with no `_status` never fires.

**The rights block on Books is field-gated, and collection-level `read` could
never have done it.** A published book is public, so every field on it was public
too — including `rightsEvidence`, which holds a rights holder's name, their email
address, the text of their private email and the signed permission document.
`GET /api/books?depth=1` served all of it to anyone. See finding 18 below;
`rightsEvidence` (and `rightsNote`, `publishedBy`, `takedownStatus`) now carry
`access: { read: authenticatedFieldRead }` per field, which is the only layer
that can express "this document is public, these fields are not".

**EvidenceFiles** (`collections/EvidenceFiles.ts`) — the only collection on the
site with **no public read at all**, and the only one where the `read` rule gates
file *contents* as well as metadata. That is the entire reason it exists as a
separate collection rather than a field on `media`: `media` sets
`disablePayloadAccessControl: true`, so the stored URL is the R2 object's public
URL and requests never reach Payload. Evidence has no such bypass, so Payload
serves each file from `/api/evidence-files/file/<name>` and runs
`read: authenticated` before streaming a byte. `mimeTypes` is restricted to the
six an evidence document can plausibly be, and a `beforeValidate` hook refuses
the upload outright in production when `R2_EVIDENCE_BUCKET` is unset — the
fallback would be Vercel's ephemeral per-invocation disk, which reports success
and then loses the file, producing a permission letter the compliance record says
exists and nobody can produce.

**Reviews** (`collections/Reviews.ts`) — the only collection a reader can write
to, and the only place in the app where an anonymous request causes a row to be
inserted, so it gets its own rules rather than a variation on the others:

- `read` returns `{ status: { equals: "approved" } }` for anyone not logged in.
  Same WHERE-clause technique as draft books, and for the same reason: a pending
  review must not be enumerable through a hand-written `GET /api/reviews`, or
  moderation would be cosmetic.
- `create` is `() => false` — closed to everyone, including logged-in editors,
  who create reviews through the admin's own authenticated session instead. The
  collection is the wall; `POST /api/reviews/submit`
  (`lib/payload/submitReview.ts`) is the only door. It caps the request body
  before parsing it, length-checks, resolves the book against **published**
  documents only, verifies Turnstile, rate-limits on a salted IP hash, and forces
  `status: "pending"` before calling `payload.create` with `overrideAccess`. A
  public `create` would let a script POST `status: "approved"` with `rating: 5`
  two hundred times, and the book's JSON-LD `aggregateRating` would launder it
  into a Google-visible number.
- `authorEmail` and `ipHash` carry **field-level** read access requiring
  `req.user`, so they are stripped from the public API response even though the
  collection itself is publicly readable. The IP is never stored raw — only a
  salted SHA-256 (`lib/net/clientIp.ts`) — which is what keeps the rate limiter
  from doubling as a log of who read what.
- No rebuild hook, on purpose (see AGENTS.md). Approval must not spend a build:
  the review list is fetched in the browser, so an approval shows up on the next
  page view.

**Known and accepted, on that endpoint:** `GET /api/reviews` honours a
caller-supplied `?limit=`, and Payload 3.88 has no per-collection REST cap to
bound it (`admin.pagination.defaultLimit` is admin-UI only — confirmed against
`node_modules/payload/dist/collections/config/types.d.ts`). So an unauthenticated
`?limit=99999` is a larger-than-intended query. Left as is: every row it can
return is already public, both private fields are stripped by the rules above,
the compound `book_status_idx` keeps it indexed, and the cost is Neon compute
rather than disclosure. If review volume ever makes that matter, the fix is a
`beforeOperation` clamp on the collection, not a change to the access rules.

**CSRF and CORS** are both restricted to `serverURL` in `payload.config.ts`, so
a third-party page cannot drive the CMS using a logged-in editor's cookie. This
is also why the app must run on port 3000 locally: a mismatched origin is
rejected, which is the control working correctly.

---

## Fixed — real vulnerabilities

These were found and closed. Four of the first six predate the migration and were
carried forward with their fixes intact; two of them no longer apply because the
code they described has been deleted. Findings 18 onwards were found in the
post-launch audit of the Books schema.

### 1. XSS via the "paste a third-party PDF link" field
**Wrong:** the field was rendered directly as an `<a href>`. React does not
sanitize `href` values, so a pasted `javascript:alert(1)` URL would execute on
click.

**Fixed** in two places, deliberately. `collections/Books.ts` validates
`pdfExternalUrl` with `isSafeHttpUrl` at save time so the editor is told
immediately, and `lib/data.ts` checks again at build time. The second check is
not redundant: that field is the only path by which an arbitrary, non-uploaded
URL can enter the data at all, so it is the one place where defence in depth
earns its keep. Every other user-supplied URL on the site — buy links, author and
publisher external links, social links — goes through the same validator, which
is why `isSafeHttpUrl` appears six times in `collections/Books.ts` alone rather
than once.

### 2. Stored XSS in rendered body content
**Wrong:** chapter and page bodies are rendered as HTML. Authors are trusted,
but that trust was the only thing between a mistake — or a compromised editor
account — and a stored-XSS hole affecting every visitor.

**Fixed:** all rendered HTML passes through `sanitize-html` with a strict
allowlist (formatting tags only, no `<script>`, no inline event handlers,
`javascript:` URLs stripped) in `lib/render.ts`.

**The migration-specific catch:** the Lexical editor can now produce more than
Markdown could — tables, `<sub>`/`<sup>`, uploads. The editor's feature list
(`lib/payload/editor.ts`) and the sanitizer's allowlist are a **matched pair**.
A feature enabled in one but missing from the other fails *silently*: the editor
shows a table, the published page shows nothing, and no error appears anywhere.
Both files carry a comment saying so. This is a correctness trap more than a
security one, but it is the reason the allowlist must never be loosened casually
to "make something show up".

### 3. JSON-LD script injection
**Wrong:** structured data was injected via `JSON.stringify(data)` inside
`dangerouslySetInnerHTML`. `JSON.stringify` does not escape `</script>`, so a
chapter title containing that substring would close the
`<script type="application/ld+json">` tag early and break out into real page
HTML.

**Fixed:** `safeJsonLd()` in `lib/types.ts` rewrites every `<` to its unicode
escape, which parses identically inside JSON but can never be read as the start
of a tag by the HTML parser:

```ts
JSON.stringify(data).replace(/</g, "\\u003c")
```

Used everywhere structured data is emitted.

### 4. Timing-unsafe secret comparison
**Wrong:** `/api/cron/rebuild` compared the provided secret with `!==`, leaking
how many leading characters matched.

**Fixed:** `crypto.timingSafeEqual`, with the length-mismatch branch comparing a
buffer against itself so that path takes constant time too.

### 5. OAuth login-CSRF — no longer applicable
The Decap-era finding was that `/api/auth` generated an OAuth `state` value that
`/api/callback` never verified, making the check decorative. It was fixed at the
time with a short-lived httpOnly state cookie. Both routes have since been
deleted along with Decap, so the finding is closed by removal. Recorded here
only so it is not mistaken for an unpatched issue if the old document surfaces.

### 6. Cloudinary unsigned upload preset — no longer applicable
The browser-based uploader used an unsigned Cloudinary preset, which meant
anyone who found the cloud name and preset name (both visible in the admin's
public JS) could upload arbitrary files. The recommended mitigation was a
dashboard-level file size limit.

Resolved by the migration rather than by configuration: R2 uploads go through
Payload's authenticated API, so only a logged-in user can upload at all, and
`collections/Media.ts` restricts `mimeTypes` to the five types the site actually
uses. A stray `.docx` is rejected at upload time instead of sitting in the
bucket looking like a valid chapter PDF.

---

## Closed in this review — surface that had no reason to exist

None of these was a demonstrated exploit. Every one of them was capability the
site was exposing without using, which is the category worth removing while it is
still cheap: an unused endpoint has no test covering it, no reason for anyone to
look at it again, and no compensating benefit when it turns out to have a CVE.

### 7. GraphQL was mounted and nothing queried it
`payload.config.ts` now sets `graphQL: { disable: true }` and the two route files
(`app/(payload)/api/graphql/route.ts`, `.../graphql-playground/route.ts`) are
deleted. The build reads through the Local API and the admin panel speaks REST,
so nothing on this site ever sent a GraphQL query.

What was being left open is an endpoint whose entire purpose is to accept
arbitrary caller-composed nested queries, on a site whose cost model is "no
database traffic at request time at all". Payload ships no `maxComplexity`
default, so a single deeply-nested query against mutually-referencing documents
is a cheap way to spend someone else's database. **If it is ever re-enabled, set
`maxComplexity` in the same commit.**

### 8. REST depth was unbounded
`defaultDepth: 1`, `maxDepth: 2`. Payload resolves relationships to whatever
`?depth=` asks for, and Books ↔ Authors/Publishers/Categories/Series ↔ Media
reference each other, so `GET /api/books?depth=10` fans one public request out
into hundreds of reads. The site itself never needs more than two levels; the cap
makes the request that asks for ten return two rather than being served.

`depth` is also what would populate a relationship a caller cannot read — so the
cap and the field-level rules in finding 18 are the same control seen from two
sides. A depth-limited response cannot be talked into resolving `evidence-files`.

### 9. Uploads had no size ceiling
`upload: { limits: { fileSize: 15_000_000 } }`. `collections/Media.ts` already
restricted `mimeTypes`, so only an authenticated user could upload and only the
right types, but nothing bounded how large. A 500 MB "PDF" from a compromised
editor account is a billed R2 object and a build that runs out of memory
generating derivatives. 15 MB clears the largest real book PDF with room to
spare.


### 10. Missing secrets failed quietly, or half-quietly
`DATABASE_URL` was read straight off `process.env` and `PAYLOAD_SECRET` fell back
to `""`. Both now go through `requireEnv()`, which throws at boot naming the
variable and pointing at `.env.example`.

`PAYLOAD_SECRET` is the load-bearing one: it signs the session JWT. An empty
string is still a *usable* key, so the previous code did not fail loudly — it
booted a CMS whose admin sessions were signed with a value an attacker can guess
on the first try. Failing to start is the only correct behaviour here.

### 11. `/admin`, `/api` and `/preview` were crawlable-but-unindexable only by request
`robots.txt` disallowed `/admin` and `/api` (and now `/preview` too), but
robots.txt is a *crawling* directive. A URL linked from anywhere else can still
be indexed while never being crawled, which is how login pages end up in search
results. All three now also send `X-Robots-Tag: noindex, nofollow, noarchive`,
which is the header that actually forbids indexing rather than asking for it.

Related, in the same change: `poweredByHeader: false` drops `X-Powered-By:
Next.js`. Volunteering the framework to every scanner that touches the site is
the first step of looking up known CVEs against it.

### 12. The CSP was missing the cheap directives
`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `manifest-src`, `media-src`, `worker-src`, plus
`Cross-Origin-Opener-Policy: same-origin`. These are the directives with no
compatibility cost on a site that frames nothing, embeds no plugins, and has one
form. `base-uri` in particular is the one people omit: without it, an injected
`<base href>` silently repoints every relative URL on the page.

And `/admin`, previously exempt from CSP entirely, now gets the four-directive
subset its SPA is indifferent to. "Cannot take the full policy" is not the same
as "cannot take a policy".

### 13. A Page could be slugged over a real route
`collections/Pages.ts` now refuses any `RESERVED_ROUTE_SLUGS` entry. A page
slugged `admin` was not a privilege escalation, but it was an editor able to
create a document that either never renders or shadows a real route, with no
error to explain which.

The list lives in `lib/types.ts` as the single source of truth, and it covers
three kinds of collision, which is why it is longer than it looks: the app's own
URL namespaces (`book`, `author`, `publisher`, `category`, `series`, `list`,
`search`, `new`, `popular`, `blog`), infrastructure (`admin`, `api`, `preview`),
and the well-known files served by metadata routes (`rss.xml`, `sitemap.xml`,
`robots.txt`, `llms.txt`, `og.png`, `icon.svg`, `favicon.ico`,
`manifest.webmanifest`). Pages is the only collection that competes for the bare
`/<slug>` space — every entity hub is namespaced under a prefix — so this one
guard is the whole control. Adding a public route means adding its segment to
that list in the same commit; nothing warns when a slug shadows a route it was
not told about.

### 14. A public path beginning with `admin` got NO security headers at all
The public header rule's `source` was `/((?!admin).*)`. A negative lookahead with
nothing pinning its end is a **prefix** test, so it excluded every path that
merely begins with those five letters — not just `/admin`. `/admin-notice` and
`/administration` therefore failed this rule, and they also failed the
`/admin/:path*` rule below it, so they were served with no CSP, no HSTS, no
`nosniff`, no frame protection and no `Referrer-Policy`.

That was one CMS entry away from being real rather than hypothetical: both are
ordinary slugs that `collections/Pages.ts` accepts (`admin` itself is reserved,
`admin-notice` is not). Any stored-content XSS on such a page would have run with
no CSP as a second layer, and the page would have been framable.

Now `/((?!admin$|admin/).*)`, which matches only the admin route itself and
things beneath it. Verified against the compiled regex in
`.next/routes-manifest.json` rather than by reading it: `/admin`, `/admin/` and
`/admin/collections/books` fall through to the admin rule, while
`/admin-notice`, `/administration` and `/about` all take the full public set.

### 15. The admin was the one authenticated surface with no transport headers
`/admin/:path*` carried `nosniff`, `X-Frame-Options`, `Referrer-Policy`, a
four-directive CSP and `X-Robots-Tag` — but not `Strict-Transport-Security`,
`Permissions-Policy` or `Cross-Origin-Opener-Policy`. Backwards: the admin is
where a downgraded request carries a session cookie, and it is the surface where
a hostile opener or an unnecessary device permission actually costs something.

None of the three has anything to do with how a page loads its scripts and
styles, which is the only reason the admin needs a reduced CSP at all, so none of
them was the reason for the reduction. They are now in a shared
`transportHeaders` list spread into both rules, so the two cannot drift apart
again.

### 16. The cron's deploy-hook call was unbounded and unchecked
`/api/cron/rebuild` ended in a bare `await fetch(hookUrl, { method: "POST" })`.
Three failures, each turning one slow moment at Vercel into something worse than
a skipped rebuild: `fetch` has no default timeout, so a hook that accepts the
connection and never answers held the invocation open until the platform killed
it; a DNS or TLS rejection had nothing to catch it, so the run ended as a 500
whose body explained nothing; and the response was never inspected, so a revoked
hook returning 404 was logged as `{ ok: true }` while scheduled books quietly
stopped going live.

It now has a 10-second `AbortSignal.timeout`, a `try`/`catch` and a status check,
matching `queueRebuild()` in `lib/payload/revalidate.ts`. The failure is reported
as a 200 with `ok: false` rather than a 5xx on purpose — Vercel retries a failing
cron, and retrying a deploy hook that may already have fired is how one scheduled
publish becomes several builds. **The hook URL never reaches the response body**,
only the status: a deploy-hook error body can quote the URL back, and that URL is
a credential — anyone holding it can trigger a production build.

### 17. The AdSense publisher id was interpolated into a script URL unvalidated
`app/(frontend)/layout.tsx` built the loader as
`…adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}` and the
`<ins>` elements took the same raw value. A `NEXT_PUBLIC_*` variable is inlined
into the client bundle at build time, so whatever is typed into the Vercel
dashboard is what ships inside the URL of a `<script>` tag — a query-string
position, one `&` away from appending parameters to a Google script call, and the
value passes through no schema anywhere.

This was never reachable by a site visitor: setting it requires the Vercel
project, which is a bigger capability than the bug. It is fixed because a typo
and an injection look identical here and neither reports anything — a malformed
client id makes every ad on the site silently not fill, which is the exact
failure that is hardest to notice.

`adsenseClient()` in `lib/ads.ts` now returns the value only if it matches
`/^ca-pub-\d{10,20}$/`, and `adSlotId()` gates each slot on `/^\d{6,20}$/`. Both
`undefined` on a mismatch, which the components already treat as "not
configured", so a bad value renders no ad rather than a broken one. The same
validated string feeds the preconnect hint, the script `src` and every
`data-ad-client`, so they cannot disagree.

### 18. Third-party permission evidence was served by the public API — and by a public bucket
**The most serious finding in this document, and the only one that disclosed real
personal data belonging to people who are not users of this site.**

`rightsEvidence` on Books is the Tier C audit trail: the rights holder's name,
their email address, the pasted text of their private email granting permission,
and the signed permission document. Books' `access.read` is
`publishedOrAuthenticated`, so a published book is public — and in Payload,
collection-level `read` grants every field on the document. `GET
/api/books?depth=1` therefore returned the whole block to anyone who asked, with
no authentication, for every published Tier C book. Nothing on the site rendered
it, which is exactly why it went unnoticed: the leak was in the API, not the page.

**Fixed at two layers, because one was not enough.**

*The fields:* `rightsEvidence` and its `contact`, `emailText` and `document`
sub-fields, plus `rightsNote`, `publishedBy` and `takedownStatus`, now carry
`access: { read: authenticatedFieldRead }`. Field-level access is the only
mechanism that expresses "this document is public, these fields are not"; there is
no collection-level rule that could have done it without unpublishing the book.

*The bytes:* the uploaded document used to point at `media`, which sets
`disablePayloadAccessControl: true` — the stored URL **is** the R2 object's public
URL, and requests for it go to Cloudflare without ever touching Payload. So no
Payload rule, field-level or otherwise, was on the path the bytes actually
travelled: a permission letter was public from the moment the upload finished, and
stayed public after the book was deleted. Evidence now uploads to a separate
`evidence-files` collection on a separate private bucket with no bypass, served
from `/api/evidence-files/file/<name>` behind `read: authenticated`.

**Not fixed by code, and still owed:** every object already in the public media
bucket is still public. See the standing obligation at the top of this document —
that sweep, and notifying the affected rights holders, is the remainder of this
finding.

### 19. The review rate limiter was not a rate limiter
`POST /api/reviews/submit` is the one first-party unauthenticated write on the
site. Its limiter ran `payload.count()` over the reviews table and compared the
result to a constant, which fails two separate ways:

- **It was not atomic.** Three requests arriving together all counted the same two
  existing rows, all passed, and all inserted. The effective limit was whatever
  the concurrency happened to be — precisely the condition a script creates.
- **It counted stored rows, not attempts.** A submission rejected *after* the
  check — failed Turnstile, validation deeper in, a database error — cost the
  sender nothing. A script that never managed to store a review had unlimited free
  attempts at the endpoint, the Cloudflare round trip and the book lookup behind
  it.

**Fixed** with `kvBumpWindow` (`lib/payload/kv.ts`): one atomic statement whose
`RETURNING` clause hands back this caller's own position in the window, on a
counter that lives **outside the request transaction** so it survives the failure
of the request it is guarding. Six attempts per salted IP hash per ten minutes.
The allowance is larger than the old three precisely because it now counts
attempts — a reader whose Turnstile token expired while the form sat open should
not be locked out — and the checks that cost nothing to perform (missing name, too
short a body) run *before* the counter is touched, so they stay free.

Two related caps in the same change. The request body is size-limited to 32 KB
**before it is parsed** (`lib/net/readJsonBody.ts`, checking `content-length` and
then enforcing it against the stream, because a declared length is a claim): this
is the only place on the site where an attacker chooses how many bytes the server
parses. And `collections/Reviews.ts` gained a compound `ipHash` + `createdAt`
index, without which the limiter's own lookup was a sequential scan that got
slower as the abuse got worse.

**The platform half is a dashboard action and is not done by this repository.**
The limiter above is atomic and correct, but it runs *after* the request has
reached a serverless function. A Vercel firewall rule on that path is what stops a
flood from costing invocations at all — see the settings table near the top.

### 20. Every rating on the site was one approval behind, and concurrent approvals raced
The denormalised `ratingCount` / `ratingAverage` pair on Books is recomputed by an
`afterChange` hook on Reviews. Three defects, in the order they mattered:

1. **It could not see its own trigger.** The recompute called `payload.find()`
   without `req`, which opens a connection *outside* the request's transaction —
   and `afterChange` runs before that transaction commits. Under READ COMMITTED
   the second connection saw the review's old status, so approving a book's first
   review computed a count of zero and approving the second computed one. Passing
   `req` is the fix, and it is why `lib/payload/db.ts` takes `req` explicitly
   rather than guessing.
2. **It stopped at 1,000 reviews.** `limit: 1000` silently truncated both the set
   and the average, at an invisible threshold: a bestseller crossing a thousand
   approved reviews would freeze its own aggregate for ever. `COUNT` and `AVG` now
   run as one statement in Postgres, which is both exact and cheaper than
   paginating a thousand rows into Node to add them up.
3. **Concurrent approvals clobbered each other.** Two moderators approving two
   reviews of the same book each read a snapshot taken before the other committed,
   and the second write won with a count one too low. A
   `pg_advisory_xact_lock` keyed on the book id now serialises recomputes per
   book. Taking it in its own statement is load-bearing: folded into the aggregate
   as a CTE it would share that statement's snapshot and prove nothing.

Not a disclosure bug, but it is a security-adjacent one: `ratingAverage` is
published in the book's JSON-LD `aggregateRating`, so a wrong number is a wrong
number Google repeats.

### 21. The rights-tier gate was written by hand in places that disagreed
This is the site's compliance control rather than a security control, but it fails
the same way a security control does — quietly, on one surface at a time — so it
belongs here.

Every book carries a `rightsTier`. Three tiers may be delivered as a PDF
(`public-domain`, `open-licence`, `permitted`); `in-copyright` gets buy links
only. A **stricter** rule governs the online reader: `permitted` means a rights
holder gave written permission to distribute *a PDF*, and republishing the same
work as indexable HTML chapters on our own domain is a separate act of publication
that permission does not grant — and the one that competes with the publisher's
own edition in search results.

That stricter rule had been written out by hand in two places that disagreed:
`collections/BookChapters.ts` refused to attach a chapter to anything but Tier
A/B, while `lib/data.ts` attached chapters to any book that was merely not
in-copyright. A `permitted` book with chapters — created before a
reclassification, or by an import that bypassed validation — was therefore
rejected by the CMS and rendered by the site.

**Fixed** by making both rules named functions in `lib/types.ts` with every
caller importing them: `tierAllowsDelivery()` guards the download button, the
sitemap's priority, search's free-only filter and the structured data;
`tierAllowsOnlineReading()` guards `collections/BookChapters.ts`,
`collections/Books.ts`, `lib/data.ts`, the reader route's
`generateStaticParams()`, the book page and the sitemap. `isRightsTier()` **fails
closed** — an unrecognised or missing tier is treated as `in-copyright`, so a
typo, a hand-edited row or a future tier added to the database but not to the code
withholds the file rather than serving it.

---

## The draft-preview route

`/preview` is the only request-time public route in the app, which makes it the
only one where a request can reach the database. Three controls, in order:

1. `payload.auth()` runs against the incoming cookies **before any document
   lookup**, so an unauthenticated request never reaches a query.
2. `overrideAccess: false` on the lookup, so the collection's own `access.read`
   still applies. This is the opposite of the Local API's default and it is the
   point: preview is the one place the site reads Payload at request time on
   behalf of a caller, so it must read as that caller.
3. An explicit allowlist of previewable collections. Without it, a hand-edited
   `?collection=users` would be a perfectly well-formed request.

The URL carries a collection slug and a numeric document id, no token. Payload
can mint a short-lived preview JWT, but that is for decoupled front ends; here
the CMS and the site are the same Next app, so the browser already sends the
admin session cookie. A token would be a second credential to scope, expire and
leak — the cookie is the one that already exists and is already httpOnly.

It also sends `noindex` and is disallowed in `robots.txt`. Neither is the
control; both cost nothing and remove the chance of a preview URL pasted into a
chat app being indexed.

---

## Dependency vulnerabilities

`npm audit` reports **0 vulnerabilities**, and that claim now has a mechanism
behind it rather than a memory: `.github/workflows/audit.yml` re-runs it weekly
and fails on `high` or above, and Dependabot opens grouped update PRs. The finding
this closes was never "these packages are old" — it was that **nothing was
watching**.

The audit workflow deliberately runs no `npm ci`. `npm audit` resolves the
advisory database against the lockfile, so no install is needed — which also means
it cannot execute a compromised install script while looking for one.

- **PostCSS XSS bug** — bundled transitively inside Next's own dependency tree,
  which a normal version bump would not have reached. Closed with a
  `package.json` `overrides` entry forcing the patched version everywhere,
  including inside Next's internal tree. `dompurify` and `@esbuild-kit`'s
  `esbuild` are pinned the same way and for the same reason. These overrides are
  load-bearing; removing one silently reintroduces a known CVE, and Dependabot
  will not tell you, because an override is not a dependency declaration.
- **Next.js image-optimizer DoS (CVE-2025-59471)** — had no patched 14.x
  release, so it was left open under the old stack with a documented interim
  mitigation. **Now genuinely fixed**, as a side effect of the Next 16.3.1
  upgrade the Payload migration required.
- **`npm ci`, never `npm install`, in CI.** It installs exactly the tree recorded
  in `package-lock.json` and fails when the lockfile and `package.json` disagree.
  Without it, CI can silently test a different dependency tree than the one that
  ships.

---

## Hardening in place

**Security headers** (`next.config.mjs`), applied to every response:
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS with `preload`, and a
real Content-Security-Policy scoped to the third parties actually in use
(AdSense, Vercel Analytics/Speed Insights, Cloudflare Turnstile). No font host
appears in it: `next/font` self-hosts the Google font at build time, so `font-src`
is `'self' data:`.

`'unsafe-inline'` is kept in `script-src` because several inline scripts are
deliberate: JSON-LD, the dark-mode init script, the AdSense push call. This is a
permanent decision, not an oversight, and the reason is architectural. A nonce
must be freshly generated per *response*, which requires a per-request render —
every public page here is a static file on a CDN, and adding a render to mint a
nonce would convert every page into a serverless function, the one thing this
architecture exists to avoid. Hashes fail differently: the inline JSON-LD differs
on every chapter page, so the hash list would have to be per-page and shipped in
a per-page header, which static hosting cannot express.

What the policy still buys with `'unsafe-inline'` present: the `src` allowlist is
unchanged, so an injected `<script src=...>` pointing off the list is blocked, as
is exfiltration over fetch/XHR (`connect-src`) and plugin loading
(`object-src 'none'`). The injection path it does *not* stop is inline script
arriving through CMS content — which is why `sanitizeContentHtml()` in
`lib/render.ts` is the actual control there, and why its allowlist has no
`<script>`, no event-handler attributes and no `javascript:` scheme. CSP is the
second layer, not the first.

`'unsafe-eval'` is present **in development only**, gated on
`process.env.NODE_ENV === "development"`. React's dev build uses `eval()` to
reconstruct component stacks for the error overlay; without it every dev-time
error arrives with no callstack. `next build` sets `NODE_ENV=production`, so the
policy that ships to Vercel never contains it. If you ever see `unsafe-eval` in a
response from the live site, something is running a dev build in production.

**Two honest caveats:**

1. **AdSense compatibility is unverified against live ads.** If an ad format
   fails to render once `NEXT_PUBLIC_ADSENSE_CLIENT` is set, this CSP is the
   first thing to check — ad networks sometimes call subdomains not listed here.
2. **`/admin` gets a reduced CSP,** not the full one: `frame-ancestors 'none'`,
   `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, plus `nosniff`,
   `X-Frame-Options: DENY`, `Referrer-Policy` and `noindex`. Notably absent are
   `script-src` and `style-src`, because Payload's admin is a single-page React
   app that inlines both. The four directives that remain cover the attacks that
   actually apply to an authenticated panel: being framed (clickjacking an editor
   into clicking Delete), plugin embedding, `<base>` rewriting, and form
   retargeting. Reaching anything behind it still requires a login. It is a real
   gap and worth revisiting if Payload's admin ever ships a documented CSP.

**Image host allowlist** — `images.remotePatterns` contains only the R2 public
hostname, derived from `NEXT_PUBLIC_R2_PUBLIC_URL` so it cannot drift from the
CSP's `img-src`. An unrestricted allowlist turns Next's image optimizer into an
open proxy, letting anyone route arbitrary traffic through the site's CDN quota.
Cloudinary was removed from this list only after confirming nothing still
referenced a Cloudinary URL.

**The private evidence bucket is deliberately absent from this allowlist and from
`img-src`.** An evidence file is never rendered on the site, so nothing should be
able to load one as an image — and `NEXT_PUBLIC_R2_PUBLIC_URL` must never be
pointed at the evidence bucket, which would put its hostname in both.

**Admin login Turnstile gate** (`lib/payload/loginTurnstile.ts`,
`components/payload/auth/LoginTurnstile.tsx`). Optional, off unless BOTH
`NEXT_PUBLIC_TURNSTILE_LOGIN_SITE_KEY` and `TURNSTILE_LOGIN_SECRET_KEY` are set.
When on, `enforceTurnstileGate` runs as a `beforeOperation` hook on Users for
`operation === "login"` — before the password is checked — and rejects any login
that does not carry a short-lived, `PAYLOAD_SECRET`-signed, httpOnly cookie. The
cookie is minted only by `/api/users/turnstile-gate`, which verifies the widget
token with Cloudflare server-side and fails closed. A script POSTing straight to
`/api/users/login` never solved a challenge, so it has no valid cookie. Verified
live with Cloudflare's public test keys: no cookie → 403; token exchange → 200 +
Set-Cookie; login with the cookie → reaches the password check; a forged cookie →
403. The stock admin form posts to that same `/api/users/login`, so there is no
UI bypass.

**Robustness finding closed this review: a widget that fails to draw was a silent
lockout.** `isLoginTurnstileConfigured()` proves the two variables exist; it says
nothing about whether a challenge actually reached the screen.
`turnstile.render()` returns a widget id and creates the hidden response input
*before* the challenge iframe arrives, and when the iframe never arrives — this
host missing from the sitekey's Cloudflare "Domains" list, a blocked cross-origin
frame, a browser extension, or Cloudflare error 300030 — every callback stays
silent and the container stays zero-height. With the gate enforced that is a hard
lockout behind an empty gap. Seen live during testing (`iframeCount: 0`, console
`Error: 300030`). Fixed by surfacing it, not by weakening the gate:
`components/Turnstile.tsx` now reports the failure through a new `onError` prop
(script blocked, explicit widget error, or nothing drawn within a 10s timeout),
and `LoginTurnstile.tsx` renders visible admin copy naming the likely causes and
the recovery path — clear `TURNSTILE_LOGIN_SECRET_KEY` (and `TURNSTILE_SECRET_KEY`)
and redeploy to switch the gate off without a code change. The server gate stays
enforced regardless of what the browser reports, because "the widget broke" is a
trivially forgeable claim that must never become a universal bypass.

---

## Reviewed and found correct

- **`/api/cron/rebuild` is the only unauthenticated endpoint that changes real
  state,** and it is gated by `CRON_SECRET` with a timing-safe comparison. If
  the secret is unset the route refuses every request rather than running
  unauthenticated, which is the correct failure direction.
- **`PAYLOAD_SECRET` has no fallback default.** It goes through `requireEnv()` in
  `payload.config.ts`, which throws at boot if the variable is missing. It signs
  the session JWT, so a predictable value — including the empty string this used
  to fall back to — would let anyone forge an admin session. Refusing to start is
  the only correct failure direction.
- **Draft and scheduled content never reaches the build.** Filtering happens in
  `lib/data.ts` before static HTML is generated, so a draft is not a "hidden but
  technically downloadable" page — it does not exist in the output. Confirmed
  against real build output, not just the filter logic.
- **`/admin` being publicly reachable is intentional.** The page itself is a
  login screen; authorization is Payload's session check. Hiding the URL would
  add nothing, and it is `noindex`'d so it stays out of search results.
- **`robots.ts` disallows `/admin`, `/api` and `/preview`,** which keeps the REST
  endpoints and the preview route out of search indexes. Not a security control
  on its own — it is a request, not an enforcement, which is why the
  `X-Robots-Tag` header backs it up — but the right hygiene alongside the access
  rules that *are* enforced.
- **No secret is bundled to the browser.** Only `NEXT_PUBLIC_*` variables reach
  client code, and every one of them is public information by nature (site URL,
  R2 public base, AdSense client ID, verification tokens).
- **Media files bypass Payload's access control on purpose**
  (`disablePayloadAccessControl: true`), served straight from R2's public URL.
  Correct here: the bucket holds only content meant to be public, and proxying
  it through Payload would spend Vercel function invocations to protect nothing.
  **The corollary is finding 18: nothing that is not meant to be public may ever
  be uploaded to this collection.** `evidence-files` exists so there is somewhere
  else for it to go.
- **The build has no request-time attack surface to review.** Every public page is
  a static file on a CDN; `lib/data.ts` reads Postgres only during `next build`.
  The four dynamic routes (`/admin`, `/api`, `/api/cron/rebuild`, `/preview`) are
  therefore the complete list of places a request can reach code that reaches the
  database, and each is covered above. A change that adds a fifth is a change to
  this document's scope, not just to a route table.

---

## Process notes

- **`.env` must stay gitignored.** `DATABASE_URL` carries the database password
  in the URL. `.env.example` documents every variable and must never hold a real
  value.
- **If the private repo is ever made public,** its git history exposes anything
  ever committed. That includes the pre-migration Markdown content tree and any
  draft content in it, and it includes every `.env` a contributor ever committed
  by accident — which is what makes the push-protection setting in *Settings that
  are not code* worth turning on before the mistake rather than after.
- **Content now lives outside git,** so the repo is no longer a backup of it.
  Neon's point-in-time restore is the actual backstop. Know how to use it before
  you need to.
- **Payload's `/api` is a real, public API surface** in a way nothing in the
  Decap setup was. The access rules above are what constrain it. Any new
  collection needs its `access` block written deliberately at the same time as
  its fields — not afterwards.
- **A new field is an access-control decision, not just a schema change.** Payload
  grants a collection's `read` to every field in it, so adding a field to Books
  publishes it. Finding 18 is that sentence learned the expensive way. If a field
  holds anything a third party told you in confidence, it needs
  `authenticatedFieldRead` in the same commit that adds it, and if it holds a
  *file* it needs `evidence-files` rather than `media`.
- **CI is the only check that runs without being remembered.**
  `.github/workflows/ci.yml` runs typecheck, lint, unit tests, the production
  build and Playwright on every pull request, and `audit.yml` runs `npm audit`
  weekly. Neither is a control until `main` is protected and both CI jobs are
  required — see *Settings that are not code*. Read that section as part of this
  one: roughly a third of what this document describes is enforced by a dashboard
  toggle, cannot be verified by reading the repository, and silently does not
  exist until somebody clicks it.
- **This document goes stale in a specific way.** It names files, collections and
  constants, and a reviewer who checks a named file and finds nothing concludes
  the control is missing. It happened here: this file described `collections/
  Comments.ts` and a comments endpoint for months after both were replaced by
  Reviews. When a rename touches anything named above, grep this file for the old
  name in the same commit.

# Admin panel redesign

The brief: the CMS should read as a modern SaaS product — beautiful, organised,
obvious. Every page, not just the index.

This document is the diagnosis and the plan. It is written before the code so the
reasoning survives the change: what was actually wrong, what was already right,
what each edit buys, and which gates prove nothing broke on the way.

Read §1 for the problem, §3 for the work, §5 for how it is verified.

---

## 1. What is actually wrong, measured

The instinct on hearing "the admin looks messy" is to reach for the stylesheet.
That would have been the wrong move here, and the numbers say why.

| Symptom | Measurement |
| --- | --- |
| The dashboard shows nothing | `/admin` is Payload's stock card grid: 15 identical tiles with `+` buttons. No counts, no queue, no activity, nothing to act on. |
| The nav has no shape | 15 entities in 2 groups: `CONTENT` (11 links) and `SETTINGS` (4). |
| Edit screens are one long scroll | **Not one collection in this project uses `tabs`. Not one uses `row`.** |
| The Books sidebar does four jobs at once | **56 named fields, 23 of them stacked in a ~300px sidebar**: publishing, rights and compliance, seven relationship pickers, a bibliographic group, and four read-only counters. |
| A label bug is shipping | `collections/Lists.ts:40` reads `labels: { singular: "Lists (list)", plural: "Lists (lists)" }`, so the nav says **"Lists (lists)"**. |
| Collection copy has no common shape | Some `admin.description` values are full Bengali paragraphs, some are English sentences, some switch language mid-sentence. |
| The theme documents a dashboard that does not exist | `theme/chrome.css:701` and `theme/fields.css:570` both refer to "the custom dashboard in `components/payload/dashboard/`". That directory has never existed. |

None of those are colour problems. They are structure problems, which is why the
fix is mostly TypeScript and only partly CSS.

`payload.config.ts:157-163` already names the first one as deferred work:

> No dashboard view override: [...] A Boidwip-shaped dashboard (books per
> category, review moderation queue depth) can be reintroduced later via the same
> `views.dashboard` slot.

This is that "later".

---

## 2. What is already right, and must not be thrown away

`app/(payload)/theme/` is **3,413 lines** of documented CSS across six files, and
it is good. It already carries:

- a complete token system (`tokens.css`, 485 lines): brand ramp, semantic
  danger/warning/positive pairs, surfaces aliased to Payload's elevations so they
  invert with the theme for free, a 4px spacing scale, a type scale, two motion
  curves;
- the override mechanism that makes all of it work without a single
  `!important` — everything Payload ships is inside `@layer payload-default`, and
  unlayered CSS beats layered CSS at any specificity;
- a re-tinted panel achieved by redefining exactly two ramps
  (`--color-base-*` and `--color-success-*`) rather than by chasing components;
- reusable objects already themed: `.card`, `.card--has-onclick`, `.banner--type-*`,
  `.pill--style-warning`, `.pill--style-error`, `.tabs-field__tab-button--active`.

Two details prove the design system was built *for* the work in this document and
then left unfinished:

```css
--bdw-text-3xl: 2rem; /* 28px — dashboard greeting, stat figures */
```

...and `.tabs-field__tab-button--active` is fully styled although no collection
has ever rendered a tab.

So: **no new design language.** The dashboard is assembled from tokens that
already exist, and the tab strip is already themed before the first tab ships.

---

## 3. The plan

Seven parts, in the order they are applied.

### 3.1 A dashboard that answers "what do I do next?"

New server component at `components/payload/dashboard/`, registered as

```ts
views: { dashboard: { Component: "/components/payload/dashboard/Dashboard#default" } }
```

**What the slot gives us, verified in
`node_modules/@payloadcms/next/dist/views/Dashboard/index.js`.** Payload's
`DashboardView` already renders `HydrateAuthProvider` and `SetStepNav nav={[]}`
around whatever component sits in this slot, and passes these serverProps on top
of `AdminViewServerProps`:

```
globalData, i18n, locale, navGroups, payload, permissions, user, visibleEntities
```

Two consequences. The custom view **must not** render its own `SetStepNav`, or the
breadcrumb is set twice. And `navGroups` arrives pre-filtered: `getNavGroups`
drops any entity the signed-in user cannot `read` and any entity hidden from
`visibleEntities`, so a grid built from it is permission-correct without a single
check of our own.

**Four bands, top to bottom.**

1. **Greeting and orientation.** The editor's first name, the date, and one line
   naming what this panel publishes. Uses `--bdw-text-3xl`, the step the token
   file reserved for it.
2. **Counters.** Published books, drafts, free PDFs, chapters, authors, pending
   reviews. Each is a `payload.count()` passed the view's own `req`, so access
   control and the request transaction apply exactly as they would to a list view.
3. **Needs attention.** The band that makes the dashboard worth opening. Each row
   is a real query with a real deep link into a filtered list view:
   - reviews awaiting moderation (`status: pending`);
   - books whose rights tier permits delivery but which carry no PDF;
   - books with no cover image;
   - books with `takedownStatus: notice-received`, which is a legal clock;
   - books whose `publishDate` is in the future and are therefore not live yet;
   - authors and publishers with no biography or about text.
   A row with a count of zero renders as a satisfied tick, not as a hidden row:
   "no pending reviews" is information.
4. **Grouped entity grid.** The stock dashboard's flat 15 tiles, rebuilt from
   `navGroups`, so it carries the same seven group headings as the sidebar and
   every card lands under the label the editor just clicked past.

Cost: `/admin` is already one of exactly four dynamic routes in this project, so
querying the database there is consistent with the "the site is a build artefact"
cost model. Nothing on the public site gains a request-time query.

### 3.2 A navigation that names its groups

`admin.group` is the only lever, and group **order** is the order of first
appearance in the `collections` array followed by the `globals` array
(`groupNavItems`, verified). Two groups become seven:

| Group | Entities |
| --- | --- |
| Catalogue | Books, Chapters |
| Taxonomy | Authors, Publishers, Categories, Series |
| Editorial | Reading lists, Blog, Pages |
| Moderation | Reviews |
| Files | Media, Evidence files |
| Access | Users |
| Settings | Site settings, Affiliate settings |

Three of those are the point. **Moderation** is a workflow, not a content type,
and Reviews is the only collection an editor visits to make a decision rather than
to write. **Files** finally separates the cover images an editor reaches for daily
from a collection of legal documents that happened to be filed under Settings.
**Access** and **Settings** are split because "who can log in" and "how the site
behaves" are different questions, and because a group whose first item is the odd
one out reads as a bundle rather than a category.

Labels are English. That is the `AGENTS.md` convention for admin chrome, and there
is a mechanical reason too: the group heading is uppercased with
`letter-spacing: 0.055em`, and letter-spacing applied to Bengali breaks conjunct
rendering.

Singleton groups (Moderation, Access) are deliberate. A label of one is honest;
padding it out with something unrelated is what produced `CONTENT` holding eleven
links in the first place.

### 3.3 Edit screens that fit on one screen

The largest change, and the one with the most careful safety argument.

**Unnamed `tabs` and `row` wrappers do not change field paths.** They are
presentation-only, so the Postgres schema is untouched and no migration is
needed. A **named** tab would create a nested group and *would* change the schema;
none is used. `admin.position: "sidebar"` is likewise presentational.

Two further guarantees, both checked in `node_modules` rather than assumed:

- **Field-level access rules travel with the field object.** `rightsBasis`,
  `rightsEvidence` (and its `contact` / `emailText` / `document` sub-fields),
  `rightsReviewedBy` and `takedownStatus` each carry
  `access: { read: authenticatedFieldRead }`. Moving a field from the sidebar into
  a tab moves that object, rule included.
- **List columns still resolve from inside a tab.** `buildColumnState` flattens
  with `flattenTopLevelFields(..., { keepPresentationalFields: true,
  moveSubFieldsToTop: true })`, and that helper *always* hoists the fields of an
  unnamed tab and of a `row`. So `defaultColumns: [..., "engagement", ...]` keeps
  working after the `engagement` UI field moves into a tab.

**Books: 56 fields, 23-field sidebar → 7 tabs, 6-field sidebar.**

| Tab | Fields |
| --- | --- |
| Overview | `title` + `titleLatin` (row), `subtitle`, `originalTitle`, `serpPreview` |
| Content | `synopsis`, `review`, `whoShouldRead`, `tableOfContents`, `quotes`, `faqItems`, `awards`, `adaptations` |
| Classification | `authors`, `translator`, `publisher`, `categories`, `primaryCategory`, `series` + `seriesNumber` (row), `bibliographic` |
| Rights | `rightsBasis`, `licenceName` + `licenceUrl` (row), `rightsEvidence`, `rightsReviewedBy`, `takedownStatus` |
| Files | `cover`, `pdf`, `pdfExternalUrl`, `pdfPages` + `pdfSizeBytes` (row), `epub` |
| Buying | `rokomariUrl`, `priceBdt` + `mrpBdt` (row), `priceCheckedAt`, `stockStatus`, `otherStores` |
| Performance | `downloadCount`, `ratingAverage`, `ratingCount`, `engagement` |

The sidebar keeps six things, and only things that answer "is this live, and may it
be": `previewLinks`, `slug`, `rightsTier`, `publishDate`, `popular`, `featured`.

`rightsTier` stays in the sidebar **on purpose** even though there is now a Rights
tab. It is the field that decides whether the page may legally carry a PDF at all,
`lib/render.ts` gates delivery on it, and a compliance gate that can be scrolled
out of sight is a compliance gate you forget. Visible on every tab is the point.

`bibliographic` is a **named** group and moves out of the sidebar unchanged, so its
`bibliographic.isbn13`-style paths are byte-identical afterwards.

**Every other collection, proportionately.** Tabs are not applied for their own
sake; a 4-field collection does not need a tab strip.

| Collection | Fields | Change |
| --- | --- | --- |
| Books | 56 | 7 tabs, sidebar 23 → 6, five `row` pairs |
| Authors | 15 | 2 tabs, sidebar 9 → 3, `birthYear`/`deathYear` row |
| Publishers | 12 | 2 tabs, sidebar 8 → 3 |
| Categories | 8 | sidebar 5 → 4, `name`/`nameLatin` row, `icon` to main column |
| Series | 7 | `coverImage` out of the 300px sidebar into the main column |
| Chapters | 5 | `chapterNumber`/`wordCount` grouped, descriptions rewritten |
| Reading lists | 7 | label bug fixed, `coverImage` to main column |
| Blog, Pages | 7, 4 | descriptions only |
| Media, Evidence files, Users | 2, 1, 1 | descriptions only |

The pattern behind every row of that table: **the sidebar answers "is this live?",
the main column answers "what is this?"** Anything that is neither publishing state
nor a flag belongs in the main column, and an upload widget never belongs in a
300px rail.

### 3.4 List screens you can read at a glance

Two new client cells, plus the primitive they share:

- **`CellPill`** — the pill itself, extracted rather than copied three times. Not
  Payload's own `<Pill>`: that component's padding arrives through four
  `--pill-padding-*` properties which default to `0` and are set by its `size`
  prop, so borrowing the class alone renders text with no box around it. The
  export that matters more is the rule attached to it: **tones are semantic.**
  `positive` means settled, `warning` means someone must look, `danger` means a
  problem now. A value that is a fact rather than a state gets `neutral`, so
  colour in a list always means the same thing.
- **`RightsTierCell`** — a book's rights tier as a pill, using the Bengali labels
  already in `lib/types.ts`. Public domain and open licence read positive;
  permitted reads neutral; in-copyright reads warning. Today that column is raw
  enum text. Unknown values fail closed to `warning`, because a tier this cell
  does not recognise is exactly the one a human should check.
- **`StatusCell`** — the same treatment for a review's `pending` / `approved` /
  `spam`, so the moderation queue is scannable without reading a word.

`EngagementCell` is rewritten in the same pass, because it was broken rather than
merely plain: it counted a `comments` collection that this project does not
register, so the column showed an em dash on every row of every list it appeared
in. It now counts `reviews`, de-duplicates concurrent requests for the same book
and caches per book id, since a list view mounts one cell per row.

`defaultColumns` is revisited alongside them, and Reviews gains `book` earlier in
the row because "which book" is the first thing a moderator needs.

### 3.5 Copy an editor can act on

"All the options should be clear and understandable" is a copy problem before it is
a layout problem. Today the thirteen collection descriptions have no common shape,
and four of them switch language mid-sentence.

Every `admin.description` is rewritten to one shape: **what this collection is,
then the single rule that trips people up.** English, per the `AGENTS.md`
convention that admin chrome is English, with Bengali kept only where an English
word would be the wrong word — series names, category names, the rights-tier
labels. Field-level hints stay on the field, where the decision is being made.

The `Lists` label bug is fixed in the same pass:

```ts
labels: { singular: "Reading list", plural: "Reading lists" },
```

### 3.6 The theme work the redesign requires

Small, and two thirds of it is a bug the tabs would otherwise expose.

**The tab strip would have broken the paper card.** Payload ships five rules that
bleed a tabs field and a top-level group to the edges of their container:

```css
.tabs-field                       { margin-inline: calc(var(--gutter-h) * -1) }
.tabs-field__content-wrap         { padding-inline: var(--gutter-h) }
.tabs-field__tabs::before/::after { width: var(--gutter-h) }
.group-field                      { margin-inline: calc(var(--gutter-h) * -1) }
.group-field--top-level           { padding: var(--base) var(--gutter-h) }
```

All five are written for a `.document-fields__edit` padded by `--gutter-h`, which is
60px at desktop width. This project deliberately converted that gutter into a
*margin* so the edit view reads as a sheet of paper (`surfaces.css`), and pads the
sheet by 24px instead. So the first tab strip added to this codebase would have hung
**36px outside the rounded card edge on both sides** — a tab row and two hairline
rules floating over the canvas. `surfaces.css` even warned about it and declined to
write the rule, on the grounds that no collection used tabs yet. Both halves of that
comment are now false: Books, Authors and Publishers all render tabs, and Books'
`bibliographic` is a named top-level group inside one of them.

The fix does not *cancel* the bleed — a tab strip inset from the card's edge reads as
a divider rather than as the card's own chrome. It re-points all five rules at the
inset this card actually uses, which is why that figure becomes a custom property:

```css
.document-fields__edit { --bdw-sheet-inset: calc(var(--base) * 1.2); }
```

`responsive.css` re-declares `--bdw-sheet-inset` at the phone breakpoint (where
Payload drops `--gutter-h` to 16px and the sheet's own 24px inset would be paid
twice), and the five dependent rules follow it for free. Overriding
`padding-inline` alone there — the obvious edit — would have left the four
negative-margin rules reaching for the desktop figure and hung the tab strip 12px
outside the card on the one screen size with no room to spare.

`--top-level` is the correct hook for the group rules and a bare `.group-field` is
not: unlayered CSS beats Payload's layered CSS at equal specificity, so the broader
selector would also flatten the `--within-row`, `--within-group` and
`--within-collapsible` variants Payload zeroes the margins on. `isTopLevel` in
Payload's `GroupField` is `!(isWithinCollapsible || isWithinGroup || isWithinRow)`,
i.e. exactly the complement of those three, so scoping to it changes the bleeding
case and nothing else.

**No seventh theme file.** The plan called for
`app/(payload)/theme/dashboard.css`; it was not written, and `layout.tsx` is
unchanged. The dashboard owns every element it renders, so its styles are a
co-located CSS module (`Dashboard.module.css`, matching `NavBrand.module.css`) that
is deleted along with the folder if the view ever goes. The tabs fix belongs in
`surfaces.css`, beside the gutter-to-margin conversion that caused it; a file named
`dashboard.css` containing a tabs fix would have been misnamed.

**Corrected:** the stale comments at `chrome.css:701-703` and `fields.css:570` that
describe `components/payload/dashboard/` as if it existed. After this change it
does, so both become true statements instead of aspirational ones. Same for
`surfaces.css`, which claimed "this project registers no globals" — it registers
two, and since Payload uses `baseClass = 'collection-edit'` for globals as well
(verified in `views/Edit/index.js`), the existing rule already covers them.

---

## 4. What must not change, and the gates that prove it did not

Four constraints govern every edit above. Each has a mechanical check, not a
promise.

**1. The database schema.** No field is renamed, added, removed or nested in a
*named* container, so Drizzle should see nothing.

```bash
npx payload migrate:create --skip-empty
```

Acceptance: **no migration file is written**, and `migrations/` still holds its
original five entries. `--skip-empty` is the flag that turns this into a gate rather
than a report: without it Payload writes an empty migration and exits 0 either way.
Anything appearing in `migrations/` means a named container crept in, and the change
is wrong, not the migration.

**Result: no file written.** This is the empirical confirmation of the claim the
whole of §3.3 rests on.

**2. The CI drift gate.** `.github/workflows/ci.yml` regenerates
`payload-types.ts` and `app/(payload)/admin/importMap.js`, then runs
`git diff --exit-code`. Three new components are registered by string path, so both
generators must run and their output must be committed:

```bash
npm run generate:importmap
npm run generate:types
```

**3. Relative imports in the config graph.** `payload.config.ts` and everything
reachable from it uses `./collections/...`, never `@/`. Payload's CLI loads that
file through tsx, outside Next's bundler, where the tsconfig path alias is not
guaranteed. `next build` would compile fine while every `generate:*` and `migrate`
command died on a module-not-found. The new dashboard is referenced by *string
path*, not imported, so it never enters that graph.

**4. Field-level read access.** The five rights fields carrying
`authenticatedFieldRead` are moved, not rewritten. `tests/` covers the public
payload shape; `vitest run` is the check.

---

## 5. Verification

In order, all of it before the zip is built:

```bash
npx payload migrate:create --skip-empty
npm run generate:importmap
npm run generate:types
npm run typecheck
npm run lint
npm run test
npm run build
```

All seven pass: no migration written, both generators idempotent (so the CI drift
gate is satisfied), `tsc` clean, ESLint 0 errors, 51 tests in 4 files, and a
production build of 38 static pages. ESLint reports 14 `no-explicit-any` warnings,
all of them pre-existing and none in a file this change touches.

Then the panel itself, in the browser, on the running dev server: the dashboard,
the seven nav groups, a Books edit screen on every one of its seven tabs, the Books
list, and the Reviews list. Structure is checked with an accessibility snapshot
rather than a screenshot, because a snapshot reports exact text and nesting.

The tab fix in §3.6 is checked by measurement rather than by eye, since 36px of
overhang and 0px of overhang look similar in a screenshot scaled to fit a pane. At
1440px the sheet's padding box runs 61→909, and `.tabs-field`,
`.tabs-field__content-wrap`, `.tabs-field__tabs` and `.group-field--top-level` each
span exactly 61→909, with the first tab button at x=85 (61 plus the 24px `::before`
spacer) and `document.documentElement.scrollWidth` at 1425, inside the 1440
viewport.

**The dashboard's own invariant gets its own gate.** §3.1 claims every metric's
count and its deep link are built from the same conditions. Reading the file cannot
prove that; the two can drift on the first edit and still typecheck. So the claim is
checked mechanically: build the dashboard data, then parse each metric's *own href*
back into a `where` with the same `qs-esm` parser Payload's list view uses, count
again, and compare. **11 of 11 metrics agree.**

A row reading `0` on both sides proves less than it looks, so each zero row's
complement is counted too — if the condition really partitions the collection,
row + complement is the whole set. It does: `no-synopsis` 0+6=6, `no-cover` 6+0=6,
`thin-authors` 0+3=3, `scheduled` 0+6=6.

That run also demonstrated the null path for real. Given `user: null`, the takedown
row came back `null` rather than `0`, because `takedownStatus` carries
`authenticatedFieldRead` and Payload answers a query on an unreadable field with a
400 rather than with zero rows. So a mistyped or unreadable field name in
`queries.ts` cannot surface as a reassuring zero — it surfaces as an em dash.
`components/payload/dashboard/queries.ts` records this where the `null` return is
defined.

**The engagement column gets the same gate, for the same reason.** §3.4 says the old
cell was replaced because it queried a collection this project does not register, and
an always-empty column is a false claim about the data rather than a visible bug. A
replacement that is wrong in the same way would look identical, so the new endpoint
was checked from the browser with a live admin session:

| request | result |
| --- | --- |
| `/api/reviews/count` | `{"totalDocs":1}` — the route exists and answers |
| `?where[book][equals]=6` | `1` — the book that has the review |
| `?where[book][equals]=1` | `0` — a book that does not |
| `?where[book][equals]=6&where[status][equals]=pending` | `0` — that review is `approved` |
| `?where[bookk][equals]=1` | **400** `QueryError: The following path cannot be queried: bookk` |

The fourth row is the one that matters most, because it is the pair of counts the
cell actually renders: on the Books list, book 6 shows one `brand` pill reading
"1 review" and no pending pill, and the other five books show the "No reviews yet."
em dash. Those zeroes are the data, not a dead fetch. The fifth row shows this
endpoint fails the same way `queries.ts` does — a mistyped field path is a 400, the
cell's `!res.ok` throw turns it into "Review counts could not be loaded", and it
cannot be mistaken for "no reviews". `GET /api/:collection/count` is a first-party
Payload collection endpoint (`payload/dist/collections/endpoints/count.js`,
registered at path `/count`), not a route this project has to maintain.

---

## 6. File-by-file

This table is the record of what was actually written, so where the work departed
from the plan above, it says so.

**New**

| File | Purpose |
| --- | --- |
| `components/payload/dashboard/Dashboard.tsx` | The view. Server component. |
| `components/payload/dashboard/Dashboard.module.css` | Its internals — and, since no `theme/dashboard.css` was written, the four bands too. |
| `components/payload/dashboard/StatCard.tsx` | One counter. |
| `components/payload/dashboard/AttentionList.tsx` | The "needs attention" band. |
| `components/payload/dashboard/queries.ts` | Every `count()` and the deep link built from the same conditions, in one place, so the view is layout. |
| `components/payload/list/CellPill.tsx` | The pill and the tone vocabulary the three cells share. |
| `components/payload/list/RightsTierCell.tsx` | Rights tier as a pill. |
| `components/payload/list/StatusCell.tsx` | Review status as a pill. |
| `ADMIN-REDESIGN.md` | This document. |

**Changed**

| File | Change |
| --- | --- |
| `payload.config.ts` | Register `views.dashboard`; replace the "no dashboard view override" comment with what is actually there now. |
| `collections/Books.ts` | 7 tabs, sidebar 23 → 6, five rows, `RightsTierCell`, description. |
| `collections/Authors.ts` | 2 tabs, sidebar 9 → 3, birth/death row, `group`, description. |
| `collections/Publishers.ts` | 2 tabs, sidebar 8 → 3, `group`, description. |
| `collections/Categories.ts` | Row, `icon` to main, `group`, description. |
| `collections/Series.ts` | `coverImage` to main, `group`, description. |
| `collections/BookChapters.ts` | `group`, descriptions. |
| `collections/Lists.ts` | **Label bug**, `coverImage` to main, `group`, description. |
| `collections/BlogPosts.ts`, `Pages.ts` | `group`, descriptions. |
| `collections/Reviews.ts` | `StatusCell`, `defaultColumns`, `group`, description. |
| `collections/Media.ts`, `EvidenceFiles.ts` | `group: "Files"`, descriptions. |
| `collections/Users.ts` | `group: "Access"`, description. |
| `globals/SiteSettings.ts`, `AffiliateSettings.ts` | Descriptions. |
| `components/payload/list/EngagementCell.tsx` | Rewritten: it counted a `comments` collection this project does not register, so the column was an em dash on every row. Now counts `reviews`, through `CellPill`. |
| `app/(payload)/theme/surfaces.css` | `--bdw-sheet-inset`, and the five `.tabs-field` / `.group-field--top-level` bleed rules re-pointed off `--gutter-h`. The stale comment that declined to write them is replaced with the reasoning. |
| `app/(payload)/theme/responsive.css` | The phone breakpoint now overrides `--bdw-sheet-inset` rather than `padding-inline`, so the four negative-margin rules follow it. |
| `app/(payload)/theme/chrome.css`, `fields.css` | Stale comments corrected: both describe `components/payload/dashboard/`, which now exists. |
| `app/(payload)/admin/importMap.js` | Regenerated: 10 → 13 project components. |

**Planned and deliberately not done**

| File | Why not |
| --- | --- |
| `app/(payload)/theme/dashboard.css` | The dashboard's styles are a co-located CSS module instead, and the tabs fix went to `surfaces.css` where its cause lives. See §3.6. |
| `app/(payload)/layout.tsx` | It only needed editing to import the file above. Unchanged. |

**Deliberately unchanged:** every migration in `migrations/`, `payload-types.ts`
(regenerated, byte-identical as expected), the whole public site under
`app/(frontend)/`, `lib/`, and `tests/`. If any of those move, something in this
plan was wrong.

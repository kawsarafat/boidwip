# SEO, Colour and Reader Report

Everything below was measured against a production build (`npm run build` + `npm run
start`) on port 3000, not inferred from source. Where a number appears, the command
that produced it is described so you can re-run it.

Build state at the time of writing: `tsc --noEmit` clean, `eslint .` 0 errors /
14 pre-existing warnings, 94 unit tests passing across 5 files, 19 Playwright tests
passing with 2 honest skips, `next build` exit 0 with exactly the four permitted
dynamic routes.

---

## 1. Your ten asks, and where each one landed

| # | Ask | State |
|---|-----|-------|
| 1 | Titles need SEO changes | Done. Rewritten as one formula set in `lib/seo.ts`; every page verified. |
| 2 | Repaint the whole site in more professional colours | Done. Warm terracotta/paper → cool wine/near-white, single-source tokens. |
| 3 | Research and apply site-wide SEO, Google-policy compliant, 100/100, no speed loss | Done for SEO (Lighthouse SEO 100 on every page sampled). Speed: see §6, which reports a real shortfall honestly rather than claiming a pass. |
| 4 | `/category/oitihashik-uponnash` title should read "উপন্যাসের বই" style | Done, applied to all four categories. |
| 5 | `/popular` title should carry the count | Done, exactly the string you specified, and the same pattern on every hub. |
| 6 | `/book/parineeta/read` 404s | Fixed. It is now a real table-of-contents page. |
| 7 | Chapter pages over-emphasise the chapter; book first, in SEO and on the page | Done, and measured (§7). |
| 8 | No sidebar in online reading | Done. `components/ReaderSidebar.tsx`, on both the chapter page and the new index. |
| 9 | Blog has no sidebar, no buy option, too plain | Done. Sidebar, priced Rokomari buy cards, richer layout. |
| 10 | Admin text inputs are a mess: dead space above, no room to type | Fixed, and measured in pixels (§9), because the screenshot is illegible at the scale available to me. |

An eleventh item was added after you read the first draft of this report and authorised
the one recommendation it flagged as your call: per-book citation of the text source,
which needed a schema change on your live database. That is §11, and it includes what
was run against production.

---

## 2. Titles

### The problem with the titles you had

Two separate faults. The first was that hub titles named a subject without
qualifying it, so `/popular` and `/category/...` competed with every other Bengali
book site for the same bare phrase and offered a searcher no reason to click. The
second is subtler and is why this needed a formula rather than hand-editing:
**Google truncates a title by pixel width, not by character count.** A Bengali
title is far wider per character than a Latin one because of conjunct stacking,
and the variance between titles is large. Measured on this site's own titles at
`20px`, real values run **7.9 to 9.3 px per character**. Counting characters, which
is what most SEO checklists tell you to do, does not predict truncation in Bengali
at all.

### What the titles do now

`lib/seo.ts` holds one formula per page type. The hub formula is the one you
specified:

```
জনপ্রিয় বাংলা বই - ফ্রি PDF ও রিভিউ (৬টি) | বইদ্বীপ
```

Subject, then what the page actually offers, then a live count, then the brand.
The count is read from the same query that renders the grid, so the number in the
SERP is the number on the page. Applied identically to `/popular`, `/new` and all
four categories. Categories take the Bengali genitive you asked for, so
`ঐতিহাসিক উপন্যাস` becomes `ঐতিহাসিক উপন্যাসের বই`, not a loose `এর`.

Curated lists are the one place the formula steps back. `curatedListTitle` has
three arms: a short editorial title gets the full suffix; a medium one gets only
the count; a long one is left alone, because a hand-written list title like
`ক্লাসিক বাংলা উপন্যাস: যেগুলো একবার হলেও পড়া উচিত` is already the best possible
title for that page and padding it would only push it past the pixel budget. A
title that already contains a numeral is never given a second one.

### Measured result

Titles rendered from the live build, measured with `canvas.measureText` at
`20px Arial, "Noto Sans Bengali", sans-serif` against the ~600px desktop budget:

- **0 of 30 titles exceed 600px.** Before this work, 5 of 30 did. The four titles the
  formula change pulled back inside the budget went **777 → 562**, **693 → 568**,
  **674 → 533** and **670 → 548** px.
- Widest is `/author/sarat-chandra-chattopadhyay` at **584px** (70 characters).
- No duplicate titles anywhere. No duplicate descriptions. All 30 descriptions land
  inside 70 to 165 characters once HTML entities are decoded (longest 165,
  shortest 86).

One honest caveat on that 584px. The same title measures **612px** if the Bengali
glyphs fall back to a generic system font instead of Noto Sans Bengali, and 561px in
the site's own Anek Bangla. So that single author title sits right at the boundary,
and under an unlucky fallback it clips roughly 12px, which costs part of `দ্বীপ` in
the brand suffix and nothing else. `lib/seo.ts` is written for exactly that outcome:
the brand goes last precisely because it is the part that can be lost without
harming the result.

---

## 3. Colour

### What changed

Colour on this site is single-source: `tailwind.config.ts` maps semantic names
(`ink`, `surface`, `accent`) onto CSS custom properties, and the "R G B" triplets
live in one `:root` block and one `.dark` block in `app/(frontend)/globals.css`.
Repainting the site therefore means editing those two blocks, and nothing else had
to be touched. Recovered from the pre-repaint archive for an exact comparison:

| Token | Before | After |
|-------|--------|-------|
| `--canvas` | `#FAF8F4` warm paper | `#F7F8FA` cool near-white |
| `--surface` | `#FFFFFD` | `#FFFFFF` |
| `--surface-sunken` | `#F5F2EC` | `#EFF1F5` |
| `--ink` | `#211E19` (16.4:1) | `#141A22` (17.5:1) |
| `--ink-muted` | `#676157` (5.8:1) | `#5A6472` (6.0:1) |
| `--rule` | `#E8E3DA` | `#DFE3EA` |
| `--accent` | `#9A4223` terracotta (6.0:1) | `#93233B` wine (8.3:1) |
| `--accent-soft` | `#F7EBE4` | `#F7E8EB` |
| `--warn` | `#B2540E` | `#8F6200` (5.4:1) |
| `--on-accent` | did not exist | `#FFFFFF` light / `#0F1319` dark |

### Why this reads as more professional

The old palette was warm: a cream page, a brown-black ink and a terracotta accent.
Warm neutrals read as crafty and homespun, which is a reasonable choice for a
literary site but it is the choice that made the site look like a hobby project. The
new palette is cool and low-chroma in the neutrals — a near-white page with a blue
undertone, a slate-black ink, hairlines in the same cool family — with the only
saturated colour being a deep wine accent. That is the standard editorial and
publishing register: the neutrals recede completely and one restrained accent does
all the work.

The two functional colours are deliberately unchanged. Green stays green for "buy
the hardcopy" and blue stays blue for "free PDF", because those two are load-bearing
signals and recolouring them to match a new accent would have cost the reader more
than it gained.

### The `--on-accent` token, and a real bug it fixed

`--on-accent` is new, and it exists because the repaint exposed an accessibility
failure that the old palette had been hiding. Dark mode lifts the accent to a pale
tint so it reads on a dark surface (`#E59AA4`). `.btn-primary` was putting white
text on that tint, which measures **2.21:1** — a clear WCAG failure that would have
shipped. There is no single text colour that works on both the dark wine used in
light mode and the pale wine used in dark mode, so the correct fix is a token: white
on the accent in light mode, near-black on it in dark mode. Both directions now
measure 8.3:1.

### Measured result

Every element on all 30 sitemap pages was checked by computing its foreground colour
against its nearest opaque ancestor background and comparing to the WCAG threshold
(4.5:1 normal text, 3:1 large text):

- **0 contrast failures across all 30 pages**, in both light and dark mode.
- Lighthouse accessibility **100** on all six pages sampled.

Live token ratios: ink/surface 17.49, ink-muted/surface 6.00, accent/surface 8.25,
on-accent/accent 8.25, ink/canvas 16.46, ink-muted/canvas 5.65, accent/canvas 7.77,
ink-muted/surface-sunken 5.31.

---

## 4. Google policy compliance

You asked for SEO that ranks, done according to Google's policy. The ranking part is
not something any developer can promise; what can be done is to make sure the site
does not trip any of the spam policies that would cap it, and that the on-page work
is the kind Google's own documentation says it rewards. Four of Google's spam
policies apply directly to a site of this shape. Each is quoted from
`developers.google.com/search/docs/essentials/spam-policies`.

### Thin affiliation

Google's definition targets sites "publishing content with product affiliate links
where the product descriptions and reviews are copied directly" from the merchant,
with nothing original added, and explicitly names cookie-cutter pages replicated
across a site. This is the policy a book site with Rokomari links is most likely to
fall foul of.

What protects this site is that the affiliate link is never the reason a page exists.
Every book page carries a summary, rights status, chapter structure where the text is
public domain, reviews, and an FAQ block, and the buy prompt is one quiet card at the
end. On the reader, there is exactly one buy prompt, after the chapter text, with no
sticky bar and no mid-chapter interruption. The policy's own list of what makes an
affiliate page legitimate — real substance, first-hand detail, comparisons, category
navigation — is the list this site's book and category pages satisfy.

### Link spam

Google states plainly that monetised links are fine "as long as they are qualified
with a `rel="nofollow"` or" a sponsored value. Verified on the live build across four
different templates (book page, blog post, curated list, chapter page): **every
outbound Rokomari anchor carries `rel="sponsored nofollow noopener"`** and
`target="_blank"`. There are no unqualified affiliate links anywhere on the site.

### Scraping

The relevant example is the first one Google lists, and the clause at the end of it is
the one that matters here:

> "Republishing content from other sites without adding any original content or
> value, or even citing the original source"

This site publishes public-domain Bengali literature, which is legal to republish, but
the policy is not about legality — it is about whether a page adds value and whether
it says where the text came from. The value side is covered: chapter pages carry
reading time, chapter position, book context, a table of contents and a full
navigation hierarchy that a bare text dump would not have.

**The citation side is now covered too.** This was the one recommendation in this
report I had left unimplemented, because it needed a schema change on your live
database; you authorised it, and §11 below records exactly what was done. Every page
that serves public-domain text now ends with a footnote naming the source it was
transcribed from, linked to that source's own page for this book, plus one sentence
saying why the book is out of copyright. Measured on the current build: **12 of the 30
sitemap URLs carry it** — all six book pages, both reader indexes and all four chapter
pages, which is every page that serves or offers a text, and no page that does not.

### Doorway abuse

Defined as pages "created to rank for specific, similar search queries" that funnel
visitors through go-betweens. Two places on this site were at risk, and both are
handled in code rather than by judgement:

- **Author and publisher pages.** `isThinEntityPage()` in `lib/seo.ts` marks a page
  with too few books and too thin a bio as `noindex, follow`. It still renders and is
  still linked, so readers can use it; it just does not ask to be ranked until it has
  something to rank for. The sitemap holds the same pages out using the same
  expression, so the sitemap and the meta robots tag never contradict each other.
- **The new reader index.** A table of contents is exactly the shape a doorway takes,
  so it was given the things a doorway does not have: per-chapter word counts and
  reading times, the book's total length, the cover, the summary, and the download
  route out. It is the hub every chapter links back to, not a page that exists only
  to catch a query.

### Scaled content abuse

Not applicable in substance — there is no generated content on this site — but worth
recording that the reason it is not applicable is structural. Every public route pairs
`generateStaticParams()` with `dynamicParams = false`, so the set of URLs the site
admits to having is a finite list computed from real CMS rows at build time. The site
cannot spray parameterised URLs even by accident, and a URL that was not prerendered
answers 404 rather than rendering something thin on demand.

---

## 5. Measured SEO results

### Lighthouse

Six representative pages (`/`, `/book/parineeta`, `/category/uponnash`, a chapter,
a blog post, `/popular`), headless Chrome, mobile emulation:

| Category | Score |
|----------|-------|
| SEO | **100** on all six |
| Accessibility | **100** on all six |
| Best practices | **96** on all six |
| Performance | 59 to 74 — see §6 |

The single failing best-practices audit is `errors-in-console`, and its contents are
localhost-only artifacts: `/_vercel/insights/script.js` and
`/_vercel/speed-insights/script.js` return 404 and are then refused for MIME type
(four items, all four from those two scripts). Those routes exist only on a Vercel
deployment, so on production this audit passes and best practices should read 100. I am
reporting 96 because 96 is what I measured.

SEO, accessibility and best practices were re-run on the final build after the
`og:type` fix described below, and still read 100 / 100 / 96 with the same single
console-error failure. The performance figures in §6 come from the earlier run; the
`og:type` change adds no script and no markup weight, so it cannot move them.

### Full-site audit, all 30 sitemap URLs

Every URL in the sitemap was fetched from the running production build and checked:

- 30/30 return **200**. No URL in the sitemap 404s or redirects.
- **Exactly one `<h1>` per page**, and **0 heading-level jumps** anywhere.
- Canonical present on all 30 and **self-referencing** on all 30.
- `lang="bn"` on all 30. No accidental `noindex`.
- All four required Open Graph properties (`og:title`, `og:type`, `og:url`,
  `og:image`) plus `og:description` present on all 30.
- **0 JSON-LD parse failures.** Structured data per template: home gets
  Organization/WebSite/FAQPage; book pages add Book/BreadcrumbList/FAQPage; chapters
  add Chapter/BreadcrumbList; the reader index adds Book/ItemList/BreadcrumbList;
  categories add CollectionPage/BreadcrumbList/ItemList; authors add
  Person/BreadcrumbList/ItemList; blog posts add BlogPosting/BreadcrumbList.
- `robots.txt` closes `/admin`, `/api`, `/preview` and faceted `/search?`.
- `/og.png` serves 200 `image/png`; `/rss.xml` serves 200 `application/xml`.

### A real bug this audit caught: `og:type` missing on 19 of 30 pages

Worth writing down because the cause is a Next.js behaviour that is easy to get wrong
and silent when you do.

**Next replaces a page's `openGraph` object wholesale rather than deep-merging it
with the layout's.** Only `title` is special-cased, because it goes through a
template. Every page on this site defines its own `openGraph` block — it has to, for
the per-page `url` and image — which means the root layout's `type: "website"`
reached exactly one page: the homepage. Nineteen of the thirty sitemap URLs shipped
with no `og:type` at all, including all three trust pages, every category, every
author, both listing hubs, `/blog`, `/search` and the whole reader.

It survived because it degrades instead of breaking: consumers assume `website` when
the property is absent. It is still wrong, since `og:type` is one of Open Graph's four
required properties, and the site was inconsistent about it in a way that reads as
oversight to anything validating the markup.

Fixed by spelling `type` out on all fourteen affected page files, with the reasoning
documented in `lib/og.ts` next to the identical problem already recorded there for
`openGraph.images`. Re-verified after rebuild: **0 of 30 pages missing `og:type`**,
distributed 12 `website`, 8 `book`, 8 `article`, 2 `profile`.

---

## 6. Speed: the number I cannot report as a pass

You said there can be no compromise on SEO or speed. SEO measures 100. **Speed does
not, and I am not going to present it as if it did.**

Lighthouse performance, mobile emulation, localhost:

| Page | Perf | FCP | LCP | TBT | CLS |
|------|------|-----|-----|-----|-----|
| `/` | 67 | 1.0s | 4.3s | 760ms | 0 |
| `/book/parineeta` | 65 | — | — | — | — |
| `/category/uponnash` | 67 | — | — | — | — |
| chapter page | 59 | 1.1s | 4.5s | 1380ms | 0.02 |
| blog post | 68 | — | — | — | — |
| `/popular` | 74 | — | — | — | — |

### What is actually slow, and what is not

Four things are ruled out by measurement rather than by assumption:

- **It is not third parties.** Lighthouse's `third-party-summary` audit came back
  **empty**. No AdSense, no Turnstile, no analytics loaded in the run. Every
  millisecond of blocking time is first-party.
- **It is not layout instability.** CLS is 0 on the homepage and 0.02 on the chapter
  page. This also settles an earlier audit finding that book cover images lack
  `width`/`height`: the container reserves the box with `relative aspect-cover w-full`,
  and the measured CLS confirms it works.
- **It is not a redirect.** Lighthouse's `redirects` audit claims 620ms, but `curl -D -`
  returns `HTTP/1.1 200 OK` directly and `curl -L` reports `redirects=0 code=200`. The
  audit lists the same URL twice with `wastedMs` 615.81 and 0. It is an artifact of
  the `Vary: rsc, next-router-state-tree, ...` header, not a real hop.
- **It is not a slow image.** The LCP element on the chapter page is a `<p>` of chapter
  prose. LCP is text waiting behind main-thread work.

### What is slow

Lighthouse's `bootup-time` audit attributes **3,176ms to the document URL itself**,
against 838ms and 245ms for the two static chunks. Time attributed to the document
rather than to a `.js` file means inline script evaluation, which in the App Router
means the RSC flight payload. I measured the documents to confirm it:

| Page | Total HTML | RSC flight payload | JSON-LD | Markup + text |
|------|-----------|-------------------|---------|---------------|
| chapter | 106,606 B | **61,746 B (57.9%)** | 1,839 B (1.7%) | 41,787 B (39.2%) |
| `/` | 112,152 B | **67,670 B (60.3%)** | 3,768 B (3.4%) | 39,480 B (35.2%) |
| `/book/parineeta` | 104,787 B | **60,320 B (57.6%)** | 3,269 B (3.1%) | 39,964 B (38.1%) |

(Buckets are mutually exclusive and checksum to the byte against the total.)

So roughly **60% of every document is inline RSC payload** that duplicates the markup
below it, and the browser must parse and evaluate all of it on the main thread before
the page is interactive. That is the whole story of the 59 to 74. It is a
characteristic of React Server Components as shipped, not a defect introduced by this
work: nothing in the SEO or colour changes added script, and JSON-LD accounts for
under 4% of the document.

### How much of this is the localhost caveat

Some, but not all, and I would rather be precise than reassuring. Localhost inflates
TBT because the CPU is shared with the dev machine, and it removes the CDN, HTTP/2
prioritisation and Brotli that production gets — a ~60KB inline payload compresses
extremely well, so the transfer cost largely disappears on Vercel. What does **not**
disappear is the parse-and-evaluate cost, because that happens after decompression.
Expect production to score meaningfully better than 59 to 74, and expect it to still
be short of 90.

**Honest bottom line: SEO is at 100 and I can defend that number. Speed is not, and
closing the gap means reducing per-page RSC payload — fewer client components in the
tree, so less of the page has to be serialised for hydration. That is an
architectural change with real design consequences, which is why I have not made it
unilaterally.** If you want it, it is the single highest-leverage performance change
available and I can scope it.

---

## 7. The reader

### `/book/<slug>/read` used to 404

You found this: the chapter URL worked, the parent did not. That is the worst possible
shape for a hierarchy — a set of indexable chapter documents hanging off a parent that
returns 404 — and it also meant a reader who trimmed the chapter off the address hit a
dead end.

Because `dynamicParams = false` makes `generateStaticParams()` the definition of which
URLs exist at all, the fix had to be a real page rather than a rewrite. There is now
`app/(frontend)/book/[slug]/read/page.tsx`, prerendered for every Tier A/B book that
actually has chapters. `/book/parineeta/read` returns 200 with the title
`পরিণীতা অনলাইনে পড়ুন - সব পরিচ্ছেদ (২টি) | বইদ্বীপ`.

The rights gate is restated at that route's prerender boundary, the same way the
sitemap and the chapter route restate it, so the new page cannot serve chapter links
for a book outside the public-domain and open-licence tiers even if rows existed.

### Book before chapter

You said the chapter was highlighted more than the book, in both SEO and the page.
Both are now the other way round, and both are measured rather than eyeballed.

**In the title.** `chapterTitle()` puts the book first:
`পরিণীতা - প্রথম পরিচ্ছেদ | অনলাইনে পড়ুন | বইদ্বীপ`. This matters more than it looks.
A chapter name like `প্রথম পরিচ্ছেদ` is shared by every Bengali novel ever printed; on
its own it matches no query and tells a searcher nothing about where they have landed.
The chapter stays in the title because it is what makes each of these pages distinct,
but it is subordinate.

**On the page.** One `<h1>` holds both names, the book as a link and the chapter as a
subordinate line. Measured computed styles: the book link renders at **36px / weight
800**, the chapter span at **18px / weight 600** — a 2× size ratio. Two separate
headings would have made the chapter a child of a heading the page never states, and a
bare chapter `<h1>`, which is what it was, leaves a search visitor looking at
`প্রথম পরিচ্ছেদ` with no idea whose.

I checked the accessibility consequence rather than assuming it: an `<h1>` containing
two block-level children could have produced a run-on accessible name. Chrome inserts
a space between block children, and the AX tree confirms the heading's accessible name
is `"পরিণীতা প্রথম পরিচ্ছেদ"`. No change needed.

### The reader sidebar

The chapter page previously carried a comment asserting "DELIBERATELY NO SIDEBAR", on
the grounds that a rail of জনপ্রিয় বই is noise next to chapter text. That reasoning is
correct as far as it goes, and it is why the fix is not the site-wide `Sidebar`. But it
threw out the table of contents along with the noise, which left a reader walking a
long novel one prev/next hop at a time, and left every chapter internally linked only
to its two neighbours.

`components/ReaderSidebar.tsx` carries the chapter list, the book, and the two ways to
keep it. Verified on the live build: an `aside` on the chapter page showing
`পড়ছেন পরিচ্ছেদ ১ / ২` with the chapter links and the cover, and an `aside` on the new
reader index. The prose keeps its own ~65ch measure inside the now-wider column, since
a reading measure that grows with the viewport is the one thing a long-form page must
not do.

---

## 8. The blog

Three complaints: no sidebar, no way to buy the books, too plain. All three addressed,
and verified on the live build:

- **Sidebar** on both the blog index and each post, with `জনপ্রিয় বই` and a
  `বিষয়সমূহ` topic list (10 links).
- **Buy options.** The Sarat Chandra post carries **3 Rokomari cards with live
  prices** (`রকমারিতে কিনুন · ৳১৩২`, `রকমারিতে কিনুন`, `রকমারিতে কিনুন · ৳৩২৪`). All
  carry `rel="sponsored nofollow noopener"`.
- **Less plain.** `/blog` now emits a `Blog` node in its structured data and its title
  carries the post count: `বই নিয়ে ব্লগ - বই আলোচনা ও পাঠ-পরামর্শ (২টি লেখা)`. Posts
  emit `BlogPosting` + `BreadcrumbList` and run substantial body copy (3,206
  characters on the post checked).

---

## 9. The admin text fields

Your screenshot showed a large blank band above each rich-text field and not enough
room to type. I could not verify a fix from a screenshot — the preview pane available
to me is about 351px wide and scales a 1440px viewport down to illegibility — so I
measured the geometry directly instead. Before and after, in pixels:

| Measurement | Before | After |
|-------------|--------|-------|
| Toolbar flush offset | 49 | **1** |
| Toolbar overlapping the text | 48px | **0** |
| Gap, toolbar to first line | 35 | **25** |
| Gutter top vs first line offset | mismatched | **25px == 25** |
| Empty field height | collapsed | **80px** |
| Toolbar sticky top | — | 56px |
| Container padding | — | `0px 15px 10px` |
| Help band | — | `padding: 8px 15px`, `rgb(244, 245, 248)` |

The dead band was a toolbar sitting 49px out of flush and overlapping the first line of
text by 48px, so the visible effect was empty space above and a cramped typing area
below. Both are now zero, the gutter and the first text line are aligned to the same
25px, and an empty field holds an 80px box instead of collapsing. You said the problem
was everywhere, so the fix is at the shared field-wrapper level rather than per
collection.

---

## 10. Disclosures

Four things you should know that you did not ask about.

**A production deployment was queued.** Updating the two blog-post titles wrote to
Payload, and `lib/payload/revalidate.ts` POSTs `VERCEL_DEPLOY_HOOK_URL` on any content
write. The log recorded `[rebuild] deployment triggered by
blog-posts/sarat-chandra-sera-uponnash` and the second write folding into the same
queued deployment. One real Vercel deployment ran. The effect is benign to positive —
production picked up the corrected titles, and the deploy builds from committed HEAD so
no uncommitted local code shipped — but it was a side effect of a content edit rather
than a deliberate deploy, and you should know it happened. `context: { skipRevalidate:
true }` suppresses it if you ever want a silent content write.

**The admin panel is still blue.** The public site is now wine; the admin keeps its
blue accent (`--color-success-500: rgb(47, 85, 184)`), with the reasoning recorded in
`app/(payload)/theme/tokens.css`. That was deliberate — admin chrome is a tool, not
brand surface — but if you want the two to match, say so and it is a small change.

**Two Playwright tests skip, and the skips are honest.** One needs a `permitted`-tier
book and one needs an in-copyright book; this dataset has neither, since all six seeded
books are `public-domain`. They are not silently passing.

**Two audit findings were deliberately not "fixed", because they are not defects.**
Empty `alt` on book covers is a documented WCAG decision recorded in
`components/CoverImage.tsx` (the cover is adjacent to the title text it would
duplicate). Missing `width`/`height` on those images is answered by the reserved
aspect-ratio container, and the measured CLS of 0 and 0.02 proves it.

---

## 11. The text-source citation, now implemented

This section used to be headed "Recommended, not implemented" and its first item was
the citation gap. You authorised it. It is done, on your live database, and this is the
account of what was changed.

### What the gap was

Google's Scraping policy language is `"...without adding any original content or value,
or even citing the original source"`. The site added value, so it was never in
violation, but it did not cite where each public-domain text came from.

The sharper reason was internal. `content-seed/seed.mts:426` contains a **published**
blog post telling readers `প্রতিটি বইয়ের পাতায় লেখা থাকে সেটি কেন পাবলিক ডোমেইন` —
"each book's page states why it is public domain." The site did not keep that promise.
The only field that would have said so, `rightsBasis`, is authenticated-read-only, so it
never reached a public page. A live post promised something the site did not do.

### Why the fix is a new field pair rather than publishing `rightsBasis`

`rightsBasis` could have been published — Payload's Local API defaults to
`overrideAccess: true`, so the field-level read rule that protects REST and GraphQL does
not apply to the build-time data layer, and `lib/data.ts` could simply have read it.
That would have worked and would have been wrong. `rightsBasis` mixes provenance with
*our legal reasoning about someone else's work*; the reason it is
`authenticatedFieldRead` is that the reasoning is not for publication. Splitting the
citation out of it is what makes the citation publishable. A reader is owed where the
text came from. They are not owed our reasoning, and we are not obliged to publish it.

### What was added

**Two public fields on `collections/Books.ts`**, in a new row in the Rights tab between
the licence pair and `rightsEvidence`: `textSourceName` (Bengali, as the reader sees it)
and `textSourceUrl` (validated by `isSafeHttpUrl`, so a `javascript:` URL cannot be
saved). Both are hidden by the existing `condition` when the tier is `in-copyright`,
where they would be meaningless. The tab's own description was corrected, because it
previously claimed everything but the licence pair was logged-in-only, which stopped
being true the moment these two fields existed.

**A third value that cost no schema at all: `publicDomainNote`.** The blog post promises
the *why*, not just the *where*, and the why was already derivable. Bangladesh's term is
life plus 60 years counted from the year after death, `lib/rights.ts` already implements
that arithmetic, and author death years are already in the database. So
`publicDomainNoteFor()` in `lib/render.ts` composes one Bengali sentence from them at
build time. It returns null rather than guessing whenever the tier is not
`public-domain`, any contributor's death year is missing, or the arithmetic disagrees
with the editor's tier — a page that contradicts itself about copyright is worse than a
page that says nothing. The governing year is the **maximum** across authors *and* the
translator, because a translation carries its own fresh copyright.
### What was changed on your production database

This is the part you authorised, so it gets stated plainly rather than buried.

`migrations/20260904_150000_book_text_source.ts` adds four columns, not two. Books is a
drafts collection, so every field exists twice: on `books` and, `version_`-prefixed, on
`_books_v`. A column added to one and not the other makes every version read fail on the
missing column, so the twin is not optional. All four are nullable `varchar` with
`IF NOT EXISTS` guards; there is no index, no constraint and no data migration, and
`down()` drops them in reverse order. It is additive and reversible.

Because Drizzle `push` is off in every environment (AGENTS.md), the sibling snapshot
`20260904_150000_book_text_source.json` was written by hand from the previous snapshot —
key order preserved, the new columns inserted after `licence_url` and
`version_licence_url` respectively, `prevId` chained to the evidence-files migration.
Verified after writing: 52 tables, `public.books` at 49 columns, `public._books_v` at 53.

**The migration is already applied to your live Neon database.** `payload migrate:status`
showed it pending, `payload migrate` reported `Migrated: 20260904_150000_book_text_source
(165ms)` and `Done.` I then ran `content-seed/backfill-text-source.mts`, which **updated
all six book rows**, because the migration leaves existing rows NULL and the seed's
`ensure()` skips slugs that already exist, so neither the migration nor a re-seed would
have written the values. Every write carried `context: { skipRevalidate: true }`:
`lib/payload/revalidate.ts` POSTs `VERCEL_DEPLOY_HOOK_URL` on any content change, and six
unguarded updates would have fired six production deploys for a back-fill whose whole
point is to be picked up by the next scheduled rebuild. **No deploy was triggered.** All
six rows kept `_status=published`; re-running the script now reports
`written 0, skipped 6`, which is how the write was confirmed to have persisted.

### Where it renders

One shared component, `components/TextSourceNote.tsx`, at three call sites: the book page
(via `BookArticle.tsx`), the reader index, and the chapter page. It renders nothing at all
when it has nothing to say, so it cannot leave an empty box on a book without a source.

It is an `<aside aria-label="টেক্সট ও স্বত্ব">` with a styled `<p>` label rather than a
heading. That was deliberate and it is worth recording why: three different templates
mount this component, each with its own heading outline, so no fixed heading level could
satisfy all three without introducing exactly the heading-level jump this report claims
zero of. The link carries `target="_blank" rel="noopener noreferrer"` and **deliberately
not** `nofollow` — a citation is meant to pass credit, which is the entire point of it.

`includeLicence` is true on the two reader templates and false on the book page. The book
page header already names the licence beside the download control that triggers the
obligation; the reader is the one place a Tier B book is served with no such header
nearby, and most CC licences require naming the licence wherever the work appears.

### The six source URLs, and how they were chosen

Not hand-picked. Each was derived mechanically from the `pdfExternalUrl` already in the
data — `/wikisource/bn/x/xx/FILE` → `bn.wikisource.org/wiki/File:FILE`,
`/wikipedia/commons/x/xx/FILE` → `commons.wikimedia.org/wiki/File:FILE` — so the citation
cannot drift from the file the site actually serves. Each one is the scan's own file
description page, and **all six were confirmed to return HTTP 200** before being written
anywhere. I first tried the Wikisource *work* pages instead; two of six 404'd
(`শ্রীকান্ত`, `ঘরে-বাইরে`), so that approach was dropped rather than shipped with two
dead links. Three books cite `বাংলা উইকিসংকলন`, three cite `উইকিমিডিয়া কমন্স`.

### Verified

`generate:types` regenerated `payload-types.ts`. `tsc --noEmit` exit 0. `eslint .` 0
errors, 14 warnings — identical to the pre-existing baseline. `npm test` 94/94 in 5
files. `npm run test:e2e` 19 passed, 2 skipped — the baseline exactly. `npm run build`
exit 0 with exactly the four permitted `ƒ` routes. Against the fresh build, all 30
sitemap URLs re-audited: **0 pages with anything but one `<h1>`, 0 heading-level jumps, 0
JSON-LD parse failures**, and the citation present on 12 pages — the six books, the two
reader indexes and the four chapters, and nothing else. Spot-checked text on three
templates: `লেখকের মৃত্যু ১৯৩৮ সালে। ... তাই বইটি ১৯৯৯ সাল থেকে পাবলিক ডোমেইনে।` for Sarat
Chandra, `১৮৯৪ → ১৯৫৫` for Bankim, `১৯৪১ → ২০০২` for Tagore. The arithmetic is
`lib/rights.ts`, not prose.

### The three promises in seeded copy, re-checked

The blog post was not the only place the site made this claim, so all three were checked
against the built pages rather than just the one I had flagged.

- `content-seed/seed.mts:444` — `প্রতিটি বইয়ের পাতায় লেখা থাকে সেটি কেন পাবলিক ডোমেইন`.
  This is the one that was broken. `publicDomainNote` keeps it. **Now stands as written.**
- `content-seed/seed.mts:411` — every book page carries a Wikisource PDF link and a
  chapter-by-chapter reader. Already true; it is now also attributed, which is what the
  sentence implies by naming উইকিসংকলন.
- `content-seed/seed.mts:503`, the about page — `প্রতিটি বইয়ের পাতায় স্পষ্ট লেখা থাকে
  সেটির স্বত্বের অবস্থা এবং কেন সেটি বিনামূল্যে দেওয়া আইনসিদ্ধ`. The first half was
  already kept by the rights-tier chip at `BookArticle.tsx:130`, which renders on all
  four tiers. The second half is now kept on each of the three free tiers by its own
  mechanism: `publicDomainNote` for public-domain, the licence line for open-licence,
  `permissionNote` for permitted. It does not need to hold for in-copyright, where
  nothing is given away.

No seeded copy was edited. The code caught up with the copy instead, which was the point.

---

## 12. Still recommended, not implemented

**Nothing forces the new citation fields to be filled in.** `textSourceName` is optional,
and `TextSourceNote` renders nothing when it is empty, so a book added tomorrow through
the admin will simply have no citation and no warning. I left it optional on purpose —
making it required would have blocked publishing any book whose text you host yourself,
and it would have failed on the existing rows before the back-fill ran. If you want it
enforced, the right shape is the publish gate the Rights tab already uses: refuse to
publish a distributable book with a `rightsBasis` but no `textSourceName`, the same way
`collections/Books.ts` already refuses a distributable book with no `rightsBasis` at all.
That is a behaviour change to your publishing flow, so it is your call, not mine.

**Three genitive strings in non-visible copy.** `components/RatingStars.tsx:35`,
`components/ReviewSection.tsx:74` and `lib/payload/submitReview.ts:117` read
`৫ এর মধ্যে` where `৫-এর` is correct Bengali. These are aria-labels and an error
string, so they do not affect ranking, but they are wrong in the same way
`bengaliGenitive()` was built to fix.

**Em-dashes in seeded Bengali prose.** 104 remain in `content-seed/seed.mts`, in
literary body copy and meta descriptions. AGENTS.md bans em-dashes in public-facing
strings, so these are technically in scope, but rewriting literary prose at that scale
is editorial work rather than a mechanical fix, and em-dashes in body copy have no
ranking effect. Editor-facing `admin.description` strings in `collections/*` also
contain them; AGENTS.md scopes the rule to public-facing strings, so those are out of
scope by the rule as written. Flagging both rather than silently skipping them.

**Two things carried over from earlier work and still open**, unrelated to this
request: the R2 evidence sweep, and the SECURITY.md "settings that are not code"
checklist.

---

## Re-running any of this

```bash
npm run build && npm run start
```

Then, against `http://127.0.0.1:3000`: fetch `/sitemap.xml`, walk every `<loc>`, and
assert on titles, canonicals, `og:*`, heading order and JSON-LD. Contrast needs a real
browser, because the colours come from Tailwind classes resolving `:root` custom
properties; note that `X-Frame-Options: DENY` makes iframe auditing impossible, so the
working approach is `fetch` → `DOMParser` → `document.importNode` into a hidden 1440px
host element.

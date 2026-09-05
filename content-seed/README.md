# content-seed

Markdown source for chapters created in bulk by `scripts/seed-drafts.ts`:

```bash
npx payload run ./scripts/seed-drafts.ts
```

One file per chapter page. Everything in here becomes a **draft**, never a
published document, so seeding cannot put a half-finished page on the live site
and cannot spend a Vercel build (see the comment at the top of the script).

## Why the files hold only the questions

The title, subtitle, download note, FAQ entries, intro paragraph and closing
paragraph are **not** written here. They come from the wording templates in
`lib/generator/templates.ts`, which is the same code the admin's Chapter
generator uses. A page seeded from this directory and a page generated in the
admin therefore read identically, and fixing a turn of phrase means editing one
function rather than thirty-six files.

So each file contains the frontmatter the template needs, then the questions and
answers as Markdown.

## Frontmatter

Always required:

| key            | value                                                              |
| -------------- | ------------------------------------------------------------------ |
| `subject`      | Subject **slug**, e.g. `chemistry`. Must already exist in the CMS.  |
| `chapterSlug`  | URL segment. Lowercase letters, numbers, hyphens. Permanent.        |
| `questionType` | `srijonshil` or `anudhaban` (`ALLOWED_QUESTION_TYPES`).             |
| `contentKind`  | `literature` or `academic`.                                        |

`contentKind: literature` also needs `workName`, `writerName`, `workType`
(`গদ্য`/`পদ্য`) and `genre` (`গল্প`/`কবিতা`/`প্রবন্ধ`/`উপন্যাস`). It exists because a
Bangla chapter is a named work by a named writer and needs a genre-dependent
possessive, while a physics chapter is just an অধ্যায় and has no writer at all.

`contentKind: academic` needs `chapterName` instead.

One chapter topic normally produces **two** files, because `questionType` is a
single-value field: a chapter document is either সৃজনশীল or অনুধাবন, and the
roadmap wants each as its own page.

## Markdown that survives to the page

`lib/payload/editor.ts` (what the editor may produce) and
`sanitizeContentHtml()` in `lib/render.ts` (what survives) are a matched pair,
and anything outside them is dropped **silently**. In practice, in this
directory:

- `##` and `###` are the table of contents. `####` is a sub-heading that stays
  out of it. Never `#`: the page title is already the only `<h1>`.
- `**bold**`, `*italic*`, `> blockquote`, `- ` and `1. ` lists, `---` all work.
- **No Markdown tables.** The Lexical table feature has no Markdown
  transformer, so a pipe table arrives as literal pipe characters.
- **No `<sub>`/`<sup>` markup** either, for the same reason. Write formulas with
  real Unicode characters instead: `H₂SO₄`, `CO₂`, `Na⁺`, `10⁻⁹ m`, `x²`, `√`,
  `θ`, `π`, `°`, `Δ`, `λ`, `Ω`. These need no tags and copy/paste correctly.
- Leave a blank line between paragraphs. Two adjacent lines become one
  paragraph, not two.

## Two content rules that are not stylistic

- **Nothing may be copied**, from a textbook, a guide book, or the literary work
  itself. Every উদ্দীপক and every answer is written from scratch. This is the
  premise the site's own FAQ states to readers, and it is what an AdSense review
  is looking for.
- **No em-dashes** anywhere a reader can see them (`AGENTS.md`).

## Re-running

A `chapterSlug` that already exists in that subject is skipped rather than
duplicated, so an interrupted run can just be run again. `DRY_RUN=1` reports
what would be created, including the converted node count, and writes nothing.

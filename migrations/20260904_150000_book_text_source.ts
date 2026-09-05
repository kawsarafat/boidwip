import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** The public half of a book's provenance: `text_source_name` and
 *  `text_source_url`, the citation a reader sees under a public-domain text.
 *
 *  WHY THESE COLUMNS EXIST WHEN `rights_basis` ALREADY HOLDS THE PROVENANCE
 *
 *  `rights_basis` is read-restricted to logged-in users, and has to stay that
 *  way: it mixes where the text came from with our own legal reasoning about
 *  someone else's work. That made the provenance unpublishable, and left two
 *  things broken. Google's spam policy on Scraping names republishing "without
 *  adding any original content or value, or even citing the original source",
 *  and a published blog post promises readers that every book page states why
 *  the book is public domain. Both wanted a citation the page could render.
 *  These two columns are it, and they carry no field-level read rule.
 *
 *  WHY THE `_books_v` TWIN IS NOT OPTIONAL
 *
 *  Books are a drafts collection, so every field exists twice: once on `books`
 *  and once, `version_`-prefixed, on `_books_v`. Adding a column to one and not
 *  the other does not degrade gracefully; it makes every version read fail on
 *  the missing column, which reads in the admin as the document being broken
 *  rather than as a migration being half-written. Same lesson as
 *  20260901_161500, same shape of fix.
 *
 *  Additive and reversible: two nullable varchars per table, no backfill, no
 *  index (nothing filters or sorts on a citation), no constraint. `down()`
 *  drops exactly what `up()` added. Every statement is guarded so the file
 *  survives being run twice, or run against a database where an earlier attempt
 *  landed half of it.
 *
 *  Paired with 20260904_150000_book_text_source.json, the Drizzle snapshot
 *  `payload migrate:create` diffs against. Regenerating on a dev database
 *  should produce an EMPTY diff; statements mean the snapshot and this file
 *  have drifted, and the snapshot is the half to fix. */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "text_source_name" varchar;
  ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "text_source_url" varchar;
  ALTER TABLE "_books_v" ADD COLUMN IF NOT EXISTS "version_text_source_name" varchar;
  ALTER TABLE "_books_v" ADD COLUMN IF NOT EXISTS "version_text_source_url" varchar;`)
}

/** Reverses `up()`. Dropping these discards the citations an editor typed, and
 *  nothing else: the provenance itself is still in `rights_basis`, which this
 *  migration never touched. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "_books_v" DROP COLUMN IF EXISTS "version_text_source_url";
  ALTER TABLE "_books_v" DROP COLUMN IF EXISTS "version_text_source_name";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "text_source_url";
  ALTER TABLE "books" DROP COLUMN IF EXISTS "text_source_name";`)
}

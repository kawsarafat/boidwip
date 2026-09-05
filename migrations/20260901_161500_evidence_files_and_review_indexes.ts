import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Private evidence storage, and the two compound indexes the abuse checks
 *  depend on. Both halves come out of the audit; both are additive.
 *
 *  WHAT THIS BRINGS INTO THE SCHEMA
 *
 *   1. `evidence_files` — the new upload collection (collections/EvidenceFiles.ts)
 *      that holds permission letters on its own private R2 bucket, served
 *      through Payload so its `read` rule is on the path the bytes travel.
 *      Base upload columns only: NO `focal_x`/`focal_y` and no `sizes_*`,
 *      because the collection declines `focalPoint` and declares no
 *      `imageSizes`, and Payload only emits those columns when asked.
 *
 *   2. `document_id` on `books_rights_evidence` AND on
 *      `_books_v_version_rights_evidence` — the book's "Permission evidence"
 *      block now points at that collection instead of `media`. The `_books_v_…`
 *      twin is not optional: drafts and versions keep their own copy of every
 *      field, so a column added to one and not the other makes every version
 *      read fail on the missing column rather than on anything a person did.
 *
 *   3. `evidence_files_id` on `payload_locked_documents_rels` — the admin's
 *      document-locking join table carries one column per collection, so a new
 *      collection needs one or the admin panel cannot record a lock on it.
 *
 *   4. `book_status_idx` and `ipHash_createdAt_idx` on `reviews`, matching the
 *      `indexes` block in collections/Reviews.ts. The names look inconsistent
 *      and are not: Payload builds a compound index's NAME from the camelCase
 *      field paths joined with `_`, while the COLUMNS are the snake-cased
 *      column names — hence `ipHash_createdAt_idx ON ("ip_hash","created_at")`.
 *      They are quoted here for exactly that reason.
 *
 *  WHY `file_id` IS STILL THERE
 *
 *  The old `file` upload sub-field pointed at `media`, which is public. It is
 *  gone from the config, so the schema no longer describes `file_id` — and this
 *  migration still does not drop it. That column is the only remaining record
 *  of WHICH object in the public bucket each book's evidence was uploaded to,
 *  and finding and deleting those objects is the R2 audit step in SECURITY.md.
 *  Dropping the column would delete the map before the cleanup that needs it.
 *  It is deliberately untracked ballast from here on; a follow-up migration can
 *  drop `file_id`, its index and its foreign key once that audit is signed off.
 *
 *  WHY EVERY STATEMENT IS GUARDED
 *
 *  This file is hand-written rather than generated, so it has to survive being
 *  run twice and being run against a database where an earlier attempt landed
 *  half of it. Hence `IF NOT EXISTS` everywhere, and `DO $$ … EXCEPTION WHEN
 *  duplicate_object` for the foreign keys, which have no `IF NOT EXISTS` form.
 *  Guarding those by EXCEPTION rather than by a name lookup also side-steps a
 *  detail that would otherwise bite: `_books_v_version_rights_evidence_document
 *  _id_evidence_files_id_fk` is 65 bytes, past Postgres's 63-byte identifier
 *  limit, so the constraint is stored under a truncated name. The name is
 *  written out in full anyway, because that is what Drizzle generates for this
 *  table and column pair, and both sides truncate identically.
 *
 *  Paired with 20260901_161500_evidence_files_and_review_indexes.json, the
 *  Drizzle snapshot `payload migrate:create` diffs against. Regenerating on a
 *  dev database should therefore produce an EMPTY diff; if it produces
 *  statements, the snapshot and this file have drifted and the snapshot is the
 *  half to fix. */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "evidence_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar,
  	"prefix" varchar DEFAULT 'evidence',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric
  );

  ALTER TABLE "books_rights_evidence" ADD COLUMN IF NOT EXISTS "document_id" integer;
  ALTER TABLE "_books_v_version_rights_evidence" ADD COLUMN IF NOT EXISTS "document_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "evidence_files_id" integer;

  DO $$ BEGIN
   ALTER TABLE "books_rights_evidence" ADD CONSTRAINT "books_rights_evidence_document_id_evidence_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."evidence_files"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
   ALTER TABLE "_books_v_version_rights_evidence" ADD CONSTRAINT "_books_v_version_rights_evidence_document_id_evidence_files_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."evidence_files"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_evidence_files_fk" FOREIGN KEY ("evidence_files_id") REFERENCES "public"."evidence_files"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;

  CREATE INDEX IF NOT EXISTS "evidence_files_updated_at_idx" ON "evidence_files" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "evidence_files_created_at_idx" ON "evidence_files" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "evidence_files_filename_idx" ON "evidence_files" USING btree ("filename");
  CREATE INDEX IF NOT EXISTS "books_rights_evidence_document_idx" ON "books_rights_evidence" USING btree ("document_id");
  CREATE INDEX IF NOT EXISTS "_books_v_version_rights_evidence_document_idx" ON "_books_v_version_rights_evidence" USING btree ("document_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_evidence_files_id_idx" ON "payload_locked_documents_rels" USING btree ("evidence_files_id");
  CREATE INDEX IF NOT EXISTS "book_status_idx" ON "reviews" USING btree ("book_id","status");
  CREATE INDEX IF NOT EXISTS "ipHash_createdAt_idx" ON "reviews" USING btree ("ip_hash","created_at");`)
}

/** Reverses `up()` and nothing else — the `file_id` columns it deliberately
 *  left alone are still there, so there is no data to restore.
 *
 *  It is a development convenience rather than a production undo, for one
 *  reason worth stating: dropping `evidence_files` discards the rows, and those
 *  rows are the only mapping from a stored filename in the private bucket back
 *  to the book whose permission it documents. The objects survive in R2 as
 *  files nobody can identify. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "ipHash_createdAt_idx";
  DROP INDEX IF EXISTS "book_status_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_evidence_files_id_idx";
  DROP INDEX IF EXISTS "_books_v_version_rights_evidence_document_idx";
  DROP INDEX IF EXISTS "books_rights_evidence_document_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "evidence_files_id";
  ALTER TABLE "_books_v_version_rights_evidence" DROP COLUMN IF EXISTS "document_id";
  ALTER TABLE "books_rights_evidence" DROP COLUMN IF EXISTS "document_id";
  DROP TABLE IF EXISTS "evidence_files" CASCADE;`)
}

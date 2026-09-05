import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_books_adaptations_kind" AS ENUM('film', 'tv', 'web-series', 'theatre');
  CREATE TYPE "public"."enum_books_stock_status" AS ENUM('in-stock', 'out-of-stock', 'preorder');
  CREATE TYPE "public"."enum_books_rights_tier" AS ENUM('public-domain', 'open-licence', 'permitted', 'in-copyright');
  CREATE TYPE "public"."enum_books_takedown_status" AS ENUM('none', 'notice-received', 'removed');
  CREATE TYPE "public"."enum_books_bibliographic_language" AS ENUM('bn', 'en', 'ar', 'hi', 'other');
  CREATE TYPE "public"."enum_books_bibliographic_binding" AS ENUM('hardcover', 'paperback');
  CREATE TYPE "public"."enum_books_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__books_v_version_adaptations_kind" AS ENUM('film', 'tv', 'web-series', 'theatre');
  CREATE TYPE "public"."enum__books_v_version_stock_status" AS ENUM('in-stock', 'out-of-stock', 'preorder');
  CREATE TYPE "public"."enum__books_v_version_rights_tier" AS ENUM('public-domain', 'open-licence', 'permitted', 'in-copyright');
  CREATE TYPE "public"."enum__books_v_version_takedown_status" AS ENUM('none', 'notice-received', 'removed');
  CREATE TYPE "public"."enum__books_v_version_bibliographic_language" AS ENUM('bn', 'en', 'ar', 'hi', 'other');
  CREATE TYPE "public"."enum__books_v_version_bibliographic_binding" AS ENUM('hardcover', 'paperback');
  CREATE TYPE "public"."enum__books_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_book_chapters_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__book_chapters_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_publishers_permission_status" AS ENUM('none', 'contacted', 'granted', 'refused');
  CREATE TYPE "public"."enum_lists_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__lists_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_blog_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__blog_posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_reviews_status" AS ENUM('pending', 'approved', 'spam');
  CREATE TABLE "books_table_of_contents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"page" numeric
  );
  
  CREATE TABLE "books_quotes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "books_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "books_awards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"year" numeric
  );
  
  CREATE TABLE "books_adaptations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"kind" "enum_books_adaptations_kind",
  	"year" numeric
  );
  
  CREATE TABLE "books_other_stores" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"url" varchar,
  	"price" numeric
  );
  
  CREATE TABLE "books_rights_evidence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"contact" varchar,
  	"scope" varchar,
  	"email_text" varchar,
  	"file_id" integer
  );
  
  CREATE TABLE "books" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"title_latin" varchar,
  	"subtitle" varchar,
  	"original_title" varchar,
  	"synopsis" jsonb,
  	"review" jsonb,
  	"who_should_read" varchar,
  	"cover_id" integer,
  	"pdf_id" integer,
  	"pdf_external_url" varchar,
  	"pdf_pages" numeric,
  	"pdf_size_bytes" numeric,
  	"epub_id" integer,
  	"rokomari_url" varchar,
  	"price_bdt" numeric,
  	"mrp_bdt" numeric,
  	"price_checked_at" timestamp(3) with time zone,
  	"stock_status" "enum_books_stock_status",
  	"slug" varchar,
  	"rights_tier" "enum_books_rights_tier",
  	"rights_basis" varchar,
  	"licence_name" varchar,
  	"licence_url" varchar,
  	"rights_reviewed_by_id" integer,
  	"takedown_status" "enum_books_takedown_status" DEFAULT 'none',
  	"translator_id" integer,
  	"publisher_id" integer,
  	"primary_category_id" integer,
  	"series_id" integer,
  	"series_number" numeric,
  	"bibliographic_isbn13" varchar,
  	"bibliographic_first_published" numeric,
  	"bibliographic_edition_year" numeric,
  	"bibliographic_pages" numeric,
  	"bibliographic_language" "enum_books_bibliographic_language" DEFAULT 'bn',
  	"bibliographic_binding" "enum_books_bibliographic_binding",
  	"bibliographic_weight_grams" numeric,
  	"publish_date" timestamp(3) with time zone,
  	"popular" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"download_count" numeric DEFAULT 0,
  	"rating_average" numeric,
  	"rating_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_books_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "books_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"authors_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "_books_v_version_table_of_contents" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"page" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_books_v_version_quotes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_books_v_version_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_books_v_version_awards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"year" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_books_v_version_adaptations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"kind" "enum__books_v_version_adaptations_kind",
  	"year" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_books_v_version_other_stores" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"url" varchar,
  	"price" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_books_v_version_rights_evidence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"contact" varchar,
  	"scope" varchar,
  	"email_text" varchar,
  	"file_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_books_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_title_latin" varchar,
  	"version_subtitle" varchar,
  	"version_original_title" varchar,
  	"version_synopsis" jsonb,
  	"version_review" jsonb,
  	"version_who_should_read" varchar,
  	"version_cover_id" integer,
  	"version_pdf_id" integer,
  	"version_pdf_external_url" varchar,
  	"version_pdf_pages" numeric,
  	"version_pdf_size_bytes" numeric,
  	"version_epub_id" integer,
  	"version_rokomari_url" varchar,
  	"version_price_bdt" numeric,
  	"version_mrp_bdt" numeric,
  	"version_price_checked_at" timestamp(3) with time zone,
  	"version_stock_status" "enum__books_v_version_stock_status",
  	"version_slug" varchar,
  	"version_rights_tier" "enum__books_v_version_rights_tier",
  	"version_rights_basis" varchar,
  	"version_licence_name" varchar,
  	"version_licence_url" varchar,
  	"version_rights_reviewed_by_id" integer,
  	"version_takedown_status" "enum__books_v_version_takedown_status" DEFAULT 'none',
  	"version_translator_id" integer,
  	"version_publisher_id" integer,
  	"version_primary_category_id" integer,
  	"version_series_id" integer,
  	"version_series_number" numeric,
  	"version_bibliographic_isbn13" varchar,
  	"version_bibliographic_first_published" numeric,
  	"version_bibliographic_edition_year" numeric,
  	"version_bibliographic_pages" numeric,
  	"version_bibliographic_language" "enum__books_v_version_bibliographic_language" DEFAULT 'bn',
  	"version_bibliographic_binding" "enum__books_v_version_bibliographic_binding",
  	"version_bibliographic_weight_grams" numeric,
  	"version_publish_date" timestamp(3) with time zone,
  	"version_popular" boolean DEFAULT false,
  	"version_featured" boolean DEFAULT false,
  	"version_download_count" numeric DEFAULT 0,
  	"version_rating_average" numeric,
  	"version_rating_count" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__books_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_books_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"authors_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "book_chapters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" jsonb,
  	"book_id" integer,
  	"chapter_number" numeric,
  	"slug" varchar,
  	"word_count" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_book_chapters_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_book_chapters_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_body" jsonb,
  	"version_book_id" integer,
  	"version_chapter_number" numeric,
  	"version_slug" varchar,
  	"version_word_count" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__book_chapters_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "authors_name_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"alias" varchar NOT NULL
  );
  
  CREATE TABLE "authors_external_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "authors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"name_latin" varchar,
  	"bio" jsonb,
  	"photo_id" integer,
  	"slug" varchar NOT NULL,
  	"birth_year" numeric,
  	"death_year" numeric,
  	"birth_place" varchar,
  	"nationality" varchar,
  	"book_count" numeric DEFAULT 0,
  	"featured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "authors_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"books_id" integer
  );
  
  CREATE TABLE "publishers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"name_latin" varchar,
  	"about" jsonb,
  	"logo_id" integer,
  	"slug" varchar NOT NULL,
  	"established_year" numeric,
  	"address" varchar,
  	"website" varchar,
  	"contact_email" varchar,
  	"rokomari_publisher_url" varchar,
  	"permission_status" "enum_publishers_permission_status" DEFAULT 'none',
  	"book_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"name_latin" varchar,
  	"description" jsonb,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"icon_id" integer,
  	"order" numeric DEFAULT 0,
  	"featured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "series" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"name_latin" varchar,
  	"description" jsonb,
  	"slug" varchar NOT NULL,
  	"author_id" integer,
  	"cover_image_id" integer,
  	"book_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lists_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"book_id" integer,
  	"note" jsonb
  );
  
  CREATE TABLE "lists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" jsonb,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"publish_date" timestamp(3) with time zone,
  	"featured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_lists_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_lists_v_version_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"book_id" integer,
  	"note" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_lists_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_intro" jsonb,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_publish_date" timestamp(3) with time zone,
  	"version_featured" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__lists_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "blog_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"publish_date" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_blog_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "blog_posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"books_id" integer
  );
  
  CREATE TABLE "_blog_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_publish_date" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__blog_posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_blog_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"books_id" integer
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"body" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_body" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_reviews_status" DEFAULT 'pending' NOT NULL,
  	"book_id" integer NOT NULL,
  	"rating" numeric NOT NULL,
  	"author_name" varchar NOT NULL,
  	"author_email" varchar,
  	"body" varchar NOT NULL,
  	"ip_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"credit" varchar,
  	"prefix" varchar DEFAULT 'media',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar,
  	"sizes_og_url" varchar,
  	"sizes_og_width" numeric,
  	"sizes_og_height" numeric,
  	"sizes_og_mime_type" varchar,
  	"sizes_og_filesize" numeric,
  	"sizes_og_filename" varchar
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"books_id" integer,
  	"book_chapters_id" integer,
  	"authors_id" integer,
  	"publishers_id" integer,
  	"categories_id" integer,
  	"series_id" integer,
  	"lists_id" integer,
  	"blog_posts_id" integer,
  	"pages_id" integer,
  	"reviews_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar DEFAULT 'বইদ্বীপ' NOT NULL,
  	"tagline" varchar DEFAULT 'বাংলা বইয়ের দ্বীপে স্বাগতম',
  	"site_description" varchar,
  	"default_og_image_id" integer,
  	"hero_book_id" integer,
  	"contact_email" varchar,
  	"footer_note" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"lists_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "affiliate_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"affiliate_enabled" boolean DEFAULT true,
  	"buy_button_label" varchar DEFAULT 'হার্ডকপি কিনুন' NOT NULL,
  	"download_button_label" varchar DEFAULT 'ফ্রি পিডিএফ ডাউনলোড' NOT NULL,
  	"disclosure_text" varchar DEFAULT 'বইদ্বীপ রকমারি অ্যাফিলিয়েট প্রোগ্রামের সদস্য। এই লিংক থেকে বই কিনলে আপনার কোনো বাড়তি খরচ ছাড়াই আমরা সামান্য কমিশন পাই, যা সাইটটি চালাতে সাহায্য করে।' NOT NULL,
  	"post_download_heading" varchar DEFAULT 'বইটি ভালো লাগলে হার্ডকপি সংগ্রহ করুন',
  	"post_download_body" varchar DEFAULT 'ছাপা বইয়ের আনন্দই আলাদা — আর আপনার কেনা প্রতিটি বই লেখক ও প্রকাশককে নতুন বই আনতে উৎসাহ দেয়।',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "books_table_of_contents" ADD CONSTRAINT "books_table_of_contents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_quotes" ADD CONSTRAINT "books_quotes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_faq_items" ADD CONSTRAINT "books_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_awards" ADD CONSTRAINT "books_awards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_adaptations" ADD CONSTRAINT "books_adaptations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_other_stores" ADD CONSTRAINT "books_other_stores_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_rights_evidence" ADD CONSTRAINT "books_rights_evidence_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books_rights_evidence" ADD CONSTRAINT "books_rights_evidence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_pdf_id_media_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_epub_id_media_id_fk" FOREIGN KEY ("epub_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_rights_reviewed_by_id_users_id_fk" FOREIGN KEY ("rights_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_translator_id_authors_id_fk" FOREIGN KEY ("translator_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books_rels" ADD CONSTRAINT "books_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_rels" ADD CONSTRAINT "books_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_rels" ADD CONSTRAINT "books_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_version_table_of_contents" ADD CONSTRAINT "_books_v_version_table_of_contents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_version_quotes" ADD CONSTRAINT "_books_v_version_quotes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_version_faq_items" ADD CONSTRAINT "_books_v_version_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_version_awards" ADD CONSTRAINT "_books_v_version_awards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_version_adaptations" ADD CONSTRAINT "_books_v_version_adaptations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_version_other_stores" ADD CONSTRAINT "_books_v_version_other_stores_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_version_rights_evidence" ADD CONSTRAINT "_books_v_version_rights_evidence_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v_version_rights_evidence" ADD CONSTRAINT "_books_v_version_rights_evidence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_parent_id_books_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_pdf_id_media_id_fk" FOREIGN KEY ("version_pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_epub_id_media_id_fk" FOREIGN KEY ("version_epub_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_rights_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_rights_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_translator_id_authors_id_fk" FOREIGN KEY ("version_translator_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_publisher_id_publishers_id_fk" FOREIGN KEY ("version_publisher_id") REFERENCES "public"."publishers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_primary_category_id_categories_id_fk" FOREIGN KEY ("version_primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v" ADD CONSTRAINT "_books_v_version_series_id_series_id_fk" FOREIGN KEY ("version_series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_books_v_rels" ADD CONSTRAINT "_books_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_books_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_rels" ADD CONSTRAINT "_books_v_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_books_v_rels" ADD CONSTRAINT "_books_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_book_chapters_v" ADD CONSTRAINT "_book_chapters_v_parent_id_book_chapters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."book_chapters"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_book_chapters_v" ADD CONSTRAINT "_book_chapters_v_version_book_id_books_id_fk" FOREIGN KEY ("version_book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "authors_name_aliases" ADD CONSTRAINT "authors_name_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "authors_external_links" ADD CONSTRAINT "authors_external_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "authors" ADD CONSTRAINT "authors_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "authors_rels" ADD CONSTRAINT "authors_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "authors_rels" ADD CONSTRAINT "authors_rels_books_fk" FOREIGN KEY ("books_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publishers" ADD CONSTRAINT "publishers_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series" ADD CONSTRAINT "series_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series" ADD CONSTRAINT "series_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lists_entries" ADD CONSTRAINT "lists_entries_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lists_entries" ADD CONSTRAINT "lists_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lists" ADD CONSTRAINT "lists_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lists_v_version_entries" ADD CONSTRAINT "_lists_v_version_entries_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lists_v_version_entries" ADD CONSTRAINT "_lists_v_version_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_lists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_lists_v" ADD CONSTRAINT "_lists_v_parent_id_lists_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lists_v" ADD CONSTRAINT "_lists_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts_rels" ADD CONSTRAINT "blog_posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_posts_rels" ADD CONSTRAINT "blog_posts_rels_books_fk" FOREIGN KEY ("books_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_parent_id_blog_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v_rels" ADD CONSTRAINT "_blog_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_blog_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_blog_posts_v_rels" ADD CONSTRAINT "_blog_posts_v_rels_books_fk" FOREIGN KEY ("books_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_books_fk" FOREIGN KEY ("books_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_book_chapters_fk" FOREIGN KEY ("book_chapters_id") REFERENCES "public"."book_chapters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_publishers_fk" FOREIGN KEY ("publishers_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_series_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lists_fk" FOREIGN KEY ("lists_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_posts_fk" FOREIGN KEY ("blog_posts_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_default_og_image_id_media_id_fk" FOREIGN KEY ("default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_hero_book_id_books_id_fk" FOREIGN KEY ("hero_book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_lists_fk" FOREIGN KEY ("lists_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "books_table_of_contents_order_idx" ON "books_table_of_contents" USING btree ("_order");
  CREATE INDEX "books_table_of_contents_parent_id_idx" ON "books_table_of_contents" USING btree ("_parent_id");
  CREATE INDEX "books_quotes_order_idx" ON "books_quotes" USING btree ("_order");
  CREATE INDEX "books_quotes_parent_id_idx" ON "books_quotes" USING btree ("_parent_id");
  CREATE INDEX "books_faq_items_order_idx" ON "books_faq_items" USING btree ("_order");
  CREATE INDEX "books_faq_items_parent_id_idx" ON "books_faq_items" USING btree ("_parent_id");
  CREATE INDEX "books_awards_order_idx" ON "books_awards" USING btree ("_order");
  CREATE INDEX "books_awards_parent_id_idx" ON "books_awards" USING btree ("_parent_id");
  CREATE INDEX "books_adaptations_order_idx" ON "books_adaptations" USING btree ("_order");
  CREATE INDEX "books_adaptations_parent_id_idx" ON "books_adaptations" USING btree ("_parent_id");
  CREATE INDEX "books_other_stores_order_idx" ON "books_other_stores" USING btree ("_order");
  CREATE INDEX "books_other_stores_parent_id_idx" ON "books_other_stores" USING btree ("_parent_id");
  CREATE INDEX "books_rights_evidence_order_idx" ON "books_rights_evidence" USING btree ("_order");
  CREATE INDEX "books_rights_evidence_parent_id_idx" ON "books_rights_evidence" USING btree ("_parent_id");
  CREATE INDEX "books_rights_evidence_file_idx" ON "books_rights_evidence" USING btree ("file_id");
  CREATE INDEX "books_cover_idx" ON "books" USING btree ("cover_id");
  CREATE INDEX "books_pdf_idx" ON "books" USING btree ("pdf_id");
  CREATE INDEX "books_epub_idx" ON "books" USING btree ("epub_id");
  CREATE UNIQUE INDEX "books_slug_idx" ON "books" USING btree ("slug");
  CREATE INDEX "books_rights_tier_idx" ON "books" USING btree ("rights_tier");
  CREATE INDEX "books_rights_reviewed_by_idx" ON "books" USING btree ("rights_reviewed_by_id");
  CREATE INDEX "books_translator_idx" ON "books" USING btree ("translator_id");
  CREATE INDEX "books_publisher_idx" ON "books" USING btree ("publisher_id");
  CREATE INDEX "books_primary_category_idx" ON "books" USING btree ("primary_category_id");
  CREATE INDEX "books_series_idx" ON "books" USING btree ("series_id");
  CREATE INDEX "books_updated_at_idx" ON "books" USING btree ("updated_at");
  CREATE INDEX "books_created_at_idx" ON "books" USING btree ("created_at");
  CREATE INDEX "books__status_idx" ON "books" USING btree ("_status");
  CREATE INDEX "rightsTier__status_idx" ON "books" USING btree ("rights_tier","_status");
  CREATE INDEX "publisher_publishDate_idx" ON "books" USING btree ("publisher_id","publish_date");
  CREATE INDEX "books_rels_order_idx" ON "books_rels" USING btree ("order");
  CREATE INDEX "books_rels_parent_idx" ON "books_rels" USING btree ("parent_id");
  CREATE INDEX "books_rels_path_idx" ON "books_rels" USING btree ("path");
  CREATE INDEX "books_rels_authors_id_idx" ON "books_rels" USING btree ("authors_id");
  CREATE INDEX "books_rels_categories_id_idx" ON "books_rels" USING btree ("categories_id");
  CREATE INDEX "_books_v_version_table_of_contents_order_idx" ON "_books_v_version_table_of_contents" USING btree ("_order");
  CREATE INDEX "_books_v_version_table_of_contents_parent_id_idx" ON "_books_v_version_table_of_contents" USING btree ("_parent_id");
  CREATE INDEX "_books_v_version_quotes_order_idx" ON "_books_v_version_quotes" USING btree ("_order");
  CREATE INDEX "_books_v_version_quotes_parent_id_idx" ON "_books_v_version_quotes" USING btree ("_parent_id");
  CREATE INDEX "_books_v_version_faq_items_order_idx" ON "_books_v_version_faq_items" USING btree ("_order");
  CREATE INDEX "_books_v_version_faq_items_parent_id_idx" ON "_books_v_version_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_books_v_version_awards_order_idx" ON "_books_v_version_awards" USING btree ("_order");
  CREATE INDEX "_books_v_version_awards_parent_id_idx" ON "_books_v_version_awards" USING btree ("_parent_id");
  CREATE INDEX "_books_v_version_adaptations_order_idx" ON "_books_v_version_adaptations" USING btree ("_order");
  CREATE INDEX "_books_v_version_adaptations_parent_id_idx" ON "_books_v_version_adaptations" USING btree ("_parent_id");
  CREATE INDEX "_books_v_version_other_stores_order_idx" ON "_books_v_version_other_stores" USING btree ("_order");
  CREATE INDEX "_books_v_version_other_stores_parent_id_idx" ON "_books_v_version_other_stores" USING btree ("_parent_id");
  CREATE INDEX "_books_v_version_rights_evidence_order_idx" ON "_books_v_version_rights_evidence" USING btree ("_order");
  CREATE INDEX "_books_v_version_rights_evidence_parent_id_idx" ON "_books_v_version_rights_evidence" USING btree ("_parent_id");
  CREATE INDEX "_books_v_version_rights_evidence_file_idx" ON "_books_v_version_rights_evidence" USING btree ("file_id");
  CREATE INDEX "_books_v_parent_idx" ON "_books_v" USING btree ("parent_id");
  CREATE INDEX "_books_v_version_version_cover_idx" ON "_books_v" USING btree ("version_cover_id");
  CREATE INDEX "_books_v_version_version_pdf_idx" ON "_books_v" USING btree ("version_pdf_id");
  CREATE INDEX "_books_v_version_version_epub_idx" ON "_books_v" USING btree ("version_epub_id");
  CREATE INDEX "_books_v_version_version_slug_idx" ON "_books_v" USING btree ("version_slug");
  CREATE INDEX "_books_v_version_version_rights_tier_idx" ON "_books_v" USING btree ("version_rights_tier");
  CREATE INDEX "_books_v_version_version_rights_reviewed_by_idx" ON "_books_v" USING btree ("version_rights_reviewed_by_id");
  CREATE INDEX "_books_v_version_version_translator_idx" ON "_books_v" USING btree ("version_translator_id");
  CREATE INDEX "_books_v_version_version_publisher_idx" ON "_books_v" USING btree ("version_publisher_id");
  CREATE INDEX "_books_v_version_version_primary_category_idx" ON "_books_v" USING btree ("version_primary_category_id");
  CREATE INDEX "_books_v_version_version_series_idx" ON "_books_v" USING btree ("version_series_id");
  CREATE INDEX "_books_v_version_version_updated_at_idx" ON "_books_v" USING btree ("version_updated_at");
  CREATE INDEX "_books_v_version_version_created_at_idx" ON "_books_v" USING btree ("version_created_at");
  CREATE INDEX "_books_v_version_version__status_idx" ON "_books_v" USING btree ("version__status");
  CREATE INDEX "_books_v_created_at_idx" ON "_books_v" USING btree ("created_at");
  CREATE INDEX "_books_v_updated_at_idx" ON "_books_v" USING btree ("updated_at");
  CREATE INDEX "_books_v_latest_idx" ON "_books_v" USING btree ("latest");
  CREATE INDEX "version_rightsTier_version__status_idx" ON "_books_v" USING btree ("version_rights_tier","version__status");
  CREATE INDEX "version_publisher_version_publishDate_idx" ON "_books_v" USING btree ("version_publisher_id","version_publish_date");
  CREATE INDEX "_books_v_rels_order_idx" ON "_books_v_rels" USING btree ("order");
  CREATE INDEX "_books_v_rels_parent_idx" ON "_books_v_rels" USING btree ("parent_id");
  CREATE INDEX "_books_v_rels_path_idx" ON "_books_v_rels" USING btree ("path");
  CREATE INDEX "_books_v_rels_authors_id_idx" ON "_books_v_rels" USING btree ("authors_id");
  CREATE INDEX "_books_v_rels_categories_id_idx" ON "_books_v_rels" USING btree ("categories_id");
  CREATE INDEX "book_chapters_book_idx" ON "book_chapters" USING btree ("book_id");
  CREATE INDEX "book_chapters_updated_at_idx" ON "book_chapters" USING btree ("updated_at");
  CREATE INDEX "book_chapters_created_at_idx" ON "book_chapters" USING btree ("created_at");
  CREATE INDEX "book_chapters__status_idx" ON "book_chapters" USING btree ("_status");
  CREATE UNIQUE INDEX "book_slug_idx" ON "book_chapters" USING btree ("book_id","slug");
  CREATE INDEX "_book_chapters_v_parent_idx" ON "_book_chapters_v" USING btree ("parent_id");
  CREATE INDEX "_book_chapters_v_version_version_book_idx" ON "_book_chapters_v" USING btree ("version_book_id");
  CREATE INDEX "_book_chapters_v_version_version_updated_at_idx" ON "_book_chapters_v" USING btree ("version_updated_at");
  CREATE INDEX "_book_chapters_v_version_version_created_at_idx" ON "_book_chapters_v" USING btree ("version_created_at");
  CREATE INDEX "_book_chapters_v_version_version__status_idx" ON "_book_chapters_v" USING btree ("version__status");
  CREATE INDEX "_book_chapters_v_created_at_idx" ON "_book_chapters_v" USING btree ("created_at");
  CREATE INDEX "_book_chapters_v_updated_at_idx" ON "_book_chapters_v" USING btree ("updated_at");
  CREATE INDEX "_book_chapters_v_latest_idx" ON "_book_chapters_v" USING btree ("latest");
  CREATE INDEX "version_book_version_slug_idx" ON "_book_chapters_v" USING btree ("version_book_id","version_slug");
  CREATE INDEX "authors_name_aliases_order_idx" ON "authors_name_aliases" USING btree ("_order");
  CREATE INDEX "authors_name_aliases_parent_id_idx" ON "authors_name_aliases" USING btree ("_parent_id");
  CREATE INDEX "authors_external_links_order_idx" ON "authors_external_links" USING btree ("_order");
  CREATE INDEX "authors_external_links_parent_id_idx" ON "authors_external_links" USING btree ("_parent_id");
  CREATE INDEX "authors_photo_idx" ON "authors" USING btree ("photo_id");
  CREATE UNIQUE INDEX "authors_slug_idx" ON "authors" USING btree ("slug");
  CREATE INDEX "authors_updated_at_idx" ON "authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "authors" USING btree ("created_at");
  CREATE INDEX "authors_rels_order_idx" ON "authors_rels" USING btree ("order");
  CREATE INDEX "authors_rels_parent_idx" ON "authors_rels" USING btree ("parent_id");
  CREATE INDEX "authors_rels_path_idx" ON "authors_rels" USING btree ("path");
  CREATE INDEX "authors_rels_books_id_idx" ON "authors_rels" USING btree ("books_id");
  CREATE INDEX "publishers_logo_idx" ON "publishers" USING btree ("logo_id");
  CREATE UNIQUE INDEX "publishers_slug_idx" ON "publishers" USING btree ("slug");
  CREATE INDEX "publishers_updated_at_idx" ON "publishers" USING btree ("updated_at");
  CREATE INDEX "publishers_created_at_idx" ON "publishers" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_icon_idx" ON "categories" USING btree ("icon_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "series_slug_idx" ON "series" USING btree ("slug");
  CREATE INDEX "series_author_idx" ON "series" USING btree ("author_id");
  CREATE INDEX "series_cover_image_idx" ON "series" USING btree ("cover_image_id");
  CREATE INDEX "series_updated_at_idx" ON "series" USING btree ("updated_at");
  CREATE INDEX "series_created_at_idx" ON "series" USING btree ("created_at");
  CREATE INDEX "lists_entries_order_idx" ON "lists_entries" USING btree ("_order");
  CREATE INDEX "lists_entries_parent_id_idx" ON "lists_entries" USING btree ("_parent_id");
  CREATE INDEX "lists_entries_book_idx" ON "lists_entries" USING btree ("book_id");
  CREATE UNIQUE INDEX "lists_slug_idx" ON "lists" USING btree ("slug");
  CREATE INDEX "lists_cover_image_idx" ON "lists" USING btree ("cover_image_id");
  CREATE INDEX "lists_updated_at_idx" ON "lists" USING btree ("updated_at");
  CREATE INDEX "lists_created_at_idx" ON "lists" USING btree ("created_at");
  CREATE INDEX "lists__status_idx" ON "lists" USING btree ("_status");
  CREATE INDEX "_lists_v_version_entries_order_idx" ON "_lists_v_version_entries" USING btree ("_order");
  CREATE INDEX "_lists_v_version_entries_parent_id_idx" ON "_lists_v_version_entries" USING btree ("_parent_id");
  CREATE INDEX "_lists_v_version_entries_book_idx" ON "_lists_v_version_entries" USING btree ("book_id");
  CREATE INDEX "_lists_v_parent_idx" ON "_lists_v" USING btree ("parent_id");
  CREATE INDEX "_lists_v_version_version_slug_idx" ON "_lists_v" USING btree ("version_slug");
  CREATE INDEX "_lists_v_version_version_cover_image_idx" ON "_lists_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_lists_v_version_version_updated_at_idx" ON "_lists_v" USING btree ("version_updated_at");
  CREATE INDEX "_lists_v_version_version_created_at_idx" ON "_lists_v" USING btree ("version_created_at");
  CREATE INDEX "_lists_v_version_version__status_idx" ON "_lists_v" USING btree ("version__status");
  CREATE INDEX "_lists_v_created_at_idx" ON "_lists_v" USING btree ("created_at");
  CREATE INDEX "_lists_v_updated_at_idx" ON "_lists_v" USING btree ("updated_at");
  CREATE INDEX "_lists_v_latest_idx" ON "_lists_v" USING btree ("latest");
  CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");
  CREATE INDEX "blog_posts_cover_image_idx" ON "blog_posts" USING btree ("cover_image_id");
  CREATE INDEX "blog_posts_updated_at_idx" ON "blog_posts" USING btree ("updated_at");
  CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("created_at");
  CREATE INDEX "blog_posts__status_idx" ON "blog_posts" USING btree ("_status");
  CREATE INDEX "blog_posts_rels_order_idx" ON "blog_posts_rels" USING btree ("order");
  CREATE INDEX "blog_posts_rels_parent_idx" ON "blog_posts_rels" USING btree ("parent_id");
  CREATE INDEX "blog_posts_rels_path_idx" ON "blog_posts_rels" USING btree ("path");
  CREATE INDEX "blog_posts_rels_books_id_idx" ON "blog_posts_rels" USING btree ("books_id");
  CREATE INDEX "_blog_posts_v_parent_idx" ON "_blog_posts_v" USING btree ("parent_id");
  CREATE INDEX "_blog_posts_v_version_version_slug_idx" ON "_blog_posts_v" USING btree ("version_slug");
  CREATE INDEX "_blog_posts_v_version_version_cover_image_idx" ON "_blog_posts_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_blog_posts_v_version_version_updated_at_idx" ON "_blog_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_blog_posts_v_version_version_created_at_idx" ON "_blog_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_blog_posts_v_version_version__status_idx" ON "_blog_posts_v" USING btree ("version__status");
  CREATE INDEX "_blog_posts_v_created_at_idx" ON "_blog_posts_v" USING btree ("created_at");
  CREATE INDEX "_blog_posts_v_updated_at_idx" ON "_blog_posts_v" USING btree ("updated_at");
  CREATE INDEX "_blog_posts_v_latest_idx" ON "_blog_posts_v" USING btree ("latest");
  CREATE INDEX "_blog_posts_v_rels_order_idx" ON "_blog_posts_v_rels" USING btree ("order");
  CREATE INDEX "_blog_posts_v_rels_parent_idx" ON "_blog_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_blog_posts_v_rels_path_idx" ON "_blog_posts_v_rels" USING btree ("path");
  CREATE INDEX "_blog_posts_v_rels_books_id_idx" ON "_blog_posts_v_rels" USING btree ("books_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");
  CREATE INDEX "reviews_book_idx" ON "reviews" USING btree ("book_id");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_books_id_idx" ON "payload_locked_documents_rels" USING btree ("books_id");
  CREATE INDEX "payload_locked_documents_rels_book_chapters_id_idx" ON "payload_locked_documents_rels" USING btree ("book_chapters_id");
  CREATE INDEX "payload_locked_documents_rels_authors_id_idx" ON "payload_locked_documents_rels" USING btree ("authors_id");
  CREATE INDEX "payload_locked_documents_rels_publishers_id_idx" ON "payload_locked_documents_rels" USING btree ("publishers_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_series_id_idx" ON "payload_locked_documents_rels" USING btree ("series_id");
  CREATE INDEX "payload_locked_documents_rels_lists_id_idx" ON "payload_locked_documents_rels" USING btree ("lists_id");
  CREATE INDEX "payload_locked_documents_rels_blog_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_posts_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_social_links_order_idx" ON "site_settings_social_links" USING btree ("_order");
  CREATE INDEX "site_settings_social_links_parent_id_idx" ON "site_settings_social_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_default_og_image_idx" ON "site_settings" USING btree ("default_og_image_id");
  CREATE INDEX "site_settings_hero_book_idx" ON "site_settings" USING btree ("hero_book_id");
  CREATE INDEX "site_settings_rels_order_idx" ON "site_settings_rels" USING btree ("order");
  CREATE INDEX "site_settings_rels_parent_idx" ON "site_settings_rels" USING btree ("parent_id");
  CREATE INDEX "site_settings_rels_path_idx" ON "site_settings_rels" USING btree ("path");
  CREATE INDEX "site_settings_rels_lists_id_idx" ON "site_settings_rels" USING btree ("lists_id");
  CREATE INDEX "site_settings_rels_categories_id_idx" ON "site_settings_rels" USING btree ("categories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "books_table_of_contents" CASCADE;
  DROP TABLE "books_quotes" CASCADE;
  DROP TABLE "books_faq_items" CASCADE;
  DROP TABLE "books_awards" CASCADE;
  DROP TABLE "books_adaptations" CASCADE;
  DROP TABLE "books_other_stores" CASCADE;
  DROP TABLE "books_rights_evidence" CASCADE;
  DROP TABLE "books" CASCADE;
  DROP TABLE "books_rels" CASCADE;
  DROP TABLE "_books_v_version_table_of_contents" CASCADE;
  DROP TABLE "_books_v_version_quotes" CASCADE;
  DROP TABLE "_books_v_version_faq_items" CASCADE;
  DROP TABLE "_books_v_version_awards" CASCADE;
  DROP TABLE "_books_v_version_adaptations" CASCADE;
  DROP TABLE "_books_v_version_other_stores" CASCADE;
  DROP TABLE "_books_v_version_rights_evidence" CASCADE;
  DROP TABLE "_books_v" CASCADE;
  DROP TABLE "_books_v_rels" CASCADE;
  DROP TABLE "book_chapters" CASCADE;
  DROP TABLE "_book_chapters_v" CASCADE;
  DROP TABLE "authors_name_aliases" CASCADE;
  DROP TABLE "authors_external_links" CASCADE;
  DROP TABLE "authors" CASCADE;
  DROP TABLE "authors_rels" CASCADE;
  DROP TABLE "publishers" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "series" CASCADE;
  DROP TABLE "lists_entries" CASCADE;
  DROP TABLE "lists" CASCADE;
  DROP TABLE "_lists_v_version_entries" CASCADE;
  DROP TABLE "_lists_v" CASCADE;
  DROP TABLE "blog_posts" CASCADE;
  DROP TABLE "blog_posts_rels" CASCADE;
  DROP TABLE "_blog_posts_v" CASCADE;
  DROP TABLE "_blog_posts_v_rels" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_social_links" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_rels" CASCADE;
  DROP TABLE "affiliate_settings" CASCADE;
  DROP TYPE "public"."enum_books_adaptations_kind";
  DROP TYPE "public"."enum_books_stock_status";
  DROP TYPE "public"."enum_books_rights_tier";
  DROP TYPE "public"."enum_books_takedown_status";
  DROP TYPE "public"."enum_books_bibliographic_language";
  DROP TYPE "public"."enum_books_bibliographic_binding";
  DROP TYPE "public"."enum_books_status";
  DROP TYPE "public"."enum__books_v_version_adaptations_kind";
  DROP TYPE "public"."enum__books_v_version_stock_status";
  DROP TYPE "public"."enum__books_v_version_rights_tier";
  DROP TYPE "public"."enum__books_v_version_takedown_status";
  DROP TYPE "public"."enum__books_v_version_bibliographic_language";
  DROP TYPE "public"."enum__books_v_version_bibliographic_binding";
  DROP TYPE "public"."enum__books_v_version_status";
  DROP TYPE "public"."enum_book_chapters_status";
  DROP TYPE "public"."enum__book_chapters_v_version_status";
  DROP TYPE "public"."enum_publishers_permission_status";
  DROP TYPE "public"."enum_lists_status";
  DROP TYPE "public"."enum__lists_v_version_status";
  DROP TYPE "public"."enum_blog_posts_status";
  DROP TYPE "public"."enum__blog_posts_v_version_status";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_reviews_status";`)
}

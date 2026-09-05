import Link from "next/link";
import type { Metadata } from "next";
import type { FaqItem } from "@/lib/types";
import {
  getFeaturedBooks,
  getRecentBooks,
  getPopularBooks,
  getFreePdfBooks,
  getCategories,
  getLists,
  getBlogPosts,
  safeJsonLd,
} from "@/lib/data";
import { toBengaliNumerals, formatBengaliDate } from "@/lib/numerals";
import { SITE_TAGLINE } from "@/lib/seo";
import BookCard, { BookGrid } from "@/components/BookCard";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Homepage FAQ. Also emitted as FAQPage structured data below, which is why it
// lives in one array instead of being written twice: the rich result is dropped
// if the JSON-LD text and the on-page text disagree.
const HOME_FAQ: FaqItem[] = [
  {
    question: "বইদ্বীপ থেকে কি সত্যিই ফ্রি PDF ডাউনলোড করা যায়?",
    answer:
      "হ্যাঁ। যেসব বই পাবলিক ডোমেইনে আছে বা উন্মুক্ত লাইসেন্সে/অনুমতিতে বিতরণযোগ্য, শুধু সেগুলোরই PDF এখানে বিনামূল্যে ডাউনলোড করা যায়। কপিরাইট থাকা বইয়ের PDF আমরা রাখি না; সেসব বইয়ের পাতায় রিভিউ, রেটিং ও রকমারিতে কেনার লিংক থাকে।",
  },
  {
    question: "অনলাইনে পড়ার সুবিধাটা কীভাবে কাজ করে?",
    answer:
      "যেসব বইয়ের অনলাইন সংস্করণ যুক্ত করা হয়েছে, সেগুলোর পাতায় 'অনলাইনে পড়ুন' বোতাম পাবেন। ক্লিক করলে অধ্যায় ধরে ধরে সরাসরি ব্রাউজারে পড়া যায়, কোনো অ্যাপ বা ডাউনলোডের দরকার হয় না।",
  },
  {
    question: "বইয়ের রিভিউ কি পাঠকরা লিখতে পারেন?",
    answer:
      "পারেন। প্রতিটি বইয়ের পাতার নিচে রেটিংসহ রিভিউ লেখার ফর্ম আছে। জমা দেওয়া রিভিউ যাচাইয়ের পর প্রকাশিত হয়, তাই প্রকাশ হতে কিছুটা সময় লাগতে পারে।",
  },
  {
    question: "কপিরাইট নিয়ে বইদ্বীপের নীতি কী?",
    answer:
      "আমরা শুধু আইনসম্মতভাবে বিতরণযোগ্য বইয়ের ফাইল রাখি: পাবলিক ডোমেইন, উন্মুক্ত লাইসেন্স, বা প্রকাশক/লেখকের লিখিত অনুমতি। কোনো বই নিয়ে আপত্তি থাকলে যোগাযোগ পাতা থেকে জানালে আমরা দ্রুত ব্যবস্থা নিই।",
  },
];

export default async function HomePage() {
  const [featured, recent, popular, freePdf, categories, lists, posts] =
    await Promise.all([
      getFeaturedBooks(5),
      getRecentBooks(10),
      getPopularBooks(10),
      getFreePdfBooks(10),
      getCategories(),
      getLists(),
      getBlogPosts(),
    ]);

  // The hero row: editor-flagged featured books lead; if nobody flagged any,
  // the newest books stand in so a fresh install still has a first screen.
  const heroBooks = featured.length > 0 ? featured : recent.slice(0, 5);
  const heroSlugs = new Set(heroBooks.map((b) => b.slug));
  // The "নতুন বই" strip drops anything already shown in the hero — the same
  // cover twice in the first two screens reads as a bug, not curation.
  const recentRest = recent.filter((b) => !heroSlugs.has(b.slug)).slice(0, 5);

  /* The FAQ, and ONLY the FAQ.
   *
   *  This used to repeat the WebSite node with its SearchAction, which the root
   *  layout already emits on every page — same `@id`, so the two were the same
   *  entity declared twice. Harmless in the sense that any consumer merges on
   *  `@id`, but the copy here was a strict SUBSET of the layout's: it had no
   *  `publisher` edge back to the Organization. A duplicate that is missing a
   *  property is the shape a future edit turns into a contradiction, and it cost
   *  bytes in the one document where byte count is measured. So the home page
   *  contributes what only the home page has, and points at the site node rather
   *  than restating it. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: HOME_FAQ.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <div className="shell py-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section id="hero-section" className="text-center sm:py-4">
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          {SITE_TAGLINE}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
          পাবলিক ডোমেইন ও অনুমতিপ্রাপ্ত বাংলা বইয়ের ফ্রি PDF ডাউনলোড, অধ্যায় ধরে
          অনলাইনে পড়া, পাঠকদের রিভিউ-রেটিং, আর যে বই কিনতে হয়, তার যাচাই করা
          কেনার লিংক। সব এক দ্বীপে।
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/search" className="btn-primary">
            বই খুঁজুন
          </Link>
          <Link href="/new" className="btn-secondary">
            নতুন বই দেখুন
          </Link>
        </div>
      </section>

      {/* ── Featured / hero shelf ─────────────────────────────────────── */}
      {heroBooks.length > 0 && (
        <section className="mt-10" aria-labelledby="featured-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="featured-heading" className="section-title">
              বাছাই করা বই
            </h2>
            <Link href="/popular" className="text-sm font-semibold text-accent hover:underline">
              সব দেখুন →
            </Link>
          </div>
          <div className="mt-4">
            <BookGrid>
              {heroBooks.map((b, i) => (
                // The first cover is the LCP element on a phone; it must not
                // be lazy.
                <BookCard key={b.slug} book={b} priority={i === 0} />
              ))}
            </BookGrid>
          </div>
        </section>
      )}

      {/* ── Free PDF shelf ────────────────────────────────────────────── */}
      {freePdf.length > 0 && (
        <section className="mt-12" aria-labelledby="free-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="free-heading" className="section-title">
              ফ্রি PDF ডাউনলোড
            </h2>
            <Link href="/search" className="text-sm font-semibold text-accent hover:underline">
              আরও খুঁজুন →
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            পাবলিক ডোমেইন ও উন্মুক্ত লাইসেন্সের বই। নামানো সম্পূর্ণ বৈধ ও বিনামূল্যে।
          </p>
          <div className="mt-4">
            <BookGrid>
              {freePdf.slice(0, 10).map((b) => (
                <BookCard key={b.slug} book={b} />
              ))}
            </BookGrid>
          </div>
        </section>
      )}

      <div className="mt-12">
        <AdSlot placement="listing" minHeight={250} />
      </div>

      {/* ── New books ─────────────────────────────────────────────────── */}
      {recentRest.length > 0 && (
        <section className="mt-12" aria-labelledby="recent-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent-heading" className="section-title">
              নতুন যুক্ত হয়েছে
            </h2>
            <Link href="/new" className="text-sm font-semibold text-accent hover:underline">
              সব নতুন বই →
            </Link>
          </div>
          <div className="mt-4">
            <BookGrid>
              {recentRest.map((b) => (
                <BookCard key={b.slug} book={b} />
              ))}
            </BookGrid>
          </div>
        </section>
      )}

      {/* ── Popular ───────────────────────────────────────────────────── */}
      {popular.length > 0 && (
        <section className="mt-12" aria-labelledby="popular-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="popular-heading" className="section-title">
              জনপ্রিয় বই
            </h2>
            <Link href="/popular" className="text-sm font-semibold text-accent hover:underline">
              সব দেখুন →
            </Link>
          </div>
          <div className="mt-4">
            <BookGrid>
              {popular.slice(0, 5).map((b) => (
                <BookCard key={b.slug} book={b} />
              ))}
            </BookGrid>
          </div>
        </section>
      )}

      {/* ── Categories ────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="mt-12" aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="section-title">
            বিভাগ অনুযায়ী দেখুন
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="chip hover:border-accent hover:text-accent"
              >
                {c.name}
                {c.bookCount > 0 && (
                  <span className="text-ink-muted"> {toBengaliNumerals(c.bookCount)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Curated lists ─────────────────────────────────────────────── */}
      {lists.length > 0 && (
        <section className="mt-12" aria-labelledby="lists-heading">
          <h2 id="lists-heading" className="section-title">
            বাছাই করা তালিকা
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.slice(0, 6).map((l) => (
              <Link key={l.slug} href={`/list/${l.slug}`} className="card-interactive block p-5">
                <h3 className="font-bold leading-snug text-ink">{l.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">
                  {toBengaliNumerals(l.entries.length)}টি বই · {formatBengaliDate(l.publishDate)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Blog teasers ──────────────────────────────────────────────── */}
      {posts.length > 0 && (
        <section className="mt-12" aria-labelledby="blog-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="blog-heading" className="section-title">
              ব্লগ থেকে
            </h2>
            <Link href="/blog" className="text-sm font-semibold text-accent hover:underline">
              সব লেখা →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.slice(0, 3).map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="card-interactive block p-5">
                <h3 className="font-bold leading-snug text-ink">{p.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">
                  {p.summary}
                </p>
                <p className="mt-3 text-xs text-ink-muted">{formatBengaliDate(p.publishDate)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────────────────────
          One element, not a wrapper around another: Faq renders its own
          <section> and <h2>. This used to add a second heading with the SAME
          id="faq-heading" and the same text around it — duplicate ids, nested
          landmarks, and the heading printed twice on the page Google reads the
          FAQPage markup from. The wrapper's only real contribution was the
          measure width, so it is passed as className instead. */}
      <Faq
        items={HOME_FAQ}
        headingId="home-faq-heading"
        className="mx-auto mt-14 max-w-3xl"
      />
    </div>
  );
}

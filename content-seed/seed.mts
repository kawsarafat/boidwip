/** Boidwip launch content seed.
 *
 *  Run from the repo root:  node ./node_modules/.bin/tsx content-seed/seed.mts
 *  (Next is not involved; DATABASE_URL + PAYLOAD_SECRET must be in the
 *  process env — the script loads ../.env itself.)
 *
 *  Everything here is public-domain: all three authors died 60+ years ago
 *  (Bankim 1894, Tagore 1941, Sarat Chandra 1938), so every book is
 *  rightsTier "public-domain" under Bangladesh's life+60 term. The PDF
 *  links point at Wikisource/Wikimedia Commons scans, and the reader
 *  chapters carry proofread Wikisource text.
 *
 *  Idempotent: each create is skipped if the slug already exists.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPayload, type Payload } from "payload";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- .env loader (tsx does not load it; & in DATABASE_URL breaks shell sourcing)
// Optional, and that matters: CI runners and hosted environments inject
// DATABASE_URL / PAYLOAD_SECRET into the process env directly and have no .env
// file at all. Reading it unconditionally threw ENOENT before payload.config
// could report which variable was actually missing.
//
// SPLIT ON /\r?\n/, NOT "\n". A .env written by any Windows editor is CRLF, and
// splitting on "\n" alone leaves a trailing \r on every line. `(.*)` does not
// match \r — it is a line terminator to a JS regex — so `$` never reached the
// end of the string and this loader parsed ZERO keys out of a perfectly good
// file. The failure then surfaced from payload.config as "DATABASE_URL is not
// set. Add it to .env locally", on a machine where it was sitting in .env.
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { default: config } = await import("../payload.config");

// ---- Lexical helpers -------------------------------------------------------
type LexNode = Record<string, unknown>;
const text = (t: string): LexNode => ({ type: "text", version: 1, text: t, format: 0, detail: 0, mode: "normal", style: "" });
const para = (t: string): LexNode => ({ type: "paragraph", version: 1, format: "", indent: 0, direction: "ltr", children: [text(t)] });
const heading = (t: string, tag: "h2" | "h3" = "h2"): LexNode => ({ type: "heading", tag, version: 1, format: "", indent: 0, direction: "ltr", children: [text(t)] });
const rich = (nodes: LexNode[]) => ({ root: { type: "root", version: 1, format: "", indent: 0, direction: "ltr", children: nodes } });
const richParas = (paras: string[]) => rich(paras.map(para));

const chapterFile = (name: string): string[] =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "chapters", name), "utf8"));

const NOW = new Date().toISOString();

async function ensure(payload: Payload, collection: string, slug: string, data: Record<string, unknown>): Promise<number> {
  const existing = await payload.find({ collection: collection as never, where: { slug: { equals: slug } }, limit: 1, overrideAccess: true });
  if (existing.docs.length > 0) {
    console.log(`  = ${collection}/${slug} exists (${existing.docs[0].id})`);
    return existing.docs[0].id as number;
  }
  const doc = await payload.create({
    collection: collection as never,
    data: data as never,
    overrideAccess: true,
    context: { skipRevalidate: true },
    draft: false,
  });
  console.log(`  + ${collection}/${slug} created (${doc.id})`);
  return doc.id as number;
}

const payload = await getPayload({ config });
console.log("Seeding Boidwip launch content…");

// ---- 1. Authors -------------------------------------------------------------
console.log("Authors:");
const sarat = await ensure(payload, "authors", "sarat-chandra-chattopadhyay", {
  name: "শরৎচন্দ্র চট্টোপাধ্যায়",
  nameLatin: "Sarat Chandra Chattopadhyay",
  slug: "sarat-chandra-chattopadhyay",
  birthYear: 1876,
  deathYear: 1938,
  birthPlace: "দেবানন্দপুর, হুগলি",
  nationality: "ভারতীয়",
  bio: richParas([
    "শরৎচন্দ্র চট্টোপাধ্যায় (১৮৭৬–১৯৩৮) বাংলা সাহিত্যের সবচেয়ে জনপ্রিয় ঔপন্যাসিক — 'অপরাজেয় কথাশিল্পী' নামে যিনি আজও পাঠকের হৃদয়ে অমলিন। দেবদাস, শ্রীকান্ত, পরিণীতা, দেনা-পাওনা, পথের দাবী — তাঁর একেকটি উপন্যাস বাংলা ঘরে ঘরে পঠিত, আর দেবদাস অবলম্বনে নির্মিত হয়েছে ডজনখানেকের বেশি চলচ্চিত্র।",
    "হুগলির দেবানন্দপুরে দরিদ্র পরিবারে জন্ম নেওয়া শরৎচন্দ্রের জীবন ছিল তাঁর উপন্যাসের মতোই বিচিত্র — রেঙ্গুনে কেরানির চাকরি থেকে শুরু করে সন্ন্যাসীর বেশে ঘুরে বেড়ানো পর্যন্ত। এই অভিজ্ঞতাই তাঁর লেখায় এনেছে গ্রামবাংলার মানুষের, বিশেষত অবহেলিত নারীর, এমন গভীর সহানুভূতিশীল চিত্রণ যা বাংলা কথাসাহিত্যে আগে কখনো দেখা যায়নি।",
    "১৯৩৮ সালে তাঁর মৃত্যুর ৬০ বছর পেরিয়ে যাওয়ায় তাঁর সমস্ত রচনা এখন পাবলিক ডোমেইনে — অর্থাৎ আইনসিদ্ধভাবে বিনামূল্যে পড়া ও ডাউনলোড করা যায়। বইদ্বীপে তাঁর উপন্যাসগুলো পিডিএফে নামানো ও অনলাইনে অধ্যায় ধরে পড়ার ব্যবস্থা আছে।",
  ]),
  featured: true,
});
const tagore = await ensure(payload, "authors", "rabindranath-tagore", {
  name: "রবীন্দ্রনাথ ঠাকুর",
  nameLatin: "Rabindranath Tagore",
  slug: "rabindranath-tagore",
  birthYear: 1861,
  deathYear: 1941,
  birthPlace: "জোড়াসাঁকো, কলকাতা",
  nationality: "ভারতীয়",
  bio: richParas([
    "রবীন্দ্রনাথ ঠাকুর (১৮৬১–১৯৪১) — বিশ্বকবি, এশিয়ার প্রথম নোবেল বিজয়ী (সাহিত্যে, ১৯১৩, গীতাঞ্জলির জন্য), এবং বাংলা ভাষার সর্বকালের সেরা সাহিত্যপ্রতিভা। কবিতা, উপন্যাস, ছোটগল্প, নাটক, গান, প্রবন্ধ — সাহিত্যের এমন কোনো শাখা নেই যেখানে তাঁর হাত পড়েনি এবং সেই শাখা বদলে যায়নি।",
    "তাঁর উপন্যাসগুলো — গোরা, ঘরে-বাইরে, চোখের বালি, শেষের কবিতা — বাংলা উপন্যাসকে মনস্তত্ত্ব ও ভাবনার যে গভীরতায় নিয়ে গেছে, তা আজও অতিক্রম করা যায়নি। শেষের কবিতার অমিত-লাবণ্য কিংবা ঘরে-বাইরের বিমলা-নিখিলেশ-সন্দীপ ত্রিভুজ এখনো পাঠকের আলোচনার বিষয়।",
    "আমার সোনার বাংলা ও জনগণমন — দুই দেশের জাতীয় সংগীতের রচয়িতা রবীন্দ্রনাথের মৃত্যু ১৯৪১ সালে; তাঁর সমগ্র রচনা এখন পাবলিক ডোমেইনে, তাই বইদ্বীপে তাঁর বই বিনামূল্যে পিডিএফ ডাউনলোড করা সম্পূর্ণ আইনসিদ্ধ।",
  ]),
  featured: true,
});
const bankim = await ensure(payload, "authors", "bankim-chandra-chattopadhyay", {
  name: "বঙ্কিমচন্দ্র চট্টোপাধ্যায়",
  nameLatin: "Bankim Chandra Chattopadhyay",
  slug: "bankim-chandra-chattopadhyay",
  birthYear: 1838,
  deathYear: 1894,
  birthPlace: "নৈহাটি, চব্বিশ পরগনা",
  nationality: "ভারতীয়",
  bio: richParas([
    "বঙ্কিমচন্দ্র চট্টোপাধ্যায় (১৮৩৮–১৮৯৪) — বাংলা উপন্যাসের জনক, 'সাহিত্য সম্রাট'। দুর্গেশনন্দিনী (১৮৬৫) দিয়ে বাংলা ভাষায় আধুনিক উপন্যাসের সূচনা তাঁর হাতেই, আর আনন্দমঠের 'বন্দে মাতরম্' গান হয়ে উঠেছিল ভারতের স্বাধীনতা আন্দোলনের মন্ত্র।",
    "কপালকুণ্ডলা, বিষবৃক্ষ, কৃষ্ণকান্তের উইল, রাজসিংহ — তাঁর চৌদ্দটি উপন্যাসের প্রতিটিই বাংলা গদ্যকে নতুন উচ্চতা দিয়েছে। ডেপুটি ম্যাজিস্ট্রেটের চাকরির পাশাপাশি বঙ্গদর্শন পত্রিকা সম্পাদনা করে তিনি গড়ে তুলেছিলেন বাংলা সাহিত্যের প্রথম আধুনিক সাহিত্যিক পরিমণ্ডল।",
    "১৮৯৪ সালে প্রয়াত বঙ্কিমচন্দ্রের সব লেখা বহু আগেই পাবলিক ডোমেইনে — বইদ্বীপে তাঁর উপন্যাস বিনামূল্যে ডাউনলোড ও পড়া যায়।",
  ]),
  featured: true,
});

// ---- 2. Categories ----------------------------------------------------------
console.log("Categories:");
const catNovel = await ensure(payload, "categories", "uponnash", {
  name: "উপন্যাস", nameLatin: "Novel", slug: "uponnash", order: 1, featured: true,
  description: richParas(["বাংলা উপন্যাসের সংগ্রহ — ধ্রুপদী থেকে আধুনিক। বঙ্কিমচন্দ্র থেকে শুরু করে রবীন্দ্রনাথ, শরৎচন্দ্র হয়ে আজকের লেখক পর্যন্ত: প্রেম, সমাজ, ইতিহাস ও মনস্তত্ত্বের আখ্যান। পাবলিক ডোমেইনের বইগুলো বিনামূল্যে পিডিএফ ডাউনলোড করা যায়।"]),
});
const catClassic = await ensure(payload, "categories", "dhrupodi-sahitya", {
  name: "ধ্রুপদী সাহিত্য", nameLatin: "Classic Literature", slug: "dhrupodi-sahitya", order: 2, featured: true,
  description: richParas(["বাংলা সাহিত্যের ধ্রুপদী রচনা — যে বইগুলো সময়ের পরীক্ষায় উত্তীর্ণ। এই বিভাগের প্রায় সব বই পাবলিক ডোমেইনে, তাই আইনসিদ্ধভাবে বিনামূল্যে পড়ুন ও ডাউনলোড করুন।"]),
});
const catRomance = await ensure(payload, "categories", "premer-uponnash", {
  name: "প্রেমের উপন্যাস", nameLatin: "Romance", slug: "premer-uponnash", order: 3, featured: true,
  description: richParas(["বাংলা প্রেমের উপন্যাস — দেবদাস-পার্বতী থেকে অমিত-লাবণ্য। বিরহ, মিলন আর হৃদয়ভাঙার অমর আখ্যানগুলো একসঙ্গে।"]),
});
const catHistorical = await ensure(payload, "categories", "oitihashik-uponnash", {
  name: "ঐতিহাসিক উপন্যাস", nameLatin: "Historical Fiction", slug: "oitihashik-uponnash", order: 4, featured: false,
  description: richParas(["ইতিহাসের পটভূমিতে লেখা বাংলা উপন্যাস — বঙ্কিমচন্দ্রের আনন্দমঠ ও দুর্গেশনন্দিনী থেকে শুরু করে সন্ন্যাসী বিদ্রোহ, মুঘল-পাঠান যুগের আখ্যান।"]),
});

// ---- 3. Books ---------------------------------------------------------------
console.log("Books:");
const PD = {
  rightsTier: "public-domain",
  takedownStatus: "none",
  publishDate: NOW,
  _status: "published",
};

const devdas = await ensure(payload, "books", "devdas", {
  ...PD,
  title: "দেবদাস",
  titleLatin: "Devdas",
  subtitle: "বাংলা সাহিত্যের সবচেয়ে বিখ্যাত ট্র্যাজিক প্রেমের উপন্যাস — দেবদাস, পার্বতী আর চন্দ্রমুখীর অমর আখ্যান।",
  slug: "devdas",
  authors: [sarat],
  categories: [catNovel, catClassic, catRomance],
  primaryCategory: catRomance,
  rightsBasis: "শরৎচন্দ্র চট্টোপাধ্যায়ের মৃত্যু ১৯৩৮ সালে — বাংলাদেশ কপিরাইট আইনের জীবন+৬০ মেয়াদ বহু আগে উত্তীর্ণ। স্ক্যান: বাংলা উইকিসংকলন (গুরুদাস চট্টোপাধ্যায় এণ্ড সন্স সংস্করণ)।",
  // The PUBLIC half of the same provenance. rightsBasis above is
  // authenticated-read-only because it carries our legal reasoning, so it can
  // never be what the page shows; this pair is what components/TextSourceNote
  // renders. Every URL here is the scan's own file page on the project that
  // hosts it, derived from pdfExternalUrl below rather than hand-picked, so the
  // citation cannot drift from the file we actually serve.
  textSourceName: "বাংলা উইকিসংকলন",
  textSourceUrl: "https://bn.wikisource.org/wiki/%E0%A6%9A%E0%A6%BF%E0%A6%A4%E0%A7%8D%E0%A6%B0:%E0%A6%A6%E0%A7%87%E0%A6%AC%E0%A6%A6%E0%A6%BE%E0%A6%B8_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfExternalUrl: "https://upload.wikimedia.org/wikisource/bn/4/4e/%E0%A6%A6%E0%A7%87%E0%A6%AC%E0%A6%A6%E0%A6%BE%E0%A6%B8_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfSizeBytes: 5841634,
  bibliographic: { firstPublished: 1917, language: "bn" },
  synopsis: rich([
    para("দেবদাস বাংলা সাহিত্যের সবচেয়ে পঠিত, সবচেয়ে আলোচিত এবং সবচেয়ে বেশি চলচ্চিত্রায়িত উপন্যাস। তালশোনাপুর গ্রামের জমিদারপুত্র দেবদাস আর প্রতিবেশী পার্বতীর শৈশবের বন্ধুত্ব যৌবনে গড়ায় প্রেমে — কিন্তু বংশমর্যাদার দেয়ালে সে প্রেম ভেঙে পড়ে। পার্বতীর বিয়ে হয়ে যায় বয়স্ক জমিদারের সঙ্গে, আর ভগ্নহৃদয় দেবদাস কলকাতায় ডুবে যায় মদ আর আত্মধ্বংসে।"),
    para("সেখানেই আসে চন্দ্রমুখী — যে বাইজি দেবদাসকে ভালোবেসে বদলে ফেলে নিজের জীবন, অথচ দেবদাসের হৃদয়ে পার্বতীর জায়গা সে কোনোদিন পায় না। শেষ দৃশ্যে মুমূর্ষু দেবদাস পার্বতীকে দেওয়া কথা রাখতে গরুর গাড়িতে পাড়ি দেয় হাতিপোতা গ্রামে — বাংলা সাহিত্যের সবচেয়ে হৃদয়বিদারক সমাপ্তিগুলোর একটি।"),
    para("১৯১৭ সালে প্রকাশিত এই উপন্যাস অবলম্বনে হিন্দি, বাংলা, তেলুগু, তামিলসহ বিভিন্ন ভাষায় বিশটিরও বেশি চলচ্চিত্র হয়েছে — কে এল সায়গল, দিলীপ কুমার, শাহরুখ খান তিন প্রজন্মে দেবদাস হয়েছেন। এখানে বইটির মূল বাংলা পিডিএফ বিনামূল্যে ডাউনলোড করুন কিংবা অধ্যায় ধরে অনলাইনে পড়ুন।"),
  ]),
  whoShouldRead: "ধ্রুপদী বাংলা প্রেমের উপন্যাসের পাঠক; যাঁরা দেবদাস সিনেমা দেখেছেন কিন্তু মূল বইটি পড়েননি; বাংলা সাহিত্যের ছাত্রছাত্রী; ট্র্যাজিক প্রেমকাহিনির ভক্ত।",
  quotes: [
    { text: "বড় দুঃখে, বড় ব্যথায় দেবদাসের কাহিনী শেষ হইল।" },
    { text: "মৃত্যুর সময় কাহারও একবার দেখা পাইবে — এ আশা যেন তাহার মিটে।" },
  ],
  faqItems: [
    { question: "দেবদাস পিডিএফ ডাউনলোড কি বৈধ?", answer: "হ্যাঁ, সম্পূর্ণ বৈধ। শরৎচন্দ্র চট্টোপাধ্যায় ১৯৩৮ সালে প্রয়াত হয়েছেন — কপিরাইটের মেয়াদ (মৃত্যুর পর ৬০ বছর) বহু আগে শেষ। বইটি এখন পাবলিক ডোমেইনে, তাই বিনামূল্যে ডাউনলোড ও বিতরণ আইনসিদ্ধ।" },
    { question: "দেবদাস উপন্যাসের মূল বিষয় কী?", answer: "বংশমর্যাদা আর সামাজিক প্রথার কাছে হেরে যাওয়া প্রেম, এবং সেই ক্ষত থেকে জন্ম নেওয়া আত্মধ্বংস। দেবদাস-পার্বতী-চন্দ্রমুখীর ত্রিভুজ আসলে ভালোবাসার তিন রূপ: হারানো প্রেম, নিঃস্বার্থ প্রেম আর অনুশোচনা।" },
    { question: "দেবদাস নিয়ে কতগুলো সিনেমা হয়েছে?", answer: "বিভিন্ন ভাষায় বিশটিরও বেশি — সবচেয়ে বিখ্যাত ১৯৫৫ সালের বিমল রায়ের সংস্করণ (দিলীপ কুমার) আর ২০০২ সালের সঞ্জয় লীলা বনশালীর সংস্করণ (শাহরুখ খান, ঐশ্বরিয়া রাই)।" },
  ],
  adaptations: [
    { title: "দেবদাস (বিমল রায়)", kind: "film", year: 1955 },
    { title: "দেবদাস (সঞ্জয় লীলা বনশালী)", kind: "film", year: 2002 },
  ],
  popular: true,
  featured: true,
});

const parineeta = await ensure(payload, "books", "parineeta", {
  ...PD,
  title: "পরিণীতা",
  titleLatin: "Parineeta",
  subtitle: "ললিতা আর শেখরের নিঃশব্দ ভালোবাসার গল্প — শরৎচন্দ্রের সবচেয়ে মায়াময় ছোট উপন্যাস।",
  slug: "parineeta",
  authors: [sarat],
  categories: [catNovel, catClassic, catRomance],
  primaryCategory: catRomance,
  rightsBasis: "শরৎচন্দ্র চট্টোপাধ্যায়ের মৃত্যু ১৯৩৮ — পাবলিক ডোমেইন। স্ক্যান: বাংলা উইকিসংকলন।",
  textSourceName: "বাংলা উইকিসংকলন",
  textSourceUrl: "https://bn.wikisource.org/wiki/%E0%A6%9A%E0%A6%BF%E0%A6%A4%E0%A7%8D%E0%A6%B0:%E0%A6%AA%E0%A6%B0%E0%A6%BF%E0%A6%A3%E0%A7%80%E0%A6%A4%E0%A6%BE_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfExternalUrl: "https://upload.wikimedia.org/wikisource/bn/a/a0/%E0%A6%AA%E0%A6%B0%E0%A6%BF%E0%A6%A3%E0%A7%80%E0%A6%A4%E0%A6%BE_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfSizeBytes: 4157748,
  bibliographic: { firstPublished: 1914, language: "bn" },
  synopsis: rich([
    para("তেরো বছরের অনাথ ললিতা বড় হয়েছে মামার সংসারে, আর পাশের বাড়ির শেখরের সঙ্গে তার সম্পর্ক — বন্ধুত্ব, অভ্যাস, না ভালোবাসা, তা দুজনের কেউই জানে না। এক সন্ধ্যায় খেলার ছলে মালাবদল হয়ে যায়; ললিতার কাছে সেটাই বিয়ে, শেখরের কাছে — সে নিজেও নিশ্চিত নয়।"),
    para("এর মধ্যে ঢুকে পড়ে টাকা আর অহংকারের হিসাব: শেখরের বাবা নবীন রায়ের মহাজনি, ললিতার মামার অসহায়তা, আর উদারমনা গিরীনের নীরব উপস্থিতি। ভুল বোঝাবুঝির পাহাড় জমে ওঠে — ললিতা মুখ ফুটে কিছু বলে না, শেখরও না।"),
    para("১৯১৪ সালে প্রকাশিত এই উপন্যাসে শরৎচন্দ্র দেখিয়েছেন, না-বলা ভালোবাসা কীভাবে নিয়তি হয়ে ওঠে। সঞ্জয় লীলা বনশালীর প্রযোজনায় ২০০৫ সালের হিন্দি 'পরিণীতা' (বিদ্যা বালান, সাইফ আলি খান) এই বইয়েরই চলচ্চিত্রায়ণ। মূল বাংলা পিডিএফ বিনামূল্যে নামান কিংবা অনলাইনে পড়ুন।"),
  ]),
  whoShouldRead: "ছোট অথচ গভীর উপন্যাসের পাঠক; পরিণীতা (২০০৫) সিনেমার দর্শক; শরৎচন্দ্রে যাঁদের হাতেখড়ি হচ্ছে — এটি শুরু করার আদর্শ বই।",
  quotes: [{ text: "ভালোবাসা যে কী, তাহা ললিতা জানিত না; কিন্তু হারাইবার ভয় যে কী, তাহা সে হাড়ে হাড়ে বুঝিয়াছিল।" }],
  faqItems: [
    { question: "পরিণীতা পিডিএফ ফ্রি ডাউনলোড কি আইনসিদ্ধ?", answer: "হ্যাঁ। লেখকের মৃত্যুর (১৯৩৮) ৬০ বছর পেরিয়ে বইটি পাবলিক ডোমেইনে। এই পিডিএফটি বাংলা উইকিসংকলনের স্ক্যান থেকে নেওয়া।" },
    { question: "পরিণীতা উপন্যাস কত পৃষ্ঠার?", answer: "মূল বইটি বেশ ছোট — সংস্করণভেদে ৮০ থেকে ১১০ পৃষ্ঠা। এক বসাতেই পড়ে ফেলা যায়।" },
  ],
  adaptations: [{ title: "পরিণীতা (প্রদীপ সরকার)", kind: "film", year: 2005 }],
  popular: true,
});

const srikanta = await ensure(payload, "books", "srikanta", {
  ...PD,
  title: "শ্রীকান্ত",
  titleLatin: "Srikanta",
  subtitle: "চার পর্বে লেখা শরৎচন্দ্রের আত্মজৈবনিক মহাউপন্যাস — এক ভবঘুরের চোখে বাংলার জীবন।",
  slug: "srikanta",
  authors: [sarat],
  categories: [catNovel, catClassic],
  primaryCategory: catClassic,
  rightsBasis: "শরৎচন্দ্র চট্টোপাধ্যায়ের মৃত্যু ১৯৩৮ — পাবলিক ডোমেইন। স্ক্যান: বাংলা উইকিসংকলন (চার পর্ব একত্রে)।",
  textSourceName: "বাংলা উইকিসংকলন",
  textSourceUrl: "https://bn.wikisource.org/wiki/%E0%A6%9A%E0%A6%BF%E0%A6%A4%E0%A7%8D%E0%A6%B0:%E0%A6%B6%E0%A7%8D%E0%A6%B0%E0%A7%80%E0%A6%95%E0%A6%BE%E0%A6%A8%E0%A7%8D%E0%A6%A4_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfExternalUrl: "https://upload.wikimedia.org/wikisource/bn/f/fe/%E0%A6%B6%E0%A7%8D%E0%A6%B0%E0%A7%80%E0%A6%95%E0%A6%BE%E0%A6%A8%E0%A7%8D%E0%A6%A4_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfSizeBytes: 46367108,
  bibliographic: { firstPublished: 1917, language: "bn" },
  synopsis: rich([
    para("শ্রীকান্ত শরৎচন্দ্রের সবচেয়ে উচ্চাভিলাষী রচনা — ১৯১৭ থেকে ১৯৩৩, ষোলো বছর ধরে চার পর্বে লেখা এই উপন্যাসকে অনেকে তাঁর ছদ্ম-আত্মজীবনী বলেন। ভবঘুরে শ্রীকান্তের চোখ দিয়ে আমরা দেখি শৈশবের দুরন্ত ইন্দ্রনাথকে, স্নেহময়ী অন্নদাদিদিকে, আর সেই নারীকে যাকে বাংলা সাহিত্য কোনোদিন ভুলবে না — রাজলক্ষ্মী।"),
    para("গ্রামের পাঠশালা থেকে রেঙ্গুনের প্রবাস, শ্মশানের রাত থেকে জমিদারের শিকার-শিবির — শ্রীকান্তের যাত্রাপথে উঠে এসেছে বিশ শতকের গোড়ার বাংলার এমন এক জীবন্ত ছবি, যা কোনো ইতিহাস বইয়ে নেই। আর সবকিছুর কেন্দ্রে শ্রীকান্ত-রাজলক্ষ্মীর সম্পর্ক: যে টান বিয়ের নয়, সমাজের নয়, তবু জীবনের।"),
    para("চার পর্বের সম্পূর্ণ পিডিএফ এখানে বিনামূল্যে ডাউনলোড করুন — বইটি পাবলিক ডোমেইনে থাকায় এটি সম্পূর্ণ আইনসিদ্ধ।"),
  ]),
  whoShouldRead: "যাঁরা দেবদাস-পরিণীতা পড়ে শরৎচন্দ্রের গভীরে যেতে চান; আত্মজৈবনিক উপন্যাসের পাঠক; বিশ শতকের বাংলার সমাজচিত্রে আগ্রহীরা।",
  quotes: [{ text: "আমার এই 'ভবঘুরে' জীবনের অধ্যায়গুলি স্মরণ করিতে বসিয়া কত কথাই মনে পড়ে।" }],
  faqItems: [
    { question: "শ্রীকান্ত উপন্যাস কয় খণ্ডে লেখা?", answer: "চার পর্বে — প্রথম (১৯১৭), দ্বিতীয় (১৯১৮), তৃতীয় (১৯২৭) ও চতুর্থ (১৯৩৩)। এই পিডিএফে চারটি পর্বই আছে।" },
    { question: "শ্রীকান্ত কি শরৎচন্দ্রের আত্মজীবনী?", answer: "আনুষ্ঠানিকভাবে না, তবে শ্রীকান্তের ভবঘুরে জীবন, রেঙ্গুন-প্রবাস আর বহু চরিত্র শরৎচন্দ্রের নিজের জীবন থেকে নেওয়া — তাই একে ছদ্ম-আত্মজীবনী বলা হয়।" },
  ],
  popular: true,
});

const sheshKobita = await ensure(payload, "books", "shesher-kobita", {
  ...PD,
  title: "শেষের কবিতা",
  titleLatin: "Shesher Kobita",
  subtitle: "অমিত রায় আর লাবণ্যর প্রেম — রবীন্দ্রনাথের সবচেয়ে আধুনিক, সবচেয়ে উদ্ধৃত উপন্যাস।",
  slug: "shesher-kobita",
  authors: [tagore],
  categories: [catNovel, catClassic, catRomance],
  primaryCategory: catRomance,
  rightsBasis: "রবীন্দ্রনাথ ঠাকুরের মৃত্যু ১৯৪১ — জীবন+৬০ মেয়াদ ২০০১ সালে উত্তীর্ণ, পাবলিক ডোমেইন। স্ক্যান: উইকিমিডিয়া কমন্স (বিশ্বভারতী সংস্করণ)।",
  textSourceName: "উইকিমিডিয়া কমন্স",
  textSourceUrl: "https://commons.wikimedia.org/wiki/File:%E0%A6%B6%E0%A7%87%E0%A6%B7%E0%A7%87%E0%A6%B0_%E0%A6%95%E0%A6%AC%E0%A6%BF%E0%A6%A4%E0%A6%BE_-_%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0.pdf",
  pdfExternalUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ad/%E0%A6%B6%E0%A7%87%E0%A6%B7%E0%A7%87%E0%A6%B0_%E0%A6%95%E0%A6%AC%E0%A6%BF%E0%A6%A4%E0%A6%BE_-_%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0.pdf",
  pdfSizeBytes: 7777265,
  bibliographic: { firstPublished: 1929, language: "bn" },
  synopsis: rich([
    para("অক্সফোর্ড-ফেরত ব্যারিস্টার অমিত রায় — বুদ্ধির ঝলকে যে সবাইকে মুগ্ধ করে, অথচ কোনো কিছুতেই স্থির হয় না। শিলঙের পাহাড়ে গাড়ির ধাক্কায় (আক্ষরিক অর্থেই) তার দেখা হয় লাবণ্যর সঙ্গে — আর বাংলা সাহিত্য পেয়ে যায় তার সবচেয়ে বুদ্ধিদীপ্ত প্রেমের সংলাপগুলো।"),
    para("কিন্তু শেষের কবিতা শুধু প্রেমের গল্প নয় — এ প্রশ্ন তোলে: যাকে ভালোবাসি, তাকে বিয়ে করা কি জরুরি? অমিতের বিখ্যাত তত্ত্ব — কেতকী তার 'ঘড়ায় তোলা জল', প্রতিদিনের; লাবণ্য 'দিঘি', যার জলে সাঁতার কাটা যায় কিন্তু ঘরে আনা যায় না — আজও তর্ক জাগায়।"),
    para("১৯২৯ সালে প্রকাশিত, ৬৮ বছর বয়সে লেখা এই উপন্যাসে রবীন্দ্রনাথ নিজের রোমান্টিক ঘরানাকেই ব্যঙ্গ করেছেন — অমিতের মুখ দিয়ে 'রবি ঠাকুরের' সমালোচনা করিয়ে। 'কালের যাত্রার ধ্বনি শুনিতে কি পাও' — শেষের সেই কবিতাসহ সম্পূর্ণ বইটির পিডিএফ বিনামূল্যে ডাউনলোড করুন।"),
  ]),
  whoShouldRead: "আধুনিক মনস্তাত্ত্বিক প্রেমের উপন্যাসের পাঠক; যাঁরা রবীন্দ্রনাথকে শুধু কবি হিসেবে চেনেন; উদ্ধৃতিপ্রেমীরা — বাংলা সাহিত্যের সবচেয়ে quotable উপন্যাস এটিই।",
  quotes: [
    { text: "কালের যাত্রার ধ্বনি শুনিতে কি পাও?" },
    { text: "ভালোবাসার জোরেই মেয়েরা সংসার টিকিয়ে রাখে, আর সেই জোরেই পুরুষরা সংসার ছেড়ে পালায়।" },
  ],
  faqItems: [
    { question: "শেষের কবিতা কি কবিতার বই?", answer: "না — নাম শুনে অনেকে ভুল করেন। এটি উপন্যাস; তবে এর ভেতরে অমিত ও লাবণ্যর লেখা কয়েকটি কবিতা আছে, যার শেষটি ('কালের যাত্রার ধ্বনি...') বাংলা সাহিত্যের সবচেয়ে বিখ্যাত কবিতাগুলোর একটি।" },
    { question: "শেষের কবিতা পিডিএফ ডাউনলোড কি বৈধ?", answer: "হ্যাঁ। রবীন্দ্রনাথের মৃত্যু ১৯৪১ সালে; কপিরাইট ২০০১ সালে উত্তীর্ণ। বইটি পাবলিক ডোমেইনে — ডাউনলোড সম্পূর্ণ আইনসিদ্ধ।" },
  ],
  popular: true,
  featured: true,
});

const ghareBaire = await ensure(payload, "books", "ghare-baire", {
  ...PD,
  title: "ঘরে-বাইরে",
  titleLatin: "Ghare Baire (The Home and the World)",
  subtitle: "স্বদেশি আন্দোলনের আগুনে এক নারীর আত্ম-আবিষ্কার — বিমলা, নিখিলেশ ও সন্দীপের ত্রিভুজ।",
  slug: "ghare-baire",
  authors: [tagore],
  categories: [catNovel, catClassic],
  primaryCategory: catClassic,
  rightsBasis: "রবীন্দ্রনাথ ঠাকুরের মৃত্যু ১৯৪১ — পাবলিক ডোমেইন। স্ক্যান: উইকিমিডিয়া কমন্স।",
  textSourceName: "উইকিমিডিয়া কমন্স",
  textSourceUrl: "https://commons.wikimedia.org/wiki/File:%E0%A6%98%E0%A6%B0%E0%A7%87-%E0%A6%AC%E0%A6%BE%E0%A6%87%E0%A6%B0%E0%A7%87_-_%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0.pdf",
  pdfExternalUrl: "https://upload.wikimedia.org/wikipedia/commons/6/65/%E0%A6%98%E0%A6%B0%E0%A7%87-%E0%A6%AC%E0%A6%BE%E0%A6%87%E0%A6%B0%E0%A7%87_-_%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0.pdf",
  pdfSizeBytes: 18928201,
  bibliographic: { firstPublished: 1916, language: "bn" },
  synopsis: rich([
    para("১৯০৫-এর বঙ্গভঙ্গ-পরবর্তী উত্তাল বাংলা। জমিদার নিখিলেশ তার স্ত্রী বিমলাকে অন্দরমহল থেকে বাইরের জগতে আনতে চায় — বিশ্বাস করে, ভালোবাসা তখনই সত্য যখন তা মুক্ত। সেই মুক্তির দরজা দিয়েই ঢোকে সন্দীপ: স্বদেশি আন্দোলনের অগ্নিবক্তা, যার তেজস্বী দেশপ্রেমের আড়ালে লুকানো ক্ষমতা আর ভোগের লালসা।"),
    para("তিনজনের নিজের জবানিতে লেখা এই উপন্যাস একই সঙ্গে প্রেমের ত্রিভুজ আর রাজনৈতিক দার্শনিক বিতর্ক: দেশপ্রেম কখন অন্ধ উন্মাদনা হয়ে ওঠে? 'বন্দে মাতরম্' ধ্বনির নিচে চাপা পড়ে কার ঘর, কার সংসার? প্রকাশের একশ বছর পরেও প্রশ্নগুলো অস্বস্তিকরভাবে সমসাময়িক।"),
    para("সত্যজিৎ রায় ১৯৮৪ সালে এই উপন্যাস নিয়ে বানিয়েছিলেন তাঁর বিখ্যাত চলচ্চিত্র। মূল বইটির পিডিএফ বিনামূল্যে ডাউনলোড করুন — রবীন্দ্রনাথের সব লেখা এখন পাবলিক ডোমেইনে।"),
  ]),
  whoShouldRead: "রাজনৈতিক উপন্যাসের পাঠক; সত্যজিৎ রায়ের 'ঘরে বাইরে' সিনেমার দর্শক; নারীর আত্ম-আবিষ্কারের আখ্যানে আগ্রহীরা; ইতিহাস ও সাহিত্যের সংযোগ খোঁজা পাঠক।",
  quotes: [{ text: "আমি বাহিরকে ঘরে আনিব, ঘরকে বাহিরে লইয়া যাইব।" }],
  faqItems: [
    { question: "ঘরে-বাইরে উপন্যাসের পটভূমি কী?", answer: "১৯০৫ সালের বঙ্গভঙ্গ-পরবর্তী স্বদেশি আন্দোলন — বিদেশি পণ্য বর্জন আর 'বন্দে মাতরম্' যুগের বাংলা। এই রাজনৈতিক আগুনের মধ্যেই বিমলা-নিখিলেশ-সন্দীপের ব্যক্তিগত নাটক।" },
    { question: "সত্যজিৎ রায়ের সিনেমাটা কি বইয়ের হুবহু অনুসরণ?", answer: "মূল কাঠামো এক, তবে রায় কিছু চরিত্র ও ঘটনা সংহত করেছেন। বই পড়লে তিন কথকের ভেতরের স্বর পাওয়া যায়, যা সিনেমায় সম্ভব ছিল না।" },
  ],
  popular: false,
});

const anandamath = await ensure(payload, "books", "anandamath", {
  ...PD,
  title: "আনন্দমঠ",
  titleLatin: "Anandamath",
  subtitle: "'বন্দে মাতরম্'-এর জন্ম যে উপন্যাসে — সন্ন্যাসী বিদ্রোহের পটভূমিতে বঙ্কিমচন্দ্রের অগ্নিগর্ভ আখ্যান।",
  slug: "anandamath",
  authors: [bankim],
  categories: [catNovel, catClassic, catHistorical],
  primaryCategory: catHistorical,
  rightsBasis: "বঙ্কিমচন্দ্র চট্টোপাধ্যায়ের মৃত্যু ১৮৯৪ — এক শতাব্দীরও বেশি আগে পাবলিক ডোমেইনে। স্ক্যান: উইকিমিডিয়া কমন্স।",
  textSourceName: "উইকিমিডিয়া কমন্স",
  textSourceUrl: "https://commons.wikimedia.org/wiki/File:%E0%A6%86%E0%A6%A8%E0%A6%A8%E0%A7%8D%E0%A6%A6_%E0%A6%AE%E0%A6%A0_-_%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%95%E0%A6%BF%E0%A6%AE%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfExternalUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2b/%E0%A6%86%E0%A6%A8%E0%A6%A8%E0%A7%8D%E0%A6%A6_%E0%A6%AE%E0%A6%A0_-_%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%95%E0%A6%BF%E0%A6%AE%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  pdfSizeBytes: 8960701,
  bibliographic: { firstPublished: 1882, language: "bn" },
  synopsis: rich([
    para("১৭৭০-এর মন্বন্তরে বিধ্বস্ত বাংলা। দুর্ভিক্ষ আর অপশাসনের বিরুদ্ধে জেগে ওঠে 'সন্তান' নামের সন্ন্যাসী যোদ্ধাদের দল — মাতৃভূমিকে তারা পূজা করে মা রূপে। তাদের মঠই আনন্দমঠ, আর তাদের মন্ত্রই সেই গান যা পরে গোটা ভারতের স্বাধীনতা সংগ্রামের রণধ্বনি হয়ে উঠবে: বন্দে মাতরম্।"),
    para("মহেন্দ্র-কল্যাণীর সংসার ভেঙে যাওয়া, সত্যানন্দের নেতৃত্ব, শান্তির পুরুষবেশে যুদ্ধযাত্রা — ঐতিহাসিক সন্ন্যাসী বিদ্রোহের (১৭৭০-১৮২০) কাঠামোতে বঙ্কিমচন্দ্র বুনেছেন এমন এক আখ্যান যা উপন্যাস, ইতিহাস আর রাজনৈতিক ইশতেহারের মিশেল। প্রকাশের পর থেকেই বিতর্কিত, তবু বাংলা তথা ভারতীয় সাহিত্যের সবচেয়ে প্রভাবশালী উপন্যাসগুলোর একটি।"),
    para("১৮৮২ সালে প্রকাশিত আনন্দমঠ বহু দশক আগেই পাবলিক ডোমেইনে — মূল বাংলা পিডিএফ এখানে বিনামূল্যে ডাউনলোড করুন।"),
  ]),
  whoShouldRead: "ঐতিহাসিক উপন্যাসের পাঠক; ভারতের স্বাধীনতা আন্দোলনের বৌদ্ধিক শিকড়ে আগ্রহীরা; 'বন্দে মাতরম্' গানের উৎস জানতে চাওয়া পাঠক; বাংলা সাহিত্যের ছাত্রছাত্রী।",
  quotes: [{ text: "বন্দে মাতরম্। সুজলাং সুফলাং মলয়জশীতলাং শস্যশ্যামলাং মাতরম্।" }],
  faqItems: [
    { question: "'বন্দে মাতরম্' গানটি কি এই বইয়ের?", answer: "হ্যাঁ — বঙ্কিমচন্দ্র গানটি আগে লিখলেও এটি প্রথম প্রকাশিত ও বিখ্যাত হয় আনন্দমঠের (১৮৮২) অংশ হিসেবে। পরে এর প্রথম দুই স্তবক ভারতের জাতীয় স্তোত্রের মর্যাদা পায়।" },
    { question: "আনন্দমঠ কোন ঐতিহাসিক ঘটনার ভিত্তিতে লেখা?", answer: "১৭৭০-এর ছিয়াত্তরের মন্বন্তর ও তৎকালীন সন্ন্যাসী-ফকির বিদ্রোহ — বাংলার ইতিহাসের অন্যতম রক্তাক্ত অধ্যায়।" },
  ],
  popular: false,
});

// ---- 4. Reader chapters (real Wikisource proofread text) --------------------
console.log("Chapters:");
const devdasCh1 = chapterFile("devdas_ch1_clean.json");
const devdasCh2 = chapterFile("devdas_ch2_clean.json");
const pariCh1 = chapterFile("parineeta_ch1_clean.json");
const pariCh2 = chapterFile("parineeta_ch2_clean.json");

await ensure(payload, "book-chapters", "devdas-porichchhed-1", {
  title: "প্রথম পরিচ্ছেদ", slug: "devdas-porichchhed-1", book: devdas, chapterNumber: 1,
  body: richParas(devdasCh1), wordCount: devdasCh1.join(" ").split(/\s+/).length,
  publishDate: NOW, _status: "published",
});
await ensure(payload, "book-chapters", "devdas-porichchhed-2", {
  title: "দ্বিতীয় পরিচ্ছেদ", slug: "devdas-porichchhed-2", book: devdas, chapterNumber: 2,
  body: richParas(devdasCh2), wordCount: devdasCh2.join(" ").split(/\s+/).length,
  publishDate: NOW, _status: "published",
});
await ensure(payload, "book-chapters", "parineeta-porichchhed-1", {
  title: "প্রথম পরিচ্ছেদ", slug: "parineeta-porichchhed-1", book: parineeta, chapterNumber: 1,
  body: richParas(pariCh1), wordCount: pariCh1.join(" ").split(/\s+/).length,
  publishDate: NOW, _status: "published",
});
await ensure(payload, "book-chapters", "parineeta-porichchhed-2", {
  title: "দ্বিতীয় পরিচ্ছেদ", slug: "parineeta-porichchhed-2", book: parineeta, chapterNumber: 2,
  body: richParas(pariCh2), wordCount: pariCh2.join(" ").split(/\s+/).length,
  publishDate: NOW, _status: "published",
});

// ---- 5. Blog posts (SEO: real Bengali search queries) ------------------------
console.log("Blog posts:");
await ensure(payload, "blog-posts", "sarat-chandra-sera-uponnash", {
  // Short-form name plus the post's actual thesis. The full "শরৎচন্দ্র
  // চট্টোপাধ্যায়ের" spelling left no room for a hook: name + "সেরা ৫ উপন্যাস"
  // alone is 335px of the ~600px Google renders a desktop result title in, and
  // every version carrying both the full name and the question measured 608px or
  // worse. This one is 548px with the layout's " | বইদ্বীপ", so the question a
  // reader is actually asking survives to the SERP. (It also used to join the two
  // halves with an em-dash, which AGENTS.md forbids in public-facing strings.)
  title: "শরৎচন্দ্রের সেরা ৫ উপন্যাস: কোনটি দিয়ে শুরু করবেন?",
  slug: "sarat-chandra-sera-uponnash",
  summary:
    "দেবদাস, পরিণীতা, শ্রীকান্ত — শরৎচন্দ্রের কোন উপন্যাস দিয়ে পড়া শুরু করবেন? সেরা ৫টি উপন্যাসের তালিকা, কেন পড়বেন, আর কোথায় বিনামূল্যে আইনসিদ্ধ পিডিএফ পাবেন।",
  body: rich([
    para(
      "বাংলা সাহিত্যে 'জনপ্রিয়তা' শব্দটার সমার্থক যদি কেউ হন, তিনি শরৎচন্দ্র চট্টোপাধ্যায়। প্রায় একশো বছর পরেও তাঁর উপন্যাস বাংলা ঘরে ঘরে পঠিত, আর দেবদাস অবলম্বনে সিনেমা হয়েছে ডজনখানেকের বেশি। কিন্তু এতগুলো বইয়ের মধ্যে শুরু করবেন কোনটা দিয়ে? এই লেখায় শরৎচন্দ্রের সেরা ৫টি উপন্যাস বেছে দিলাম — সঙ্গে কেন পড়বেন, কার জন্য কোনটা, আর কোথায় বিনামূল্যে আইনসিদ্ধভাবে পড়া যায়।"
    ),
    heading("১. দেবদাস (১৯১৭) — বাংলা সাহিত্যের সবচেয়ে বিখ্যাত ট্র্যাজেডি"),
    para(
      "দেবদাস-পার্বতী-চন্দ্রমুখীর ত্রিভুজ প্রেমের এই কাহিনি না পড়লে বাংলা উপন্যাসের আলোচনায় ঢোকাই মুশকিল। জমিদারপুত্র দেবদাস আর প্রতিবেশী পার্বতীর শৈশবের ভালোবাসা সামাজিক ব্যবধানের দেয়ালে ভেঙে পড়ে — আর সেই ভাঙন দেবদাসকে টেনে নিয়ে যায় আত্মধ্বংসের পথে। ছোট বই, এক বসায় পড়ে ফেলা যায়, অথচ রেশ থেকে যায় বহুদিন। নতুন পাঠকের জন্য এটাই সেরা শুরু।"
    ),
    heading("২. শ্রীকান্ত (১৯১৭–১৯৩৩) — চার পর্বের আত্মজৈবনিক মহাকাব্য"),
    para(
      "শরৎচন্দ্রের নিজের ভবঘুরে জীবনের ছায়ায় লেখা চার খণ্ডের এই উপন্যাসকে অনেক সমালোচক তাঁর শ্রেষ্ঠ কাজ বলেন। শ্রীকান্তের চোখে আমরা দেখি গ্রামবাংলা থেকে রেঙ্গুন পর্যন্ত বিস্তৃত এক জীবন — আর ইন্দ্রনাথ, রাজলক্ষ্মী, অভয়ার মতো চরিত্র, যারা বাংলা সাহিত্যের চিরস্থায়ী সম্পদ। সময় নিয়ে পড়ার মতো বই।"
    ),
    heading("৩. পরিণীতা (১৯১৪) — ছোট্ট অথচ নিখুঁত প্রেমের উপন্যাস"),
    para(
      "ললিতা আর শেখরের সম্পর্কের এই নভেলা আয়তনে ছোট, কিন্তু আবেগের গভীরতায় বিশাল। সামাজিক মর্যাদা, অর্থ আর অহংকারের বাধা পেরিয়ে ভালোবাসার জয়ের এই গল্প বহুবার চলচ্চিত্রায়িত হয়েছে — ২০০৫ সালের হিন্দি 'পরিণীতা' অনেকেরই দেখা। এক সন্ধ্যায় পড়ে ফেলার মতো বই।"
    ),
    heading("৪. দেনা-পাওনা ও ৫. পথের দাবী"),
    para(
      "জমিদারি শোষণের বিরুদ্ধে ষোড়শীর লড়াই নিয়ে 'দেনা-পাওনা', আর ব্রিটিশবিরোধী বিপ্লবী সব্যসাচীকে নিয়ে 'পথের দাবী' — যেটি ব্রিটিশ সরকার নিষিদ্ধই করে দিয়েছিল। শরৎচন্দ্র যে শুধু প্রেমের গল্পকার নন, সমাজ ও রাজনীতির তীক্ষ্ণ পর্যবেক্ষকও, এই দুটি বই তার প্রমাণ। এ দুটির পিডিএফ আমরা শিগগিরই যুক্ত করব।"
    ),
    heading("বিনামূল্যে কোথায় পড়বেন?"),
    para(
      "শরৎচন্দ্র মারা গেছেন ১৯৩৮ সালে — মৃত্যুর ৬০ বছর পেরিয়ে যাওয়ায় বাংলাদেশ ও ভারত দুই দেশের আইনেই তাঁর সব লেখা এখন পাবলিক ডোমেইন। অর্থাৎ দেবদাস, পরিণীতা, শ্রীকান্তের পিডিএফ ডাউনলোড করা সম্পূর্ণ আইনসিদ্ধ। বইদ্বীপে প্রতিটি বইয়ের পাতায় উইকিসংকলনের প্রুফরিড স্ক্যান থেকে পিডিএফ নামানোর লিংক আর অনলাইনে অধ্যায় ধরে পড়ার ব্যবস্থা — দুটোই পাবেন।"
    ),
  ]),
  relatedBooks: [devdas, parineeta, srikanta],
  publishDate: NOW,
  _status: "published",
});
await ensure(payload, "blog-posts", "bangla-boi-pdf-download-ainshiddho", {
  // "— পুরো গাইড" was 693px and got cut, so the two words it added were never
  // read anyway; the parallel "কোনটা …, কোনটা নয়" construction is the hook and it
  // now fits at 568px. Also drops an em-dash (AGENTS.md, public-facing strings).
  title: "বাংলা বই PDF ডাউনলোড: কোনটা আইনসিদ্ধ, কোনটা নয়",
  slug: "bangla-boi-pdf-download-ainshiddho",
  summary:
    "'বাংলা বই pdf download' লিখে সার্চ করার আগে জেনে নিন কোন বই বিনামূল্যে নামানো বৈধ। পাবলিক ডোমেইন কী, কপিরাইট কতদিন থাকে, আর কোথায় আইনসিদ্ধ বাংলা পিডিএফ পাওয়া যায়।",
  body: rich([
    para(
      "প্রতি মাসে হাজার হাজার মানুষ 'বাংলা বই pdf download' লিখে সার্চ করেন। কিন্তু যে পিডিএফটা নামাচ্ছেন, সেটা বৈধ তো? এই গাইডে সহজ ভাষায় বুঝিয়ে দিচ্ছি কোন বাংলা বই বিনামূল্যে ডাউনলোড করা সম্পূর্ণ আইনসিদ্ধ, কোনটা পাইরেসি, আর নিরাপদ উৎস কোথায়।"
    ),
    heading("পাবলিক ডোমেইন মানে কী?"),
    para(
      "কপিরাইট চিরস্থায়ী নয়। বাংলাদেশের কপিরাইট আইনে লেখকের মৃত্যুর ৬০ বছর পর তাঁর রচনা 'পাবলিক ডোমেইনে' চলে যায় — ভারতের আইনেও তা-ই। পাবলিক ডোমেইনের বই যে কেউ বিনামূল্যে পড়তে, ছাপতে, ডাউনলোড ও বিতরণ করতে পারেন — কোনো অনুমতি লাগে না।"
    ),
    heading("কোন লেখকদের বই এখন ফ্রি?"),
    para(
      "হিসাবটা সহজ: লেখকের মৃত্যুসাল + ৬০। বঙ্কিমচন্দ্র চট্টোপাধ্যায় (মৃত্যু ১৮৯৪), রবীন্দ্রনাথ ঠাকুর (১৯৪১), শরৎচন্দ্র চট্টোপাধ্যায় (১৯৩৮), কাজী নজরুল ইসলামের ক্ষেত্রে (১৯৭৬) — প্রথম তিনজনের সমস্ত রচনা এখন পাবলিক ডোমেইন। অর্থাৎ দেবদাস, আনন্দমঠ, ঘরে-বাইরে, শেষের কবিতা — সবই বৈধভাবে ফ্রি।"
    ),
    heading("কোনটা পাইরেসি?"),
    para(
      "জীবিত বা সদ্যপ্রয়াত লেখকের বই — হুমায়ূন আহমেদ, মুহম্মদ জাফর ইকবাল, সুনীল গঙ্গোপাধ্যায় — এখনো কপিরাইটে আছে। এসব বইয়ের 'ফ্রি পিডিএফ' যে সাইটে পাবেন, সেটা পাইরেসি সাইট: একদিকে লেখক-প্রকাশকের ক্ষতি, অন্যদিকে এসব সাইটে ম্যালওয়্যারের ঝুঁকিও থাকে। কপিরাইটওয়ালা বই কিনে পড়ুন — রকমারি, বইফেরীর মতো সাইটে ঘরে বসেই অর্ডার করা যায়।"
    ),
    heading("আইনসিদ্ধ বাংলা পিডিএফের নির্ভরযোগ্য উৎস"),
    para(
      "উইকিসংকলন (bn.wikisource.org) স্বেচ্ছাসেবীদের প্রুফরিড করা পাবলিক ডোমেইন বাংলা বইয়ের সবচেয়ে বড় ভান্ডার। ইন্টারনেট আর্কাইভেও (archive.org) পুরনো বাংলা বইয়ের স্ক্যান মেলে। আর বইদ্বীপে আমরা এই উৎসগুলো থেকে যাচাই করা পিডিএফ লিংক আর অনলাইন রিডার এক জায়গায় সাজিয়ে দিই — প্রতিটি বইয়ের পাতায় লেখা থাকে সেটি কেন পাবলিক ডোমেইন।"
    ),
  ]),
  relatedBooks: [devdas, ghareBaire, anandamath],
  publishDate: NOW,
  _status: "published",
});

// ---- 6. Curated lists ---------------------------------------------------------
console.log("Lists:");
const noteFor = (t: string) => richParas([t]);
const listSarat = await ensure(payload, "lists", "sarat-chandra-sera-boi", {
  title: "শরৎচন্দ্রের যে ৩টি বই দিয়ে শুরু করবেন",
  slug: "sarat-chandra-sera-boi",
  intro: richParas([
    "অপরাজেয় কথাশিল্পীর বিশাল রচনাসম্ভার থেকে নতুন পাঠকের জন্য বেছে নেওয়া তিনটি বই — ছোট থেকে বড়, সহজ থেকে গভীর ক্রমে সাজানো। তিনটিই পাবলিক ডোমেইন: বিনামূল্যে পিডিএফ নামানো ও অনলাইনে পড়া যায়।",
  ]),
  entries: [
    { book: parineeta, note: noteFor("শুরু করুন এটি দিয়ে — এক সন্ধ্যায় শেষ করার মতো ছোট্ট নভেলা, অথচ ললিতা-শেখরের গল্পের আবেগ ভুলতে পারবেন না।") },
    { book: devdas, note: noteFor("এরপর বাংলা সাহিত্যের সবচেয়ে বিখ্যাত ট্র্যাজেডি — যে বই না পড়লে দেবদাস-পার্বতী-চন্দ্রমুখীর নাম শুধু সিনেমাতেই জানা থাকবে।") },
    { book: srikanta, note: noteFor("শেষে চার পর্বের মহাযাত্রা — শরৎচন্দ্রের নিজের জীবনের ছায়ায় লেখা, সমালোচকদের চোখে তাঁর শ্রেষ্ঠ কীর্তি।") },
  ],
  featured: true,
  publishDate: NOW,
  _status: "published",
});
const listClassic = await ensure(payload, "lists", "classic-bangla-uponnash", {
  title: "ক্লাসিক বাংলা উপন্যাস: যেগুলো একবার হলেও পড়া উচিত",
  slug: "classic-bangla-uponnash",
  intro: richParas([
    "বঙ্কিম থেকে রবীন্দ্রনাথ — বাংলা উপন্যাসের ভিত গড়ে দেওয়া চারটি ধ্রুপদি বই, সবগুলোই এখন পাবলিক ডোমেইনে। প্রতিটির সঙ্গে বলে দেওয়া আছে কেন সেটি আজও পড়া জরুরি।",
  ]),
  entries: [
    { book: anandamath, note: noteFor("'বন্দে মাতরম্‌' যে উপন্যাস থেকে এসেছে — বঙ্কিমের এই ঐতিহাসিক উপন্যাস না পড়লে ভারতীয় উপমহাদেশের ইতিহাসের একটা অধ্যায়ই অসম্পূর্ণ থাকে।") },
    { book: ghareBaire, note: noteFor("স্বদেশি আন্দোলনের পটভূমিতে বিমলা-নিখিলেশ-সন্দীপের ত্রিভুজ — জাতীয়তাবাদ আর ব্যক্তিস্বাধীনতার দ্বন্দ্ব নিয়ে রবীন্দ্রনাথের সবচেয়ে সাহসী উপন্যাস।") },
    { book: sheshKobita, note: noteFor("অমিত-লাবণ্যর বুদ্ধিদীপ্ত প্রেম আর 'কালের যাত্রার ধ্বনি' — বাংলা রোমান্টিক গদ্যের চূড়া, রবীন্দ্রনাথের সবচেয়ে আধুনিক উপন্যাস।") },
    { book: devdas, note: noteFor("ধ্রুপদি তালিকা দেবদাস ছাড়া হয় না — সামাজিক ব্যবধানে ভেঙে যাওয়া প্রেমের এই আখ্যান একশো বছর ধরে পাঠক কাঁদিয়ে চলেছে।") },
  ],
  featured: true,
  publishDate: NOW,
  _status: "published",
});

// ---- 7. Static pages ----------------------------------------------------------
console.log("Pages:");
await ensure(payload, "pages", "about", {
  title: "বইদ্বীপ সম্পর্কে",
  slug: "about",
  _status: "published",
  body: rich([
    para(
      "বইদ্বীপ একটি বাংলা বইয়ের অনলাইন লাইব্রেরি — যেখানে পাবলিক ডোমেইনের ধ্রুপদি বাংলা বই বিনামূল্যে, সম্পূর্ণ আইনসিদ্ধভাবে পড়া ও ডাউনলোড করা যায়।"
    ),
    heading("আমরা কী করি"),
    para(
      "বাংলাদেশ ও ভারতের কপিরাইট আইনে লেখকের মৃত্যুর ৬০ বছর পর তাঁর রচনা পাবলিক ডোমেইনে চলে যায়। বঙ্কিমচন্দ্র, রবীন্দ্রনাথ, শরৎচন্দ্রের মতো মহৎ লেখকদের সেই বইগুলোকে আমরা এক জায়গায় সাজাই: যাচাই করা পিডিএফ ডাউনলোড লিংক (উইকিসংকলন/উইকিমিডিয়া কমন্সের প্রুফরিড স্ক্যান), অনলাইনে অধ্যায় ধরে পড়ার রিডার, লেখক-পরিচিতি, আর কোন বই দিয়ে শুরু করবেন তার কিউরেটেড তালিকা।"
    ),
    heading("যা আমরা করি না"),
    para(
      "কপিরাইটে থাকা কোনো বইয়ের পিডিএফ বইদ্বীপ রাখে না, লিংকও দেয় না। জীবিত বা সদ্যপ্রয়াত লেখকের বইয়ের ক্ষেত্রে আমরা শুধু বৈধ কেনার লিংক দেখাই। প্রতিটি বইয়ের পাতায় স্পষ্ট লেখা থাকে সেটির স্বত্বের অবস্থা এবং কেন সেটি বিনামূল্যে দেওয়া আইনসিদ্ধ।"
    ),
    heading("যোগাযোগ"),
    para(
      "কোনো বইয়ের স্বত্ব নিয়ে আপত্তি, ভুল তথ্য, কিংবা নতুন বই যোগ করার অনুরোধ — যেকোনো প্রয়োজনে যোগাযোগ পাতা থেকে আমাদের লিখুন। আপত্তি পেলে আমরা দ্রুত খতিয়ে দেখে ব্যবস্থা নিই।"
    ),
  ]),
});
await ensure(payload, "pages", "contact", {
  title: "যোগাযোগ",
  slug: "contact",
  _status: "published",
  body: rich([
    para(
      "বইদ্বীপ নিয়ে যেকোনো প্রশ্ন, পরামর্শ বা অভিযোগ আমাদের জানাতে পারেন — আমরা সাধারণত ২–৩ কর্মদিবসের মধ্যে উত্তর দিই।"
    ),
    heading("কী নিয়ে লিখবেন"),
    para(
      "নতুন বই যোগ করার অনুরোধ, বইয়ের তথ্যে ভুল, ভাঙা ডাউনলোড লিংক, কিংবা সাইট ব্যবহারে কোনো সমস্যা — সবকিছুই আমাদের জানানোর মতো বিষয়। কোন বইটি চান আর কেন, লিখে পাঠালে অগ্রাধিকার দিতে সুবিধা হয়।"
    ),
    heading("কপিরাইট বা স্বত্ব-সংক্রান্ত আপত্তি"),
    para(
      "আপনি যদি মনে করেন বইদ্বীপে থাকা কোনো কনটেন্ট আপনার বা আপনার প্রতিষ্ঠানের স্বত্ব লঙ্ঘন করছে, ইমেইলে বইয়ের লিংকসহ বিস্তারিত জানান। আমরা অভিযোগ পাওয়ামাত্র কনটেন্টটি পর্যালোচনা করি এবং যৌক্তিক আপত্তিতে দ্রুত সরিয়ে নিই।"
    ),
    heading("ইমেইল"),
    para("contact@boidwip.com — এই ঠিকানায় সরাসরি লিখুন।"),
  ]),
});
await ensure(payload, "pages", "privacy-policy", {
  title: "গোপনীয়তা নীতি",
  slug: "privacy-policy",
  _status: "published",
  body: rich([
    para(
      "বইদ্বীপ আপনার গোপনীয়তাকে গুরুত্ব দেয়। এই পাতায় সংক্ষেপে বলা আছে আমরা কী তথ্য সংগ্রহ করি, কেন করি, আর কী করি না।"
    ),
    heading("আমরা যা সংগ্রহ করি"),
    para(
      "বইদ্বীপ পড়া বা ডাউনলোডের জন্য কোনো অ্যাকাউন্ট লাগে না — তাই সাধারণ পাঠকের কোনো ব্যক্তিগত তথ্যই আমরা সংগ্রহ করি না। রিভিউ জমা দিলে আপনি যে নাম ও ইমেইল দেন কেবল সেটুকুই সংরক্ষিত হয়; ইমেইল কখনো প্রকাশ করা হয় না।"
    ),
    heading("কুকি ও অ্যানালিটিক্স"),
    para(
      "সাইট চালানোর জন্য অত্যাবশ্যক কুকির বাইরে আমরা ট্র্যাকিং কুকি ব্যবহার করি না। ভবিষ্যতে দর্শক-পরিসংখ্যানের জন্য কোনো অ্যানালিটিক্স যুক্ত হলে তা এই পাতায় জানানো হবে।"
    ),
    heading("তৃতীয় পক্ষের লিংক"),
    para(
      "পিডিএফ ডাউনলোডের লিংক উইকিমিডিয়া কমন্সের মতো তৃতীয় পক্ষের সাইটে নিয়ে যেতে পারে, আর বই কেনার লিংকে অ্যাফিলিয়েট কোড থাকতে পারে — অর্থাৎ সেই লিংক থেকে কিনলে আপনার খরচ না বাড়িয়েই বইদ্বীপ সামান্য কমিশন পেতে পারে। এসব সাইটের নিজস্ব গোপনীয়তা নীতি প্রযোজ্য।"
    ),
    heading("যোগাযোগ"),
    para(
      "গোপনীয়তা-সংক্রান্ত যেকোনো প্রশ্নে contact@boidwip.com ঠিকানায় লিখুন। নীতিতে বড় কোনো পরিবর্তন এলে এই পাতাতেই হালনাগাদ করা হবে।"
    ),
  ]),
});

// ---- 8. Site settings (homepage shelves) ---------------------------------------
console.log("Site settings:");
await payload.updateGlobal({
  slug: "site-settings",
  data: {
    siteName: "বইদ্বীপ",
    tagline: "বাংলা বইয়ের দ্বীপে স্বাগতম",
    siteDescription:
      "বইদ্বীপ — পাবলিক ডোমেইনের ধ্রুপদি বাংলা বই বিনামূল্যে ও আইনসিদ্ধভাবে পড়ুন এবং PDF ডাউনলোড করুন। দেবদাস, শেষের কবিতা, আনন্দমঠসহ বাংলা সাহিত্যের সেরা বইয়ের অনলাইন লাইব্রেরি।",
    homepage: {
      heroBook: devdas,
      featuredLists: [listSarat, listClassic],
      featuredCategories: [catNovel, catClassic, catRomance, catHistorical],
    },
  },
  overrideAccess: true,
  context: { skipRevalidate: true },
});
console.log("  ~ site-settings updated");

console.log("Seed done.");
process.exit(0);

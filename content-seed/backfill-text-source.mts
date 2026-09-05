/** ONE-OFF: back-fill textSourceName / textSourceUrl on the six seeded books.
 *
 *  The migration added the columns; every existing row has them NULL, so the
 *  citation renders on no page until the values are there. The seed file now
 *  carries the same values, but `ensure()` skips a slug that already exists, so
 *  re-seeding would not write them either. Hence this.
 *
 *  `context: { skipRevalidate: true }` on every write. lib/payload/revalidate.ts
 *  POSTs VERCEL_DEPLOY_HOOK_URL on any content change, so six unguarded updates
 *  would fire six production deploys for a back-fill whose whole point is to be
 *  picked up by the NEXT scheduled rebuild.
 *
 *  Run:  node ./node_modules/.bin/tsx content-seed/backfill-text-source.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPayload } from "payload";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same CRLF-safe loader as seed.mts, and optional for the same reason.
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { default: config } = await import("../payload.config");

/** Every URL is the scan's own file page on the project that hosts it, derived
 *  from each book's pdfExternalUrl rather than hand-picked, and each one was
 *  checked for a 200 before being written here. */
const SOURCES: Record<string, { name: string; url: string }> = {
  devdas: {
    name: "বাংলা উইকিসংকলন",
    url: "https://bn.wikisource.org/wiki/%E0%A6%9A%E0%A6%BF%E0%A6%A4%E0%A7%8D%E0%A6%B0:%E0%A6%A6%E0%A7%87%E0%A6%AC%E0%A6%A6%E0%A6%BE%E0%A6%B8_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  },
  parineeta: {
    name: "বাংলা উইকিসংকলন",
    url: "https://bn.wikisource.org/wiki/%E0%A6%9A%E0%A6%BF%E0%A6%A4%E0%A7%8D%E0%A6%B0:%E0%A6%AA%E0%A6%B0%E0%A6%BF%E0%A6%A3%E0%A7%80%E0%A6%A4%E0%A6%BE_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  },
  srikanta: {
    name: "বাংলা উইকিসংকলন",
    url: "https://bn.wikisource.org/wiki/%E0%A6%9A%E0%A6%BF%E0%A6%A4%E0%A7%8D%E0%A6%B0:%E0%A6%B6%E0%A7%8D%E0%A6%B0%E0%A7%80%E0%A6%95%E0%A6%BE%E0%A6%A8%E0%A7%8D%E0%A6%A4_-_%E0%A6%B6%E0%A6%B0%E0%A7%8E%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  },
  "shesher-kobita": {
    name: "উইকিমিডিয়া কমন্স",
    url: "https://commons.wikimedia.org/wiki/File:%E0%A6%B6%E0%A7%87%E0%A6%B7%E0%A7%87%E0%A6%B0_%E0%A6%95%E0%A6%AC%E0%A6%BF%E0%A6%A4%E0%A6%BE_-_%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0.pdf",
  },
  "ghare-baire": {
    name: "উইকিমিডিয়া কমন্স",
    url: "https://commons.wikimedia.org/wiki/File:%E0%A6%98%E0%A6%B0%E0%A7%87-%E0%A6%AC%E0%A6%BE%E0%A6%87%E0%A6%B0%E0%A7%87_-_%E0%A6%B0%E0%A6%AC%E0%A7%80%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%A8%E0%A6%BE%E0%A6%A5_%E0%A6%A0%E0%A6%BE%E0%A6%95%E0%A7%81%E0%A6%B0.pdf",
  },
  anandamath: {
    name: "উইকিমিডিয়া কমন্স",
    url: "https://commons.wikimedia.org/wiki/File:%E0%A6%86%E0%A6%A8%E0%A6%A8%E0%A7%8D%E0%A6%A6_%E0%A6%AE%E0%A6%A0_-_%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%95%E0%A6%BF%E0%A6%AE%E0%A6%9A%E0%A6%A8%E0%A7%8D%E0%A6%A6%E0%A7%8D%E0%A6%B0_%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A7%8B%E0%A6%AA%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC.pdf",
  },
};

const payload = await getPayload({ config });

let written = 0;
let skipped = 0;

for (const [slug, source] of Object.entries(SOURCES)) {
  const found = await payload.find({
    collection: "books",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  if (!doc) {
    console.log(`  ${slug.padEnd(16)} NOT FOUND, skipped`);
    skipped += 1;
    continue;
  }
  if (doc.textSourceName === source.name && doc.textSourceUrl === source.url) {
    console.log(`  ${slug.padEnd(16)} already set, skipped`);
    skipped += 1;
    continue;
  }
  const updated = await payload.update({
    collection: "books",
    id: doc.id,
    data: { textSourceName: source.name, textSourceUrl: source.url },
    context: { skipRevalidate: true },
    overrideAccess: true,
    depth: 0,
  });
  const ok = updated.textSourceName === source.name && updated.textSourceUrl === source.url;
  console.log(
    `  ${slug.padEnd(16)} ${ok ? "written" : "WRITE DID NOT STICK"}  _status=${updated._status}  ${source.name}`,
  );
  written += ok ? 1 : 0;
}

console.log(`\nwritten ${written}, skipped ${skipped}, of ${Object.keys(SOURCES).length}`);
process.exit(0);

import { NextResponse } from "next/server";
import { getRecentBooks } from "@/lib/data";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://boidwip.vercel.app";

// Route handlers are dynamic by default in Next 15+, which for this one would
// mean a Postgres query on every feed reader's request. The feed only changes
// when content is published, and publishing already triggers a fresh deploy
// (lib/payload/revalidate.ts), so it is prerendered at build time like the
// rest of the site.
export const dynamic = "force-static";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const items = await getRecentBooks(50);

  const itemsXml = items
    .map((b) => {
      const url = `${SITE_URL}/book/${b.slug}`;
      const authors = b.authors.map((a) => a.name).join(", ");
      const title = authors ? `${b.title} — ${authors}` : b.title;
      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(b.publishDate).toUTCString()}</pubDate>
      ${b.summary ? `<description>${escapeXml(b.summary)}</description>` : ""}
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_TAGLINE)}</description>
    <language>bn</language>${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE } from "@/lib/og";

// A route handler under app/(frontend) is dynamic by default, which would turn
// a file whose bytes never change into a serverless invocation on every social
// scrape. Same reason rss.xml and ads.txt carry this.
export const dynamic = "force-static";

// Read at module scope, not per call: this is generated once at build time and
// the bytes never vary.
//
// WHY THE PROSE ON THIS CARD IS ENGLISH, on an otherwise entirely Bengali site:
// Satori does not do Bengali OpenType shaping. Isolated consonants and single
// matras are fine, but conjuncts, reph and the two-part ো/ৌ matras all fail, and
// they fail *visibly* rather than silently: বইদ্বীপ renders দ্ব with a floating
// hasanta instead of the conjunct, ডাউনলোড renders ো as a stray ring. To a
// Bengali reader that reads as a broken image, which is worse on the site's main
// share surface than clean English. Do not "fix" this by writing the tagline in
// Bengali and trusting the preview at 1200px wide — crop and magnify it first.
// Real Bengali here needs a renderer that shapes text, which Satori is not.
//
// Subset to exactly the characters this card draws (Google Fonts' `&text=`
// parameter), which is what keeps two weights at ~6KB each against @vercel/og's
// 500KB bundle ceiling. Re-subset if you change a string below, or the new
// characters simply will not be in the file.
const [bengaliRegular, bengaliBold] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/NotoSansBengali-subset-400.ttf")),
  readFile(join(process.cwd(), "assets/fonts/NotoSansBengali-subset-700.ttf")),
]);

/** The fallback social card: what Facebook, WhatsApp and X show for any page
 *  without a cover photo of its own, which is the homepage, every hub page,
 *  the static pages, and any book before its cover is uploaded. Facebook is a
 *  primary channel for this audience, so this is closer to a shopfront than
 *  to metadata.
 *
 *  It is a deliberate restatement of the site's own card treatment rather than
 *  a free-standing design: cool near-white field, white card, the wine accent
 *  rule along the top edge, and the same book-island mark the header carries.
 *  Colours are literal hex because Satori has no access to the CSS custom
 *  properties in globals.css; they track the light-theme tokens and
 *  tailwind.config.ts, and need updating by hand if those move. */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 56,
          backgroundColor: "#F7F8FA",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: 72,
            borderRadius: 28,
            border: "1px solid #DFE3EA",
            backgroundColor: "#FFFFFF",
          }}
        >
          {/* The accent rule: wine into the buy green and the download blue —
              the three colours the whole UI vocabulary is built from
              (accent / buy CTA / free-PDF CTA). */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 10,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundImage: "linear-gradient(90deg, #93233B, #167A3C, #1D56C5)",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {/* The book-island mark, rebuilt out of positioned divs.

                It is inline SVG everywhere else (components/SiteMark.tsx,
                public/icon.svg), but Satori does not render an inline <svg>
                child — it would have to come in through an <img src="data:...">,
                and everything here is expressible as border-radius boxes that
                Satori supports natively. The geometry is icon.svg's 64-unit
                grid multiplied by 116/64 (≈1.8125): sun at (32,26) r9, sand
                arc under the book, the open book's two leaves splitting at the
                spine. Keep them in step with icon.svg. */}
            <div
              style={{
                position: "relative",
                display: "flex",
                width: 116,
                height: 116,
                borderRadius: 26,
                backgroundImage:
                  "linear-gradient(135deg, #A82A46 0%, #93233B 55%, #7A1B30 100%)",
              }}
            >
              {/* The sun: cx 32 cy 26 r 9 → left (32-9)*1.8125, top (26-9)*1.8125. */}
              <div
                style={{
                  position: "absolute",
                  left: 41.7,
                  top: 30.8,
                  width: 32.6,
                  height: 32.6,
                  borderRadius: 999,
                  backgroundColor: "#F6C453",
                }}
              />
              {/* The island: the sand arc under the book. */}
              <div
                style={{
                  position: "absolute",
                  left: 27.2,
                  top: 62,
                  width: 61.6,
                  height: 16,
                  borderRadius: 999,
                  backgroundColor: "#F1E7D8",
                }}
              />
              {/* The open book: two leaves splitting at the spine (x=32). */}
              <div
                style={{
                  position: "absolute",
                  left: 27.2,
                  top: 68,
                  width: 30.5,
                  height: 27,
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 10,
                  backgroundColor: "#FFFDF8",
                  transform: "skewY(-6deg)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 58.3,
                  top: 68,
                  width: 30.5,
                  height: 27,
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 10,
                  backgroundColor: "#F6EFE3",
                  transform: "skewY(6deg)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 84,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#141A22",
              }}
            >
              Boidwip
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 40,
              fontSize: 46,
              fontWeight: 700,
              lineHeight: 1.35,
              color: "#141A22",
            }}
          >
            Free Bengali Book PDFs, Reviews &amp; Online Reading
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 30,
              fontWeight: 400,
              color: "#5A6472",
            }}
          >
            Public Domain Classics · Read Online · Buy Links
          </div>
        </div>
      </div>
    ),
    {
      width: OG_IMAGE.width,
      height: OG_IMAGE.height,
      fonts: [
        { name: "Noto Sans Bengali", data: bengaliRegular, weight: 400, style: "normal" },
        { name: "Noto Sans Bengali", data: bengaliBold, weight: 700, style: "normal" },
      ],
    }
  );
}

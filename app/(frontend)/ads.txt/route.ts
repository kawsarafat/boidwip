import { NextResponse } from "next/server";
import { adsenseClient } from "@/lib/ads";

// Required by Google once you're running AdSense — without a correct
// ads.txt at the domain root, ad revenue can be blocked even after
// approval. Generated from the same env var as everything else so there's
// only one place to update: NEXT_PUBLIC_ADSENSE_CLIENT ("ca-pub-xxxx...").
//
// Route handlers are dynamic by default in Next 15+, which would put a
// serverless invocation behind a file whose contents are fixed at build
// time. Prerendered instead, like the rest of the site.
export const dynamic = "force-static";

export async function GET() {
  // Shape-validated, not read raw: a malformed publisher id would produce a
  // syntactically valid ads.txt naming a seller account that does not exist,
  // and crawlers treat that as an authorisation record rather than as a typo.
  const client = adsenseClient();

  if (!client) {
    // 404, NOT an empty 200, and the difference is money. An ads.txt that
    // parses to zero records is not "no file" to a crawler — it is a publisher
    // asserting that NO seller is authorised to sell this domain's inventory,
    // and programmatic buyers are required to drop bids on an unauthorised
    // domain. The previous empty 200 therefore said something strictly worse
    // than saying nothing, for as long as AdSense was unconfigured. A 404 is
    // the documented "this publisher has no ads.txt" state and is what every
    // crawler already expects from a site that has not set one up.
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pubId = client.replace("ca-pub-", "pub-");
  const body = `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;

  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

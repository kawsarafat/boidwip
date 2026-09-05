import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Book, Page } from "@/payload-types";
import { makeRichTextRenderer, toBookContent, toStaticPage } from "@/lib/render";
import { buyUrl } from "@/lib/affiliate";
import BookArticle from "@/components/BookArticle";
import { StaticPageArticle } from "@/components/StaticPageBody";

/** Draft preview. Renders one Book or Page — including an unpublished one —
 *  through the same components and the same sanitizer the live site uses.
 *
 *  Request-time by necessity: the authorisation check is the admin session
 *  cookie the browser already holds, which cannot exist at build time. This is
 *  the ONLY route outside /admin and /api that is legitimately `ƒ` in the build
 *  output.
 *
 *  Three separate things stop this from becoming a hole that leaks drafts:
 *
 *   1. payload.auth() on the incoming cookies. No session, no document — not
 *      even a 404 that would confirm an id exists. The unauthenticated response
 *      is identical whether or not the document is real.
 *   2. overrideAccess: false plus the resolved user, so the collection's own
 *      `access.read` runs. Access control is not reimplemented here; a change to
 *      collections/*.ts applies to preview automatically.
 *   3. PREVIEWABLE as an allowlist, not a denylist. `collection` arrives from a
 *      query string, and Payload will happily findByID on `users` if handed the
 *      slug. A new collection is not previewable until someone adds it here on
 *      purpose. */

export const dynamic = "force-dynamic";

/** Only content collections, and only ones with a component that can render
 *  them. Never add `users` or `media`. */
const PREVIEWABLE = ["books", "pages"] as const;
type PreviewableCollection = (typeof PREVIEWABLE)[number];

function isPreviewable(value: string | undefined): value is PreviewableCollection {
  return typeof value === "string" && (PREVIEWABLE as readonly string[]).includes(value);
}

/** Query params arrive as `string | string[] | undefined`; a repeated param
 *  (?id=1&id=2) becomes an array, which would otherwise reach Payload as one. */
function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="shell max-w-3xl py-16 text-center">{children}</div>;
}

function NotSignedIn() {
  return (
    <Shell>
      <h1 className="text-2xl font-extrabold text-ink">প্রিভিউ দেখতে লগইন করুন</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
        এই পাতাটি শুধু অ্যাডমিন প্যানেলে লগইন করা অবস্থায় দেখা যায়। লগইন করে আবার এই লিংকে আসুন।
      </p>
      <Link href="/admin" className="btn-secondary mt-6">
        অ্যাডমিন প্যানেলে যান
      </Link>
    </Shell>
  );
}

function Banner({
  status,
  liveHref,
}: {
  status: string | undefined;
  liveHref: string | null;
}) {
  const isPublished = status === "published";
  return (
    <div className="border-b-2 border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
        <p className="font-semibold text-amber-900 dark:text-amber-200">
          প্রিভিউ, সর্বশেষ সেভ করা অবস্থা
          {isPublished ? " (প্রকাশিত)" : " (খসড়া, এখনো সাইটে নেই)"}
        </p>
        <div className="flex items-center gap-4">
          {/* Only when the document is actually live. Offering the link for a
              draft would point at a URL that 404s, which reads as a bug in the
              preview rather than as "not published yet". */}
          {isPublished && liveHref && (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-900 underline dark:text-amber-200"
            >
              লাইভ পাতা দেখুন
            </a>
          )}
          <span className="text-amber-800 dark:text-amber-300/80">
            নতুন পরিবর্তন দেখতে আগে Save করুন, তারপর এই ট্যাব রিফ্রেশ করুন
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const collection = single(params.collection);
  const rawId = single(params.id);

  if (!isPreviewable(collection) || !rawId) notFound();

  // Postgres ids are numeric, and everything arriving over HTTP is a string.
  // Number("") is 0 rather than NaN, so the emptiness check has to be its own
  // condition.
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) return <NotSignedIn />;

  // findByID throws (not returns null) on both "no such document" and "access
  // denied", and deliberately does not distinguish them. Treating every failure
  // as a 404 keeps it that way.
  let doc: Book | Page;
  try {
    doc = (await payload.findByID({
      collection,
      id,
      // The whole point: read the newest version even if it was never published.
      draft: true,
      depth: 1,
      overrideAccess: false,
      user,
    })) as Book | Page;
  } catch {
    notFound();
  }

  const toHtml = await makeRichTextRenderer(payload);
  const status = (doc as { _status?: string })._status;

  if (collection === "pages") {
    const page = doc as Page;
    return (
      <>
        <Banner status={status} liveHref={page.slug ? `/${page.slug}` : null} />
        <StaticPageArticle page={await toStaticPage(page, toHtml)} showBreadcrumb={false} />
      </>
    );
  }

  const book = await toBookContent(doc as Book, toHtml);

  return (
    <>
      <Banner status={status} liveHref={book.slug ? `/book/${book.slug}` : null} />
      <div className="shell max-w-4xl py-8">
        {/* showAds off: no impression on a page no reader visited.
            linkEntities off: a draft's author/category pages may not exist yet.
            shareUrl null: nothing to share on a page that is not public. */}
        <BookArticle
          book={book}
          buyHref={buyUrl(book.rokomariUrl)}
          showAds={false}
          shareUrl={null}
          linkEntities={false}
        />
      </div>
    </>
  );
}

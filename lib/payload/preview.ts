import type { CollectionConfig } from "payload";

type GeneratePreviewURL = NonNullable<CollectionConfig["admin"]>["preview"];

/** URL Payload's "Preview" button points at, for any collection that has one.
 *
 *  It carries ONLY the document id and collection slug — deliberately, and
 *  this is the whole security design of the preview feature:
 *
 *   - No token in the URL. Payload can hand a preview URL a short-lived JWT
 *     (`{ token }` in the second argument) so an unauthenticated front-end can
 *     call back and fetch the draft. That pattern exists for decoupled setups
 *     where the site and the CMS are separate deployments. Here they are the
 *     same Next app, so the preview route can simply read the admin session
 *     cookie the browser already sends. A token in a URL ends up in browser
 *     history, in the Referer header of anything the previewed page links to,
 *     and in whatever chat app the editor pastes the link into. Not needing
 *     one is strictly better than handling one carefully.
 *
 *   - No slug or subject in the URL. The route resolves the document by id and
 *     reads the CURRENT draft values, so a preview link stays correct after
 *     the slug is edited, and there is no second copy of the
 *     subject-plus-slug URL-building rule to drift out of step with
 *     app/(frontend).
 *
 *  The route itself (app/(preview)/preview/page.tsx) re-authenticates and
 *  re-checks collection access. Nothing produced here is treated as
 *  authorisation.
 *
 *  Written as a factory rather than reading `req.collection` because that
 *  property is not guaranteed to be populated on the request Payload builds
 *  when it generates a preview URL, and a wrong-collection fallback would
 *  silently preview the wrong document. */
export function previewUrl(collection: string): GeneratePreviewURL {
  return (doc, { req }) => {
    if (!doc?.id) return null;
    const base = (req.payload.config.serverURL ?? "").replace(/\/$/, "");
    return `${base}/preview?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(
      String(doc.id)
    )}`;
  };
}

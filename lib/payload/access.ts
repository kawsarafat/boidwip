import type { Access, FieldAccess, PayloadRequest } from "payload";

/** Shared access rules, so every collection can state all four operations
 *  explicitly without four collections re-deriving the same one-liner.
 *
 *  WHY THIS EXISTS AT ALL, given that Payload already denies unauthenticated
 *  writes by default: because "the default is safe" and "the file says what
 *  the rule is" are different properties, and only the second one survives
 *  contact with a future edit. Payload exposes REST at /api for every
 *  collection, which means an access block is a live control on a public
 *  surface, not documentation. A collection that lists `read` and omits the
 *  rest reads, to the next person, as if writes had been considered and left
 *  open — and it gives no anchor for a comment explaining why. AGENTS.md
 *  asks for every collection to set `access` explicitly; four of the five
 *  were only setting `read`. */

/** Any logged-in user. There is exactly one role on this site (`Users` has no
 *  role field and no public sign-up), so "authenticated" and "administrator"
 *  are the same set of people. If a lower-privileged editor role is ever
 *  added, this is the single function to split. */
export const authenticated: Access = ({ req }) => Boolean(req.user);

/** Readable by anyone, but drafts only by a logged-in user.
 *
 *  The returned WHERE clause is the important half: it is not "hide the draft
 *  in the UI", it is a query constraint Payload merges into every read,
 *  including a hand-crafted `GET /api/chapters?limit=100`. Without it an
 *  unpublished chapter is enumerable over HTTP by anyone who guesses the
 *  collection name.
 *
 *  The build does not go through this path — it reads the Local API, which
 *  bypasses access control entirely, and filters on `_status` itself in
 *  lib/data.ts. */
export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;
  return { _status: { equals: "published" } };
};

/** Public read for collections with no draft state to protect. Written as a
 *  named export rather than an inline `() => true` so the intent is legible
 *  in the collection file: this is a considered "yes", not a missing rule. */
export const publicRead: Access = () => true;

/** Field-level read gate: the field is returned to a logged-in user and
 *  OMITTED from every other read, including a hand-crafted
 *  `GET /api/books?limit=100`.
 *
 *  WHY A FIELD-LEVEL RULE IS THE ONLY THING THAT WORKS HERE. `admin.condition`
 *  hides a field in the editing UI and nothing more — the value is still in the
 *  document and still in the REST response. Collection-level `read` is the
 *  wrong granularity too: books MUST be publicly readable, so the document is
 *  going out either way. Only `field.access.read` removes a single field from
 *  the payload while leaving the rest of the document public.
 *
 *  Used on the legal/audit-trail fields of collections/Books.ts — permission
 *  evidence (the rights holder's name, their email text, the signed document),
 *  who signed the book off, and the takedown state. None of it is content; all
 *  of it is either a third party's personal data or a description of this
 *  site's legal position, and it was previously served to anyone who asked
 *  /api/books for a published book. */
export const authenticatedFieldRead: FieldAccess = ({ req }) => Boolean(req.user);

/** Who may load /admin at all.
 *
 *  Behaviourally identical to `authenticated`, but it cannot BE `authenticated`:
 *  Payload types the `admin` operation as returning strictly boolean, while
 *  `Access` is allowed to return a WHERE clause. There is no query to constrain
 *  when the question is "does this person get the panel", so the narrower
 *  signature is correct — and assigning an `Access` there is a type error rather
 *  than something that silently works. */
export const canAccessAdmin = ({ req }: { req: PayloadRequest }): boolean =>
  Boolean(req.user);

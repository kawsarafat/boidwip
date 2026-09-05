import type { CollectionConfig } from "payload";
import { authenticated, canAccessAdmin } from "../lib/payload/access";
import { enforceEmailDelivery } from "../lib/payload/email";
import { enforceTurnstileGate, turnstileGateEndpoint } from "../lib/payload/loginTurnstile";

/** Admin accounts. This is what replaces Decap's GitHub OAuth flow — and
 *  with it the requirement that every editor hold write access to the
 *  GitHub repository, which was a far broader grant than "can edit
 *  chapters" ever needed to be.
 *
 *  Access is locked down explicitly rather than left to defaults. On a CMS,
 *  a publicly creatable user collection is a critical hole: anyone could
 *  register themselves and edit the site. Payload's "create first user"
 *  screen still works while the collection is empty, so the initial account
 *  can be made even though `create` requires authentication. */
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    // 2 hours. Short enough that a forgotten session on a shared or
    // borrowed machine expires on its own, long enough not to interrupt a
    // real writing session.
    tokenExpiration: 60 * 60 * 2,

    // Throttles password guessing: five wrong attempts locks the account
    // for ten minutes. Without this, the login endpoint is an unlimited
    // brute-force oracle.
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,

    cookies: {
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
    },

    forgotPassword: {
      // 30 minutes, down from Payload's default hour. A reset link sitting in an
      // inbox IS a credential for this account: anyone holding it can set a new
      // password without knowing the old one, and it survives in mail history,
      // in a phone's notification shade, and in whatever else syncs that mailbox.
      // Half an hour is far more than the minute it takes to click a link and
      // type a password, and it shortens the window in which a forwarded or
      // shoulder-surfed message is still worth anything.
      expiration: 30 * 60 * 1000,
      // Payload's default subject is a bare translated "Reset your password",
      // which from a personal Gmail address (see lib/payload/email.ts — that is
      // the transport this starts on) is indistinguishable from the phishing mail
      // it is imitating. Naming the system is what tells the recipient the
      // message is expected. English, like the rest of the admin chrome.
      //
      // The BODY is deliberately left to Payload. Overriding it means building
      // the reset URL by hand out of serverURL + the admin route + the reset
      // route + the token, and getting any of those wrong produces a
      // well-branded email with a dead link — a worse failure than a plain one,
      // and invisible until somebody actually needs a reset.
      generateEmailSubject: () => "Reset your Boidwip admin password",
    },
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["name", "email", "updatedAt"],
    group: "Access",
    description:
      "Everyone who can log in and edit the site. There are no roles yet, so every account here can publish, unpublish and delete anything — invite accordingly. You cannot delete your own account, which is what stops the last login being removed.",
  },
  access: {
    // No public sign-up, no public listing of who has an account.
    create: authenticated,
    read: authenticated,
    update: authenticated,
    // Clearing a lockout is an authenticated action, not a public one:
    // otherwise the ten-minute lockTime above could be reset on demand,
    // which turns the brute-force throttle back into an unlimited oracle.
    unlock: authenticated,
    // Who may load /admin at all. Payload defaults this to "any user of the
    // auth collection", which is the same set as `authenticated` today. It is
    // stated so that adding a non-admin role later is a change in one obvious
    // place rather than a silently inherited default. Separate function because
    // this operation must answer strictly boolean — see lib/payload/access.ts.
    admin: canAccessAdmin,
    // Guards against locking yourself out of the CMS entirely by deleting
    // the last remaining account.
    delete: ({ req, id }) => {
      if (!req.user) return false;
      return req.user.id !== id;
    },
  },
  // The public token-for-cookie exchange that backs the login challenge. Lives
  // on this collection so it inherits the already-dynamic /api/[...slug] route
  // rather than adding a serverless function, the same reasoning as the comment
  // submit and AI endpoints.
  endpoints: [turnstileGateEndpoint],
  // Rejects a login that did not first pass Turnstile, before the password is
  // even checked. No-op when Turnstile is unconfigured. See
  // lib/payload/loginTurnstile.ts.
  //
  // enforceEmailDelivery is the same mechanism aimed at forgot-password: with no
  // SMTP transport configured, Payload's console adapter would swallow the reset
  // mail and still report success, so the operation is refused with a message
  // that says why instead of minting a token nobody can receive. See
  // lib/payload/email.ts.
  hooks: {
    beforeOperation: [enforceTurnstileGate, enforceEmailDelivery],
  },
  fields: [
    // `email` and `password` are added automatically by `auth: true`.
    {
      name: "name",
      type: "text",
      required: true,
      admin: {
        description: "Display name, used for the byline on chapters you write.",
      },
    },
  ],
};

export default Users;

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { APIError } from "payload";
import type { CollectionBeforeOperationHook } from "payload";
import type { Endpoint, PayloadRequest } from "payload";
import { isLoginTurnstileConfigured, verifyLoginTurnstile } from "../turnstile";
import { clientIpFrom, hashIp } from "../net/clientIp";
import { readJsonBody } from "../net/readJsonBody";
import { KV_KEYS, kvBumpWindow, kvPut, kvTake } from "./kv";

/** Turnstile on the admin login, in the shape that fits Payload's own login
 *  form without replacing it.
 *
 *  THE PROBLEM
 *
 *  A challenge only protects login if the token reaches the server during the
 *  login request. Payload ships its own `<LoginForm>`; it posts `{email,
 *  password}` and nothing else, and there is no supported seam to add a field to
 *  that submission. Replacing the whole login view to inject one is exactly the
 *  version-coupled fragility AGENTS.md warns against.
 *
 *  THE SHAPE THAT WORKS
 *
 *  Decouple the check from the form with a one-time gate cookie:
 *
 *    1. `components/payload/auth/LoginTurnstile.tsx` renders the widget in the
 *       `beforeLogin` slot. On success it POSTs the token to the endpoint below.
 *    2. `turnstileGateEndpoint` verifies the token with Cloudflare server-side
 *       and, only then, sets a short-lived signed httpOnly cookie.
 *    3. `enforceTurnstileGate` runs as a `beforeOperation` hook on the login
 *       operation — BEFORE the password is even checked — and rejects the login
 *       unless that cookie is present and its signature and expiry verify.
 *
 *  A script POSTing straight to `/api/users/login` never passed the widget, so
 *  it has no valid cookie and is refused. The cookie is signed with
 *  PAYLOAD_SECRET, so it cannot be forged.
 *
 *  ONE SOLVE, ONE LOGIN ATTEMPT
 *
 *  The signature and expiry alone made the cookie a five-minute BEARER TOKEN:
 *  one solved challenge bought unlimited attempts until it expired, which is
 *  most of what a password-spraying script wants from a login form. "The token
 *  that earned it is spent at Cloudflare on first verify" was true and beside
 *  the point — the cookie, not the token, is what the second attempt presents.
 *
 *  So the cookie now carries a random NONCE that is recorded server-side when it
 *  is issued and CONSUMED when it is presented:
 *
 *    - `kvPut` records `bdw:gate:<nonce>` with the same five-minute expiry.
 *    - `kvTake` is a `DELETE … RETURNING`, so exactly one caller can redeem a
 *      given nonce; the second attempt with the same cookie finds nothing and is
 *      refused. Two simultaneous attempts cannot both win it either, which a
 *      read-then-delete pair would allow (see ./kv.ts).
 *    - The nonce is consumed BEFORE the password is checked and outside the
 *      login transaction, so a failed login spends it just the same. A gate that
 *      only closed behind successful logins would protect nothing.
 *    - The same hook clears the cookie on the way out, on both the success and
 *      the failure response, so a spent cookie does not linger in the browser.
 *
 *  One consequence is deliberate and has to be handled in the UI: a mistyped
 *  password now needs a fresh challenge, because the first attempt spent the
 *  one it had. `components/payload/auth/LoginTurnstile.tsx` re-arms the widget as
 *  soon as the login request settles, so the retry has a new cookie waiting
 *  before the administrator has finished re-reading the error.
 *
 *  RATE LIMITING, WHICH IS NOT THE SAME GUARANTEE
 *
 *  Payload's own `maxLoginAttempts` locks a USER out after N bad passwords. It
 *  does nothing about one address working through a list of addresses, and it
 *  cannot, because it counts per account. `enforceTurnstileGate` therefore also
 *  bumps an atomic per-IP window on every login attempt — before the credentials
 *  are read, and whether or not Turnstile is configured at all, since an install
 *  with no Turnstile keys is precisely the one with nothing else in front of the
 *  password field.
 *
 *  DEGRADATION AND THE LOCKOUT GUARD
 *
 *  The gate is active only when BOTH halves of the login key pair are set (see
 *  isLoginTurnstileConfigured). Requiring the public key too is deliberate: if
 *  only the secret were set the hook would demand a cookie the widget — which
 *  needs the public key to render — could never produce, and every admin would
 *  be locked out staring at "complete the verification challenge" with no
 *  challenge on screen. So a half-configuration disables the gate rather than
 *  bricking login. With neither set, login works exactly as before, matching the
 *  widget, which renders nothing without its public key.
 *
 *  The login pair is SEPARATE from the comment widget's pair (with a fallback to
 *  it) because a Turnstile site key has one dashboard-chosen widget mode and
 *  login wants a visible Managed checkbox while comments want an invisible one.
 *  Unlike the public comment form this fails CLOSED on a Cloudflare outage: an
 *  admin login is not a moderated queue, so a challenge that cannot be verified
 *  must block rather than wave the request through. The escape hatch if
 *  Turnstile itself misbehaves is to unset TURNSTILE_LOGIN_SECRET_KEY (and
 *  TURNSTILE_SECRET_KEY) — the gate disables with no code redeploy. */

const GATE_COOKIE = "bdw-ts-gate";
/** How long an unredeemed challenge stays good. Long enough to type a password,
 *  short enough that a stolen cookie is near-worthless — and it is single-use
 *  now, so this is a ceiling on how long an UNUSED one survives, not on how many
 *  attempts it buys. */
const GATE_TTL_MS = 5 * 60 * 1000;

/** Per-IP ceiling on login ATTEMPTS. Ten in ten minutes is far more than a
 *  person who knows their password needs and far less than a spray is worth;
 *  Payload's per-user `maxLoginAttempts` is the other half of this and counts a
 *  different thing (see header). */
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

/** Per-IP ceiling on gate exchanges — the Cloudflare verify call. Deliberately
 *  above LOGIN_MAX_ATTEMPTS: every login attempt now needs its own solve, plus
 *  the ones Turnstile itself refreshes on expiry, so a limit at or below the
 *  login limit would lock an administrator out of retrying. */
const GATE_WINDOW_MS = 10 * 60 * 1000;
const GATE_MAX_EXCHANGES = 30;

/** A Turnstile token is ~2 KB. Anything an order of magnitude past that is not
 *  a token, and this endpoint is unauthenticated. */
const MAX_GATE_BODY_BYTES = 8 * 1024;

function secret(): string {
  // PAYLOAD_SECRET is required at boot (payload.config.ts), so this is set
  // wherever the app actually runs. Falling back to "" would make every gate
  // cookie forgeable, so treat its absence as a hard failure instead.
  const value = process.env.PAYLOAD_SECRET;
  if (!value) throw new Error("PAYLOAD_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

type GateTicket = {
  /** The cookie value: "<expiry-ms>.<nonce>.<hmac>", all cookie-safe. */
  value: string;
  /** The half that is recorded server-side and redeemed once. */
  nonce: string;
};

/** Mints a ticket. The nonce is 128 bits of `randomBytes` — it has to be
 *  unguessable on its own, because presenting a valid nonce is what redeems the
 *  challenge; the HMAC around it only proves this server issued THIS pair, and
 *  saves a database round trip on obvious junk. */
function issueGateTicket(): GateTicket {
  const expiry = Date.now() + GATE_TTL_MS;
  const nonce = randomBytes(16).toString("hex");
  const body = `${expiry}.${nonce}`;
  return { value: `${body}.${sign(body)}`, nonce };
}

function gateCookieHeader(value: string, maxAgeSec: number): string {
  const parts = [
    `${GATE_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

function readCookie(cookieHeader: string | null, name: string): string {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

/** The nonce out of a cookie that is unexpired and carries a signature we
 *  produced, or "" for anything else. Constant-time comparison so a caller
 *  cannot probe the HMAC one byte at a time.
 *
 *  Returning the nonce rather than a boolean is the point: "the cookie is
 *  well-formed" is no longer the same question as "the cookie may be used", and
 *  only the caller's `kvTake` can answer the second one. */
function verifiedNonce(cookieHeader: string | null): string {
  const raw = readCookie(cookieHeader, GATE_COOKIE);
  if (!raw) return "";
  const parts = raw.split(".");
  if (parts.length !== 3) return "";
  const [expiryText, nonce, providedSig] = parts;

  const expiry = Number(expiryText);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return "";
  // Shape-checked before it is used as a database key.
  if (!/^[0-9a-f]{32}$/.test(nonce)) return "";

  const a = Buffer.from(providedSig, "hex");
  const b = Buffer.from(sign(`${expiryText}.${nonce}`), "hex");
  if (a.length !== b.length || a.length === 0) return "";
  return timingSafeEqual(a, b) ? nonce : "";
}

function json(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(extraHeaders ?? {}) },
  });
}

/** POST /api/users/turnstile-gate — exchanges a fresh Turnstile token for a
 *  single-use gate cookie. Public on purpose: the caller is not logged in yet,
 *  and all it can do is prove it solved a challenge. Rate limited anyway,
 *  because each call spends a Cloudflare verification. */
export const turnstileGateEndpoint: Endpoint = {
  path: "/turnstile-gate",
  method: "post",
  handler: async (req: PayloadRequest) => {
    if (!isLoginTurnstileConfigured()) {
      // Nothing to gate; tell the client so it stops waiting.
      return json({ ok: true, skipped: true }, 200);
    }

    const ip = clientIpFrom(req.headers);
    const ipHash = hashIp(ip);
    if (ipHash) {
      const gateWindow = await kvBumpWindow(
        req.payload,
        KV_KEYS.rate("login-gate", ipHash),
        GATE_WINDOW_MS,
        GATE_MAX_EXCHANGES,
      );
      if (gateWindow.limited) {
        return json({ ok: false }, 429, {
          "Retry-After": String(gateWindow.retryAfterSeconds),
        });
      }
    }

    // Size-capped before parsing: an unauthenticated POST should not get to
    // choose how many bytes the server parses (see lib/net/readJsonBody.ts).
    const parsed = await readJsonBody(req, MAX_GATE_BODY_BYTES);
    if (!parsed.ok) {
      return json({ ok: false }, parsed.reason === "too-large" ? 413 : 400);
    }
    const token = (parsed.value as { token?: unknown } | null)?.token;

    const result = await verifyLoginTurnstile(
      typeof token === "string" ? token : undefined,
      ip || undefined,
    );
    if (!result.ok) {
      return json({ ok: false }, 403);
    }

    // Recorded BEFORE the cookie is handed out, so a cookie can never exist
    // whose nonce was never registered — that pair would be indistinguishable
    // from an already-redeemed one and would read as a mysterious 403.
    const ticket = issueGateTicket();
    await kvPut(req.payload, KV_KEYS.loginNonce(ticket.nonce), { issuedAt: Date.now() }, GATE_TTL_MS);

    return json({ ok: true }, 200, {
      "Set-Cookie": gateCookieHeader(ticket.value, Math.floor(GATE_TTL_MS / 1000)),
    });
  },
};

/** Queues a `Set-Cookie` on the response Payload is about to send.
 *
 *  `req.responseHeaders` is merged into the login response on BOTH paths —
 *  payload/dist/utilities/handleEndpoints.js line 201 for a success,
 *  payload/dist/utilities/routeError.js line 88 for a thrown APIError — and
 *  merged with `append`, so this rides alongside the session cookie the login
 *  handler sets rather than replacing it. The admin login form POSTs to the REST
 *  endpoint (`@payloadcms/next` LoginForm passes `action: /api/users/login`), so
 *  that is the same path the browser takes. */
function queueCookie(req: PayloadRequest, cookie: string): void {
  const headers = req.responseHeaders ?? new Headers();
  headers.append("Set-Cookie", cookie);
  req.responseHeaders = headers;
}

/** Atomic per-IP window on login attempts. Skipped only when there is no
 *  address to key on (a direct local request). */
async function limitLoginAttempts(req: PayloadRequest): Promise<void> {
  const ipHash = hashIp(clientIpFrom(req.headers));
  if (!ipHash) return;

  const attempts = await kvBumpWindow(
    req.payload,
    KV_KEYS.rate("login", ipHash),
    LOGIN_WINDOW_MS,
    LOGIN_MAX_ATTEMPTS,
  );
  if (!attempts.limited) return;

  const minutes = Math.max(1, Math.ceil(attempts.retryAfterSeconds / 60));
  throw new APIError(
    `Too many login attempts from this address. Try again in ${minutes} minute${
      minutes === 1 ? "" : "s"
    }.`,
    429,
    undefined,
    true, // isPublic: the person locked out is usually the administrator
  );
}

/** beforeOperation gate for the login operation. Registered on the Users
 *  collection. Runs before credentials are checked, so a bot cannot use the
 *  login endpoint as an unlimited password oracle even for one round trip. */
export const enforceTurnstileGate: CollectionBeforeOperationHook = async ({ operation, req }) => {
  if (operation !== "login") return;

  // First, and unconditionally: an install with no Turnstile keys is exactly
  // the one where this is the only thing in front of the password field.
  await limitLoginAttempts(req);

  if (!isLoginTurnstileConfigured()) return; // feature disabled / half-configured — see header

  // Whatever the credentials turn out to be, this cookie is finished. Queued
  // before the redemption below so it is cleared on the 403 too.
  queueCookie(req, gateCookieHeader("", 0));

  const nonce = verifiedNonce(req.headers.get("cookie"));
  // `kvTake` is the redemption: a DELETE … RETURNING, outside the login
  // transaction, so the nonce is spent even when the password is wrong and the
  // transaction rolls back.
  const redeemed = nonce ? await kvTake(req.payload, KV_KEYS.loginNonce(nonce)) : null;
  if (!redeemed) {
    throw new APIError(
      "Please complete the verification challenge and try again.",
      403,
      undefined,
      true // isPublic: surfaced on the login screen, not just the server log
    );
  }
};

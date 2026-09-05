/** Cloudflare Turnstile, server side.
 *
 *  Follows the same "unset means disabled" contract as every other optional
 *  integration in this project (R2 in payload.config.ts, AdSense in AdSlot.tsx,
 *  the AI provider in lib/ai/provider.ts): with no TURNSTILE_SECRET_KEY the
 *  verifier returns success and the protected feature runs unchallenged rather
 *  than breaking. The public site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY) gates the
 *  widget in the browser the same way; the pair is set together or not at all.
 *
 *  Server-only on purpose. The secret must never reach the browser — that is why
 *  it is not NEXT_PUBLIC_ and nothing under components/ or app/(frontend) may
 *  import this file. */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Short by design. siteverify is a single hop to Cloudflare; a slow answer is
 *  itself a signal the network is unhealthy, and the fail-open branch below is a
 *  safer place to end up than a public form hanging for the platform's full
 *  request timeout. */
const VERIFY_TIMEOUT_MS = 5_000;

/** True when a secret is configured. The client widget keys off the separate
 *  NEXT_PUBLIC_ site key; this is the server half, used to decide whether a
 *  missing token is an error or an expected no-op. */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/** The login challenge is a SEPARATE key pair from the comment widget, because
 *  a Turnstile site key carries one widget mode (Managed / Non-interactive /
 *  Invisible), chosen in the Cloudflare dashboard — and the two uses want
 *  different modes (comments invisible, login a visible Managed checkbox). One
 *  key cannot be both, so login gets its own pair. Each half falls back to the
 *  shared comment key so a single-key install keeps working unchanged. */
export function loginTurnstileSecret(): string | undefined {
  return process.env.TURNSTILE_LOGIN_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY;
}

/** The public login site key, read server-side (NEXT_PUBLIC_ vars are also on
 *  process.env in the Node runtime). */
export function loginTurnstileSiteKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_TURNSTILE_LOGIN_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

/** The login gate is active only when BOTH halves of the login pair are set.
 *  Requiring the site key too is a LOCKOUT GUARD: with only the secret set, the
 *  server would demand a gate cookie that the widget — which needs the public
 *  key to render — can never produce, and every admin would be locked out with
 *  no challenge on screen. The escape hatch if Turnstile itself misbehaves is to
 *  unset TURNSTILE_LOGIN_SECRET_KEY (and TURNSTILE_SECRET_KEY): the gate then
 *  disables and the stock login returns, no redeploy of code required. */
export function isLoginTurnstileConfigured(): boolean {
  return Boolean(loginTurnstileSecret()) && Boolean(loginTurnstileSiteKey());
}

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: string };

/** Verifies one Turnstile token against Cloudflare.
 *
 *  Outcomes:
 *   - No secret set        -> { ok: true, skipped: true }.  Feature runs
 *     unprotected, matching the project-wide optional-integration rule.
 *   - Token missing/invalid -> { ok: false }.  This is the real gate.
 *   - Cloudflare unreachable or slow -> depends on `opts.failClosed`:
 *       default (comments)   -> { ok: true, skipped: true } (fail OPEN).
 *       failClosed (login)   -> { ok: false, reason: "network" }.
 *
 *  Failing open on a network error is a deliberate, scoped decision for public
 *  comment submission: every comment is held for manual approval before it
 *  appears, so a Cloudflare outage should not also take down the ability to
 *  leave a comment when a human still reviews each one, and the DB rate limit —
 *  which does not depend on Cloudflare — remains the volume ceiling in that
 *  window. The login gate (verifyLoginTurnstile) passes failClosed because it is
 *  not a moderated queue. An invalid token is a different thing from an
 *  unreachable verifier and is always rejected either way.
 *
 *  `opts.secret` overrides which secret is used, so the login pair can verify
 *  against its own key rather than the comment key. */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
  opts?: { secret?: string; failClosed?: boolean }
): Promise<TurnstileResult> {
  const secret = opts?.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success) return { ok: true, skipped: false };
    return { ok: false, reason: (data["error-codes"] ?? ["verification-failed"]).join(",") };
  } catch {
    // Network error / timeout. Comments fail OPEN (the default) because a human
    // moderates every one; the login gate passes failClosed:true because an
    // admin login is not a moderated queue and an unverifiable challenge must
    // block rather than wave the request through.
    return opts?.failClosed ? { ok: false, reason: "network" } : { ok: true, skipped: true };
  } finally {
    clearTimeout(timeout);
  }
}

/** Login-side verify: uses the login secret and fails CLOSED on a network
 *  error. See isLoginTurnstileConfigured for why login has its own key pair. */
export async function verifyLoginTurnstile(
  token: string | undefined | null,
  remoteIp?: string
): Promise<TurnstileResult> {
  return verifyTurnstile(token, remoteIp, { secret: loginTurnstileSecret(), failClosed: true });
}

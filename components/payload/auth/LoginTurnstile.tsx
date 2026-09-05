"use client";

import { useCallback, useEffect, useState } from "react";
import Turnstile, { isLoginTurnstileEnabled, loginSiteKey } from "../../Turnstile";

/** Turnstile widget for the admin login screen, rendered in Payload's
 *  `beforeLogin` component slot (registered in payload.config.ts).
 *
 *  It does NOT feed a token into Payload's login form — there is no seam for
 *  that. Instead, on a passed challenge it POSTs the token to
 *  `/api/users/turnstile-gate`, which verifies it server-side and sets the
 *  short-lived signed cookie that `enforceTurnstileGate` then requires on the
 *  login operation. See lib/payload/loginTurnstile.ts for the whole shape.
 *
 *  Renders nothing when the public key is unset, exactly like the widget on the
 *  public comment form, so an unconfigured install shows the stock login page.
 *
 *  ONE SOLVE PER ATTEMPT, HENCE THE RE-ARM
 *
 *  The gate cookie is single-use: the server redeems its nonce before checking
 *  the password, so the challenge solved for one attempt is spent whether that
 *  attempt succeeded or not. Without a re-arm, a mistyped password would leave
 *  the administrator staring at a solved checkbox that the server no longer
 *  accepts, and the only way out would be a page reload.
 *
 *  So this watches for the login request finishing and resets the widget when it
 *  does. Resource timing is the signal because it is the only one that is both
 *  precise and non-invasive: Payload's own `<Form>` owns the submit, and there is
 *  no callback to subscribe to from a `beforeLogin` slot. A `resource` entry is
 *  recorded at `responseEnd`, which is AFTER the browser has applied that
 *  response's `Set-Cookie` — so the fresh cookie is always written after the
 *  server's clearing one, never before it. A timer would be a guess about that
 *  ordering.
 *
 *  THE "unavailable" STATE IS THE IMPORTANT ONE. Once both login keys are set,
 *  `enforceTurnstileGate` refuses every login without the gate cookie, and the
 *  only thing that can mint that cookie is a solved challenge. So a widget that
 *  fails to DRAW is a hard lockout, and it used to be a silent one: the login
 *  screen showed a blank gap where the checkbox belongs and then answered
 *  "complete the verification challenge" for a challenge that was never there.
 *  `Turnstile`'s `onError` reports that case (script blocked, Cloudflare error,
 *  or nothing rendered inside its timeout) and this names the fix on screen,
 *  because the person reading it is the administrator who can apply it.
 *
 *  It reports; it does not unlock. The server gate stays enforced — a
 *  client-side "the widget broke" claim is trivially forgeable, so treating it
 *  as permission to skip the check would hand every scripted login the same
 *  excuse. The documented escape hatch is an environment change.
 *
 *  Admin chrome, so the copy is English (see AGENTS.md). */

type GateState = "idle" | "checking" | "ready" | "error" | "unavailable";

/** Payload's login route, which the admin form POSTs to. Matched on the path
 *  suffix rather than the whole URL so a non-default `routes.api` still hits. */
const LOGIN_PATH_SUFFIX = "/users/login";

export default function LoginTurnstile() {
  const [state, setState] = useState<GateState>("idle");
  const [resetKey, setResetKey] = useState(0);

  const onVerify = useCallback((token: string | null) => {
    if (!token) {
      // Expiry or reset. Never downgrade a reported widget failure back to
      // idle: "asking again will not help" outranks "waiting for an answer".
      setState((prev) => (prev === "unavailable" ? prev : "idle"));
      return;
    }
    setState("checking");
    fetch("/api/users/turnstile-gate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setState(res.ok ? "ready" : "error"))
      .catch(() => setState("error"));
  }, []);

  const onWidgetError = useCallback(() => setState("unavailable"), []);

  // Re-arm once per login attempt (see header). Bumping `resetKey` makes
  // Turnstile reset, which calls back with null and starts a fresh challenge.
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          let path = entry.name || "";
          try {
            path = new URL(path, window.location.origin).pathname;
          } catch {
            // Not a URL we can parse; the suffix test below just fails.
          }
          if (path.endsWith(LOGIN_PATH_SUFFIX)) {
            setResetKey((previous) => previous + 1);
            return;
          }
        }
      });
      // Not `buffered`: only attempts made while this widget is mounted matter,
      // and a replayed entry from a previous visit would reset for nothing.
      observer.observe({ type: "resource" });
    } catch {
      // Resource timing unavailable. The gate still works; a failed login then
      // needs the page reload the error copy already recommends.
    }
    return () => observer?.disconnect();
  }, []);

  if (!isLoginTurnstileEnabled()) return null;

  return (
    <div style={{ marginBottom: "var(--base, 1rem)" }}>
      {/* "always" keeps the checkbox visible; login is the one place a visible,
          deliberate challenge is wanted rather than the invisible comment mode.
          Uses the login site key, which may be a different Cloudflare widget
          mode (Managed) than the comment key (Invisible). */}
      <Turnstile
        onVerify={onVerify}
        onError={onWidgetError}
        appearance="always"
        action="login"
        siteKey={loginSiteKey()}
        resetKey={resetKey}
      />
      {/* A spinner alone is not progress (AGENTS.md): say it in text too. */}
      {state === "checking" && (
        <p style={{ fontSize: "0.8rem", opacity: 0.75, marginTop: "0.5rem" }}>
          Verifying…
        </p>
      )}
      {state === "error" && (
        <p style={{ fontSize: "0.8rem", color: "var(--bdw-danger, #b91c1c)", marginTop: "0.5rem" }}>
          Verification failed. Reload the page and try again.
        </p>
      )}
      {state === "unavailable" && (
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--bdw-danger, #b91c1c)",
            marginTop: "0.5rem",
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            The verification challenge could not load, so login is blocked.
          </p>
          <p style={{ margin: "0.35rem 0 0" }}>
            Usual causes: this hostname is not in the widget&rsquo;s Domains list in the
            Cloudflare Turnstile dashboard, the challenge frame is blocked by a browser
            extension or network filter, or Cloudflare returned error 300030. Check the
            browser console for the exact reason.
          </p>
          <p style={{ margin: "0.35rem 0 0" }}>
            To get back in without a code change, unset TURNSTILE_LOGIN_SECRET_KEY (and
            TURNSTILE_SECRET_KEY) in the hosting environment and redeploy. That disables
            the gate and restores the stock login.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

/** Cloudflare Turnstile widget, client side.
 *
 *  The server half is lib/turnstile.ts. Both key off separate env vars set as a
 *  pair: NEXT_PUBLIC_TURNSTILE_SITE_KEY here, TURNSTILE_SECRET_KEY on the server.
 *  With the site key unset this renders nothing and the surrounding form works
 *  unprotected — the same "invisible until configured" contract as AdSlot and
 *  the old Cusdis widget. The server enforces the real check; a missing widget
 *  is not a way to bypass it, because when the secret IS set the server rejects
 *  a submission with no token regardless of what the browser rendered.
 *
 *  Explicit render (not the auto-scan `.cf-turnstile` mode) because the callback
 *  that hands back the token has to reach React state, and a global function
 *  name is the wrong tool for that when more than one widget can exist. */

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      appearance?: "always" | "execute" | "interaction-only";
      theme?: "auto" | "light" | "dark";
      action?: string;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** How long to wait for the widget to actually DRAW before calling it broken.
 *
 *  `turnstile.render()` returning a widget id does not mean there is a challenge
 *  on screen. It creates a hidden input and an iframe; when the iframe never
 *  arrives — a sitekey whose Cloudflare "Domains" list omits this host, a blocked
 *  cross-origin frame, an extension, or Cloudflare's own error 300030 ("Turnstile
 *  Widget seem to have hung") — the container stays zero-height and every
 *  callback stays silent. There is no error event for that case, which is why it
 *  has to be a timeout: without one the login screen shows an empty gap and the
 *  server still demands the token the widget was supposed to mint. Ten seconds is
 *  well past a normal cold render on a slow connection. */
const RENDER_TIMEOUT_MS = 10_000;

/** Loads the Turnstile script exactly once per page, shared by every instance.
 *  Cached so a page with more than one widget does not inject the tag twice. */
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("turnstile-server"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const settle = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("turnstile-missing-after-load"));

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", settle);
      existing.addEventListener("error", () => reject(new Error("turnstile-load-failed")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", settle);
    script.addEventListener("error", () => reject(new Error("turnstile-load-failed")));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileProps = {
  /** Called with the token on success, and with null when it expires, errors,
   *  or is reset. The parent gates its submit on a non-null token only when a
   *  site key is configured. */
  onVerify: (token: string | null) => void;
  /** Called once when the widget cannot present a challenge at all: the script
   *  was blocked, Cloudflare reported an error, or `render()` succeeded but drew
   *  nothing within RENDER_TIMEOUT_MS.
   *
   *  Distinct from `onVerify(null)` on purpose. An expired token means "ask
   *  again"; this means "asking again will not help", and the two want different
   *  copy. It matters most on the admin login, where the server refuses every
   *  login without a token, so a widget that silently fails to draw is a lockout
   *  with an empty gap where the explanation should be. The comment form ignores
   *  it, because an unprotected comment still reaches the moderation queue. */
  onError?: (reason: string) => void;
  /** "interaction-only" is the closest thing to invisible: the challenge shows
   *  only if Cloudflare decides the visitor needs to prove themselves. */
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "auto" | "light" | "dark";
  action?: string;
  /** Increment to reset the widget (after a successful submit, so the next
   *  comment gets a fresh token rather than reusing a spent one). */
  resetKey?: number;
  /** Override the site key. The comment widget uses the default
   *  NEXT_PUBLIC_TURNSTILE_SITE_KEY; the login widget passes the login key
   *  (see loginSiteKey) so the two can be different Cloudflare widget modes. */
  siteKey?: string;
  className?: string;
};

export default function Turnstile({
  onVerify,
  onError,
  appearance = "interaction-only",
  theme = "auto",
  action,
  resetKey = 0,
  siteKey: siteKeyProp,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Held in refs so the render effect below does not re-run (and re-render the
  // widget) every time the parent passes a new onVerify closure.
  //
  // Assigned in an effect rather than during render. Writing `ref.current` in
  // the render body is what this used to do, and it is a real violation rather
  // than a lint preference: a render can be thrown away or replayed (Strict
  // Mode does exactly that), so a mutation there is a side effect on a path
  // React does not promise to run once. The effect fires after every commit
  // with no dependency array, so the refs are up to date before any callback
  // the widget can reach — the widget only exists after the effect below has
  // run, and a user cannot solve a challenge inside one commit.
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
  });

  const siteKey = siteKeyProp || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;
    // At most one error report per mount. A hung widget can trip the timeout
    // and then also fire error-callback, and the parent should not have to
    // dedupe that itself.
    let reported = false;
    const fail = (reason: string) => {
      if (cancelled || reported) return;
      reported = true;
      onErrorRef.current?.(reason);
    };
    let drawTimer: ReturnType<typeof setTimeout> | undefined;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current || widgetIdRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          appearance,
          theme,
          action,
          callback: (token) => {
            // A drawn-and-solved widget cannot also be a broken one.
            if (drawTimer) clearTimeout(drawTimer);
            reported = true;
            onVerifyRef.current(token);
          },
          "expired-callback": () => onVerifyRef.current(null),
          "error-callback": () => {
            onVerifyRef.current(null);
            fail("widget-error");
          },
        });
        // "execute" defers the challenge until it is invoked, so an absent
        // iframe is expected there and the check would be a false alarm.
        if (appearance === "execute") return;
        drawTimer = setTimeout(() => {
          if (cancelled) return;
          if (!containerRef.current?.querySelector("iframe")) fail("widget-not-drawn");
        }, RENDER_TIMEOUT_MS);
      })
      .catch(() => {
        // Script blocked or failed to load. Nothing to render; the server
        // decides what an absent token means (rejected if the secret is set,
        // ignored if it is not).
        fail("script-blocked");
      });

    return () => {
      cancelled = true;
      if (drawTimer) clearTimeout(drawTimer);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already gone (fast unmount / navigation). Nothing to do.
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, appearance, theme, action]);

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onVerifyRef.current(null);
    }
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className={className} />;
}

/** True when the public site key is present, so a form can decide whether to
 *  wait for a token before enabling submit. Reads the same NEXT_PUBLIC_ var the
 *  widget does; safe in the browser. */
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** The public site key for the ADMIN LOGIN widget. A separate key from the
 *  comment widget because a Turnstile key has one dashboard-chosen widget mode
 *  and login wants a visible Managed challenge while comments want invisible.
 *  Falls back to the shared comment key so a single-key install still works.
 *  Both refs are literal so Next inlines them into the client bundle. */
export function loginSiteKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_TURNSTILE_LOGIN_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

/** True when a login site key (dedicated or shared) is present. */
export function isLoginTurnstileEnabled(): boolean {
  return Boolean(loginSiteKey());
}

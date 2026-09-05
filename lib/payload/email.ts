import { APIError } from "payload";
import type { CollectionBeforeOperationHook } from "payload";

/** Outbound email, which on this site exists for exactly one reason: the admin
 *  forgot-password flow.
 *
 *  WHY THIS FILE EXISTS AT ALL
 *
 *  Payload's forgot-password operation is always mounted, and with no email
 *  adapter configured Payload falls back to `consoleEmailAdapter`, which logs
 *  "Email attempted without being configured" and RESOLVES SUCCESSFULLY. So the
 *  reset screen showed its confirmation message, the operation returned 200, the
 *  reset token was written to the user row, and the only copy of the link went to
 *  a server log nobody reads. An admin locked out of the panel waits for mail
 *  that was never sent, with nothing anywhere saying why. That is the failure
 *  this module closes: either real SMTP credentials exist and the mail is
 *  genuinely sent, or the operation is refused with a message that says so.
 *
 *  THREE PROVIDERS, ONE PRECEDENCE RULE
 *
 *  `SMTP_*` (generic) beats `BREVO_*` beats `GMAIL_*`. Most specific intent wins:
 *  someone who typed a host name knows which server they mean.
 *
 *  Gmail with an App Password is the zero-setup option: no signup, no domain
 *  verification, and it works from a personal account. Its ceiling is low though
 *  (roughly 500 messages a day, and Google will challenge a burst), so Brevo is
 *  the intended destination once volume or deliverability matters.
 *
 *  Any two may be configured at once, which is the whole point — it makes a
 *  migration a matter of adding variables rather than swapping them in one atomic
 *  edit and hoping. Remove the losing pair whenever it suits; nothing here needs
 *  it.
 *
 *  WHY THE GENERIC `SMTP_*` BRANCH EXISTS, because the Gmail branch looks like it
 *  should already cover "an address I own". It does not, and the failure is
 *  actively misleading. `GMAIL_*` hardcodes `host: "smtp.gmail.com"`, and Gmail's
 *  SMTP authenticates against a GOOGLE ACCOUNT — so `GMAIL_USER` has to be a
 *  `@gmail.com` address, or a Google Workspace address on a domain Google
 *  actually hosts. Point it at a mailbox from a registrar, cPanel, Zoho,
 *  Hostinger or anywhere else and Google answers
 *
 *      535-5.7.8 Username and Password not accepted ... BadCredentials
 *
 *  which reads exactly like a wrong App Password and sends people to regenerate a
 *  password that was never the problem. The credential was right; the SERVER was
 *  wrong. Before this branch existed there was nowhere to put the correct one
 *  short of signing up for Brevo. `warnIfSuspectGmailUser` below names that case
 *  explicitly at boot rather than leaving it to the 535.
 *
 *  DEGRADATION, AND THE ONE THING THAT MUST NEVER HAPPEN
 *
 *  Same contract as every other optional integration in this project (R2,
 *  Turnstile, the AI keys): a boolean derived from the environment, no
 *  `requireEnv`, and the feature switches itself off rather than crashing the
 *  boot. The thing to be careful about is specific to this adapter:
 *  `nodemailerAdapter()` called with no transport — or with args that carry
 *  neither `transport` nor `transportOptions` — reaches out to ethereal.email,
 *  CREATES A TEST ACCOUNT OVER THE NETWORK, and console-logs its credentials.
 *  Mail then goes to a fake inbox and every send still reports success, which is
 *  the console-adapter trap again with a network dependency bolted on. So
 *  `emailAdapter()` below returns `undefined` without touching the package
 *  unless a real transport was resolved, and `payload.config.ts` passes that
 *  straight through.
 *
 *  RELATIVE IMPORTS: reached from payload.config.ts, which the Payload CLI loads
 *  outside Next's bundler. nodemailer is pulled in lazily (dynamic import inside
 *  the async factory) so `payload migrate` and `generate:types` never load it. */

type MailProvider = "brevo" | "gmail" | "smtp";

type ResolvedMailer = {
  provider: MailProvider;
  defaultFromAddress: string;
  defaultFromName: string;
  transportOptions: {
    auth: { pass: string; user: string };
    host: string;
    port: number;
    requireTLS?: boolean;
    secure: boolean;
  };
};

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Google shows an App Password as four groups of four ("abcd efgh ijkl mnop")
 *  and people paste it exactly as shown. SMTP AUTH does not ignore those spaces,
 *  so the unstripped value fails with a bare "Username and Password not
 *  accepted" that reads exactly like a wrong password. Stripping all whitespace
 *  is safe: an App Password is sixteen lowercase letters and nothing else. */
function stripSpaces(value: string): string {
  return value.replace(/\s+/g, "");
}

/** Resolved once. The environment cannot change under a running process, and
 *  memoizing keeps the forgot-password guard free to call this per request. */
let cached: ResolvedMailer | null | undefined;

function resolveMailer(): ResolvedMailer | null {
  if (cached !== undefined) return cached;
  cached = computeMailer();
  return cached;
}

/** Gmail's SMTP authenticates against a Google account, so `GMAIL_USER` must be
 *  an address Google actually hosts. Anything else fails with a 535 that names
 *  the password rather than the mismatch, so say the real thing once at boot.
 *  A heuristic on purpose: Workspace domains are indistinguishable from any
 *  other domain from here, so this warns rather than refusing — a genuine
 *  Workspace user should ignore it. */
function warnIfSuspectGmailUser(user: string): void {
  const domain = user.split("@")[1]?.toLowerCase();
  if (!domain || domain === "gmail.com" || domain === "googlemail.com") return;
  console.warn(
    `[email] GMAIL_USER is "@${domain}", which is not a Gmail address. ` +
      "smtp.gmail.com only accepts a @gmail.com account or a Google Workspace " +
      "address on a domain Google hosts; anything else fails with " +
      '"535-5.7.8 Username and Password not accepted", which looks like a wrong ' +
      "App Password but is not. If this is not a Workspace domain, use the " +
      "SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / EMAIL_FROM_ADDRESS " +
      "variables with your mail provider's own server instead."
  );
}

function computeMailer(): ResolvedMailer | null {
  const fromName = env("EMAIL_FROM_NAME") || "বইদ্বীপ";

  // Generic SMTP first: an explicit host is the most specific statement of
  // intent, and it is the only branch that can reach a mailbox on a domain
  // Google and Brevo do not host. Covers Zoho, cPanel/registrar mail,
  // Hostinger, Mailgun, Postmark, SES — anything speaking SMTP.
  const smtpHost = env("SMTP_HOST");
  const smtpUser = env("SMTP_USER");
  // Whitespace-stripped for the same reason as the Gmail App Password below:
  // provider dashboards render long keys in groups, and people paste what they
  // see. A password containing a literal space is not a thing worth supporting
  // at the price of that failure.
  const smtpPass = stripSpaces(env("SMTP_PASSWORD"));
  // Required here, and it must be a sender the server will accept. Unlike Gmail
  // there is no account address to infer: SMTP_USER is often not a mailbox at
  // all (Mailgun and SES issue an identifier), so guessing would produce a 550
  // visible only in the log. Missing it makes the block count as unconfigured
  // and fall through, rather than becoming a silently broken upgrade.
  const smtpFrom = env("EMAIL_FROM_ADDRESS");
  if (smtpHost && smtpUser && smtpPass && smtpFrom) {
    // 465 means implicit TLS, anything else means STARTTLS. SMTP_SECURE
    // overrides for the rare server that disagrees. Getting this pair wrong
    // hangs the handshake rather than erroring, which is why it is derived
    // from the port instead of defaulted to one value.
    const port = Number(env("SMTP_PORT")) || 587;
    const secureRaw = env("SMTP_SECURE").toLowerCase();
    const secure = secureRaw ? secureRaw === "true" || secureRaw === "1" : port === 465;
    return {
      provider: "smtp",
      defaultFromAddress: smtpFrom,
      defaultFromName: fromName,
      transportOptions: {
        host: smtpHost,
        port,
        secure,
        // On a STARTTLS port, make the upgrade mandatory rather than
        // opportunistic, so a server that declines it fails instead of sending
        // the password in clear.
        ...(secure ? {} : { requireTLS: true }),
        auth: { user: smtpUser, pass: smtpPass },
      },
    };
  }

  // Brevo next: when it and Gmail are both configured this is the one that runs.
  const brevoUser = env("BREVO_SMTP_USER");
  const brevoKey = env("BREVO_SMTP_KEY");
  // Brevo's SMTP login is an issued identifier like `9a1b2c001@smtp-brevo.com`,
  // NOT a mailbox you may send as, so unlike Gmail there is no address to infer
  // and EMAIL_FROM_ADDRESS is mandatory here. Without it Brevo answers the
  // RCPT with a 550 "sender not valid" that surfaces only in the server log, so
  // an incomplete Brevo block is treated as not configured and falls through to
  // Gmail rather than becoming a silently broken upgrade.
  const brevoFrom = env("EMAIL_FROM_ADDRESS");
  if (brevoUser && brevoKey && brevoFrom) {
    return {
      provider: "brevo",
      defaultFromAddress: brevoFrom,
      defaultFromName: fromName,
      transportOptions: {
        host: "smtp-relay.brevo.com",
        // 587 with STARTTLS is Brevo's documented default. `requireTLS` makes
        // the upgrade mandatory instead of opportunistic, so a relay that
        // declines STARTTLS fails rather than sending the password in clear.
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: brevoUser, pass: brevoKey },
      },
    };
  }

  const gmailUser = env("GMAIL_USER");
  const gmailPass = stripSpaces(env("GMAIL_APP_PASSWORD"));
  if (gmailUser && gmailPass) {
    warnIfSuspectGmailUser(gmailUser);
    return {
      provider: "gmail",
      // Always the authenticated account, and EMAIL_FROM_ADDRESS is ignored on
      // this path on purpose. Gmail refuses to send as an address the account
      // does not own or have confirmed as an alias (a 553), so honouring an
      // override here would turn one env var into a broken sender for anyone
      // who set it while planning ahead for Brevo.
      defaultFromAddress: gmailUser,
      defaultFromName: fromName,
      transportOptions: {
        host: "smtp.gmail.com",
        // Implicit TLS on 465. Gmail supports 587/STARTTLS too, but 465 is one
        // fewer negotiation step to fail on a restrictive network.
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
      },
    };
  }

  return null;
}

/** Whether outbound mail can actually leave the building. Read by the
 *  forgot-password guard below, so the two can never disagree about it. */
export function isEmailConfigured(): boolean {
  return resolveMailer() !== null;
}

/** Which provider is live, for a status line in the admin. `null` when none. */
export function emailProvider(): MailProvider | null {
  return resolveMailer()?.provider ?? null;
}

async function buildAdapter(mailer: ResolvedMailer) {
  const { nodemailerAdapter } = await import("@payloadcms/email-nodemailer");
  return nodemailerAdapter({
    defaultFromAddress: mailer.defaultFromAddress,
    defaultFromName: mailer.defaultFromName,
    transportOptions: mailer.transportOptions,
    // The adapter's boot-time `transport.verify()` opens an SMTP connection and
    // authenticates before anything is sent. In development that is exactly what
    // you want while first pasting an App Password in: a wrong one prints
    // "Error verifying Nodemailer transport" immediately instead of at 2am when
    // somebody needs a reset. In production it is pure cost — a handshake on
    // every cold start, once per serverless instance — and it buys nothing,
    // because the adapter only console.errors the result and sends anyway.
    skipVerify: process.env.NODE_ENV === "production",
  });
}

/** The value for `email:` in payload.config.ts.
 *
 *  `undefined` when unconfigured, which leaves Payload on its console adapter —
 *  harmless, because the guard below refuses the only operation that would have
 *  sent anything. Returns the adapter as an unawaited promise, which
 *  `Config.email` accepts (`EmailAdapter | Promise<EmailAdapter>`), so the
 *  config stays synchronous and no top-level await appears in a file the Payload
 *  CLI has to load. */
export function emailAdapter() {
  const mailer = resolveMailer();
  if (!mailer) return undefined;
  return buildAdapter(mailer);
}

/** beforeOperation guard on the forgot-password operation. Registered on the
 *  Users collection alongside the Turnstile login gate.
 *
 *  This is what makes "reset works only if email is configured" true rather than
 *  aspirational. It runs before the user lookup and before any token is minted,
 *  so an unconfigured install neither writes a `resetPasswordToken` it cannot
 *  deliver nor tells the caller the mail is on its way.
 *
 *  `isPublic: true` because this one genuinely has to reach the screen: it is
 *  addressed to the admin standing in front of the login page, not to a stranger
 *  probing the endpoint, and it names the fix. It leaks only that this site has
 *  no mail transport, which is not a secret worth keeping at the price of an
 *  unexplained failure. Deliberately says nothing about whether the address
 *  exists — the operation's own silent-success-on-unknown-email behaviour is an
 *  account-enumeration defence and this must not undo it. */
export const enforceEmailDelivery: CollectionBeforeOperationHook = async ({ operation }) => {
  if (operation !== "forgotPassword") return;
  if (isEmailConfigured()) return;
  throw new APIError(
    "Password reset is unavailable: this site has no email delivery configured. Set the SMTP, Brevo or Gmail variables from .env.example, or ask another administrator to reset your password.",
    503,
    undefined,
    true
  );
};

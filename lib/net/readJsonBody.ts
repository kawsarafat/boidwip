/** Read a JSON request body with a HARD BYTE CEILING, enforced while reading.
 *
 *  THE PROBLEM WITH `await req.json()`. It buffers the entire body into memory
 *  before anything gets a chance to look at it, so the first opportunity to
 *  reject an oversized request comes after it has already been paid for. On the
 *  one unauthenticated write on this site (POST /api/reviews/submit) that is a
 *  free amplification: the endpoint's own validation caps the review text at
 *  4,000 characters, but a 40 MB body reaches that check having already been
 *  parsed, and `JSON.parse` on 40 MB of nested arrays costs far more than the
 *  request cost to send. The audit's item was "limit request body size before
 *  JSON parsing", and the emphasis is on BEFORE.
 *
 *  WHY NOT JUST TRUST `content-length`. It is a claim by the client. A chunked
 *  request has no `content-length` at all, and a lying one is trivial to send.
 *  The header is checked first because it lets an obvious oversize be refused
 *  without reading a byte, but the stream is then counted as it arrives and
 *  abandoned the moment it crosses the limit — so the ceiling holds whatever
 *  the header said.
 *
 *  Bytes, not characters: `chunk.byteLength` is what was actually transferred,
 *  and Bengali text is 3 bytes per character in UTF-8. A limit expressed in
 *  characters would silently be three times looser for the language this site
 *  is written in. */

/** Big enough for the longest review the form accepts (4,000 characters of
 *  Bengali ≈ 12 KB) plus a Turnstile token (~2 KB), name, email and JSON
 *  framing, with room to spare. Small enough that a request at the limit is
 *  not worth sending. */
export const MAX_JSON_BODY_BYTES = 32 * 1024;

export type JsonBodyResult =
  | { ok: true; value: unknown }
  /** `too-large` maps to 413, `invalid` to 400 — the caller decides the
   *  wording, this only says which happened. */
  | { ok: false; reason: "too-large" | "invalid" };

/** A minimal view of what this needs from a request. Written as a structural
 *  type rather than importing `PayloadRequest` so the same helper serves a
 *  Payload endpoint, a Next route handler and a test that passes a plain
 *  `Request`. */
type BodyBearing = {
  headers: { get(name: string): string | null };
  body?: ReadableStream<Uint8Array> | null;
  bodyUsed?: boolean;
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
};

/** Returned instead of a string when the cap was crossed mid-read. */
const TOO_LARGE = Symbol("too-large");

export async function readJsonBody(
  req: BodyBearing,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<JsonBodyResult> {
  // Cheap rejection first: an honest oversized request is refused before the
  // body is touched at all.
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: "too-large" };
  }

  const stream = streamOf(req);
  if (stream) {
    let text: string | typeof TOO_LARGE;
    try {
      text = await readCappedText(stream, maxBytes);
    } catch {
      // A read that fails partway (client abort, malformed chunked framing) is
      // not a body that can be validated, and the caller's 400 is the honest
      // answer — a thrown error here would surface as a 500 instead.
      return { ok: false, reason: "invalid" };
    }
    if (text === TOO_LARGE) return { ok: false, reason: "too-large" };
    return parseJson(text);
  }

  // NO READABLE STREAM. Either the runtime buffered the body before the handler
  // ran, or something upstream has already consumed it. The bytes are spent
  // either way, so the cap becomes after-the-fact rather than absent — still
  // worth applying, because what it then stops is the oversized value being
  // carried any further into validation, the database and the logs.
  if (typeof req.text === "function") {
    const text = await req.text();
    return byteLength(text) > maxBytes
      ? { ok: false, reason: "too-large" }
      : parseJson(text);
  }

  if (typeof req.json === "function") {
    let value: unknown;
    try {
      value = await req.json();
    } catch {
      return { ok: false, reason: "invalid" };
    }
    if (value === undefined || value === null) return { ok: true, value: {} };
    if (byteLength(JSON.stringify(value) ?? "") > maxBytes) {
      return { ok: false, reason: "too-large" };
    }
    return { ok: true, value };
  }

  // A request with no body at all: valid, and empty.
  return { ok: true, value: {} };
}

/** The request's body stream, or null when there is nothing safe to read from
 *  it. `locked`/`bodyUsed` matter because a second `getReader()` throws: if
 *  anything upstream has already touched the body, the buffered path is the
 *  only one left. */
function streamOf(req: BodyBearing): ReadableStream<Uint8Array> | null {
  if (req.bodyUsed) return null;
  const stream = req.body;
  if (!stream || typeof stream.getReader !== "function") return null;
  return stream.locked ? null : stream;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

/** An empty body is a valid request with no fields — the endpoint's own
 *  validation is what reports which ones are missing, in the reader's
 *  language. Only malformed JSON is an error here. */
function parseJson(text: string): JsonBodyResult {
  if (!text.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/** The whole body as text, or `TOO_LARGE` as soon as the running total crosses
 *  the cap — at which point the reader is cancelled and the remainder is never
 *  buffered, decoded or parsed. */
async function readCappedText(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<string | typeof TOO_LARGE> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Tell the sender to stop.
        await reader.cancel().catch(() => {});
        return TOO_LARGE;
      }
      // `stream: true` so a multi-byte character split across two chunks is
      // reassembled rather than turning into two replacement characters —
      // which for Bengali is every character, at every chunk boundary.
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock?.();
  }
}

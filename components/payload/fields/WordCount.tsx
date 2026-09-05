"use client";

import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import { useField } from "@payloadcms/ui";
import type { CSSProperties } from "react";
import { countWords } from "@/lib/types";

/** The live word count under a text, textarea or rich-text field.
 *
 *  WHY A COUNT IS WORTH SCREEN SPACE. Several of this project's SEO rules are
 *  length rules, and until now they were invisible at the moment they could be
 *  acted on. An author bio under 100 words makes /author/<slug> ship
 *  `robots: noindex` and drops it from the sitemap (isThinEntityPage in
 *  lib/seo.ts); a genre description is documented as needing ~150 words to rank
 *  at all. An editor writing that bio had no way to know which side of the line
 *  they were on except by publishing and reading the built HTML. So the count is
 *  not decoration: where a threshold exists it is passed in as `target`, and the
 *  figure turns amber below it with the consequence in the tooltip.
 *
 *  ONE DEFINITION OF "WORD". countWords() in lib/types.ts, the same function
 *  behind the stored wordCount on chapters and posts and behind the thin-page
 *  gate itself. A local split() here would be a fourth definition, and the
 *  failure it invites is precise: an editor stops at the number this shows,
 *  while the build counts differently and noindexes the page anyway.
 *
 *  RICH TEXT GOES THROUGH PAYLOAD'S OWN CONVERTER, not a hand-rolled walk of the
 *  node tree. `@payloadcms/richtext-lexical/plaintext` is three pure functions
 *  with no server imports, so it bundles into the admin client without dragging
 *  anything with it, and it is byte-for-byte what lib/render.ts calls when it
 *  writes wordCount to the database. A private tree-walk would have been the
 *  fourth definition wearing a disguise: right on paragraphs, quietly wrong on
 *  the first table, upload caption or block someone adds.
 *
 *  WHY afterInput. It leaves `admin.description` free for the field's actual
 *  documentation, which AGENTS.md reserves it for, and Lexical renders
 *  afterInput itself (its Field.js emits AfterInput inside the editor wrapper),
 *  so one component covers all three field types. Registering it does have a
 *  cost worth knowing: renderField.js force-re-renders any field carrying a
 *  beforeInput/afterInput component on every form-state request, so this belongs
 *  on the handful of fields where length is a decision, not on every string in
 *  the CMS.
 *
 *  THE COUNT LAGS BY UNDER A SECOND on rich text and that is not a bug: Lexical
 *  pushes editor state into form state through a deprioritised (~500ms idle)
 *  callback, so the number follows typing rather than tracking each keystroke.
 *
 *  Admin chrome, so the strings here are English. */

const wrap: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.5rem",
  marginTop: "0.35rem",
  fontSize: "var(--bdw-text-xs)",
  lineHeight: 1.5,
  color: "var(--bdw-text-muted)",
};

const figure: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  color: "var(--bdw-text-soft)",
};

const figureShort: CSSProperties = { ...figure, color: "var(--bdw-warning)" };

/** A Lexical document, distinguished from a plain string value by its root. */
function isLexical(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && "root" in (value as object);
}

/** The text this field contains, however the field stores it. Anything that is
 *  neither a string nor a Lexical document counts as empty rather than throwing:
 *  this component sits under a field, and a field that renders a stack trace
 *  because its value arrived in an unexpected shape is worse than one that
 *  briefly reads 0. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (isLexical(value)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return convertLexicalToPlaintext({ data: value as any });
    } catch {
      return "";
    }
  }
  return "";
}

export default function WordCount({
  path,
  target,
  targetWhy,
}: {
  /** Supplied by Payload (renderField passes field/path/permissions/readOnly/
   *  schemaPath as clientProps). Never set this in a collection config: the
   *  framework's props are spread first and a configured `path` would win. */
  path: string;
  /** The length this field is expected to reach, when a rule acts on it. */
  target?: number;
  /** What happens below `target`, in one clause, shown on hover. Required in
   *  spirit whenever `target` is set: a threshold with no stated consequence
   *  reads as an arbitrary quota and gets ignored. */
  targetWhy?: string;
}) {
  const { value } = useField<unknown>({ path });

  const text = textOf(value);
  const words = countWords(text);
  const isRich = isLexical(value);
  const short = typeof target === "number" && words < target;

  const hint = short
    ? `${words} of ${target} words. ${targetWhy ?? ""}`.trim()
    : typeof target === "number"
      ? `${words} words, past the ${target}-word mark this field is measured against.`
      : undefined;

  return (
    <div style={wrap} title={hint}>
      <span>
        <span style={short ? figureShort : figure}>{words.toLocaleString("en-US")}</span>{" "}
        {words === 1 ? "word" : "words"}
        {typeof target === "number" && ` / ${target}`}
      </span>
      {/* Characters only for plain strings. On a bio or a body the figure is
          noise; on a one-line field the word count is the thing that is nearly
          useless, and length is what the editor is actually judging. */}
      {!isRich && text.length > 0 && (
        <span>
          {text.length.toLocaleString("en-US")} {text.length === 1 ? "character" : "characters"}
        </span>
      )}
    </div>
  );
}

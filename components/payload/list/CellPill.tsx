"use client";

import type { CSSProperties, ReactNode } from "react";

/** The pill shared by every custom list cell in this folder.
 *
 *  WHY NOT PAYLOAD'S OWN `<Pill>`: its padding comes from four
 *  `--pill-padding-*` custom properties that default to 0 and are set by the
 *  component's `size` prop, so borrowing the class alone yields text with no
 *  box around it. Reimplementing the box is four lines; depending on the
 *  internals of someone else's component to supply them is a break waiting for
 *  the next minor release.
 *
 *  Inline styles rather than a CSS module because a list cell is rendered once
 *  per row per column: a module would be a second stylesheet request for four
 *  declarations, and these tokens are already global.
 *
 *  TONES ARE SEMANTIC, NOT DECORATIVE. `positive` means "this is settled, no
 *  action needed", `warning` means "someone has to look at this", `danger`
 *  means "this is a problem now". A tier or status that is merely a fact and
 *  not a state gets `neutral`, so colour in a list always means the same
 *  thing — the moment green is used for "nice to see" it stops meaning
 *  "nothing to do here". */

export type CellTone = "neutral" | "brand" | "positive" | "warning" | "danger";

const TONES: Record<CellTone, { background: string; color: string }> = {
  neutral: { background: "var(--bdw-surface-sunken)", color: "var(--bdw-text-soft)" },
  brand: { background: "var(--bdw-brand-soft)", color: "var(--bdw-brand-strong)" },
  positive: { background: "var(--bdw-positive-soft)", color: "var(--bdw-positive)" },
  warning: { background: "var(--bdw-warning-soft)", color: "var(--bdw-warning)" },
  danger: { background: "var(--bdw-danger-soft)", color: "var(--bdw-danger)" },
};

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3em",
  padding: "0.15rem 0.5rem",
  borderRadius: "var(--bdw-radius-pill)",
  fontSize: "var(--bdw-text-xs)",
  fontWeight: 500,
  lineHeight: 1.45,
  whiteSpace: "nowrap",
};

export function CellPill({
  tone = "neutral",
  title,
  children,
}: {
  tone?: CellTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span style={{ ...base, ...TONES[tone] }} title={title}>
      {children}
    </span>
  );
}

/** The em dash every cell in this folder shows for "nothing here", so an empty
 *  column reads as empty rather than as broken. */
export function CellEmpty({ title }: { title?: string }) {
  return (
    <span
      style={{ color: "var(--bdw-text-muted)", fontSize: "var(--bdw-text-sm)" }}
      title={title}
    >
      —
    </span>
  );
}

export default CellPill;

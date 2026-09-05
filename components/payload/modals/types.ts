import type * as React from "react";

/** Shared vocabulary for the confirmation dialogs. Types only, so this file is
 *  importable from both server and client modules without a "use client"
 *  boundary — the provider, the hook and the dialog all read from here rather
 *  than from each other, which is what keeps the dependency graph a star instead
 *  of a ring. */

/** How serious the dialog is, which decides the accent colour, the icon, the
 *  confirm button's fill and the ARIA role.
 *
 *  Three, not more: the value of a tone is that an editor learns to read the
 *  colour before the sentence, and that only works while the set is small enough
 *  to be memorable.
 *
 *  - `danger`   destroys or overwrites something. Red, red confirm button,
 *               role="alertdialog".
 *  - `warning`  proceeds, but with a consequence worth stating first. Amber
 *               accent, ordinary brand confirm button, role="alertdialog".
 *  - `info`     asks a question with no downside either way. Brand accent,
 *               role="dialog". */
export type ConfirmTone = "danger" | "warning" | "info";

export type ConfirmOptions = {
  /** One line, in the imperative or as a question. This is what an editor reads
   *  first and often the only thing they read, so it has to carry the decision on
   *  its own: "Replace the questions you have written?" rather than "Are you
   *  sure?". */
  title: string;
  /** The consequence, spelled out. ReactNode rather than string so a caller can
   *  emphasise a filename or list what is about to be lost. */
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Defaults to "info". */
  tone?: ConfirmTone;
  /** One button, no cancel: the replacement for `alert()`. The promise still
   *  resolves (to `true`) so a caller can await the acknowledgement before
   *  carrying on. */
  acknowledgeOnly?: boolean;
};

/** A pending question: the options plus the resolver of the promise handed back
 *  to the caller. Held in the provider's queue. */
export type ConfirmRequest = {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
};

export type ConfirmContextValue = {
  /** Resolves `true` if the editor confirmed, `false` for cancel, Escape, or a
   *  click on the backdrop. Never rejects: a dialog that throws would force
   *  every call site into a try/catch for something that is not an error. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Acknowledge-only. Resolves once the editor has dismissed the message, which
   *  is what makes it a usable `alert()` replacement: `await notify(...)` reads
   *  the same way at the call site as the blocking builtin it replaces. */
  notify: (options: Omit<ConfirmOptions, "acknowledgeOnly" | "cancelLabel">) => Promise<void>;
};

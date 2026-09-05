"use client";

import { createContext, useContext } from "react";
import type { ConfirmContextValue } from "./types";

/** The context and its hook, kept in their own module.
 *
 *  Not merged into ConfirmProvider.tsx on purpose: a component that only wants to
 *  ASK a question would otherwise have to import the provider, which drags the
 *  dialog, its stylesheet and Payload's modal machinery into that component's
 *  module graph. Splitting the context out means `useConfirm` costs one small
 *  import wherever it is used. */

/** Null rather than a no-op default, so a missing provider is a loud error at the
 *  call site instead of a button that silently does nothing — which is exactly
 *  the failure this whole feature exists to avoid. */
export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error(
      "useConfirm() was called outside ConfirmProvider. Register it in payload.config.ts " +
        "under admin.components.providers, then run `npm run generate:importmap`."
    );
  }

  return context;
}

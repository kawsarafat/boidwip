"use client";

import * as React from "react";
import { useModal } from "@payloadcms/ui";

import ConfirmDialog, { CONFIRM_MODAL_SLUG } from "./ConfirmDialog";
import { ConfirmContext } from "./ConfirmContext";
import type { ConfirmContextValue, ConfirmOptions, ConfirmRequest } from "./types";

/** The confirmation system's logic: one promise per question, a queue, and an exit
 *  that Payload's modal configuration does not provide.
 *
 *  Registered in payload.config.ts under admin.components.providers, which Payload
 *  renders as a child of its RootProvider — inside ModalProvider and inside
 *  TranslationProvider (verify: @payloadcms/ui/dist/providers/Root/index.js, where
 *  ModalProvider wraps `children`). That nesting is the whole reason this is built
 *  on Payload's own modal machinery instead of a second, parallel one: the
 *  container, the body-scroll lock, the focus trap and the z-index budget already
 *  exist, and a bespoke portal would have to fight all four.
 *
 *  WHY THERE IS A QUEUE
 *
 *  Every confirm() hands its caller a promise, and a promise that is never settled
 *  is a hung await — a Save button that stays disabled forever. Payload's modal
 *  state is keyed by slug, so a second confirm() while one is open would silently
 *  take over the same slug and orphan the first promise. Queueing costs a few lines
 *  and makes that case correct instead of invisible.
 *
 *  WHY THE EXIT IS TIMED HERE RATHER THAN LEFT TO THE MODAL
 *
 *  Payload configures @faceless-ui/modal with transTime: 0, so on close the
 *  <dialog> loses its `open` attribute in the same tick and goes display: none
 *  with nothing painted in between. To animate an exit at all, the dialog has to
 *  stay open while it plays: settle() marks the request as closing (which swaps the
 *  card's animation-name, restarting it as the outgoing keyframes), waits, and only
 *  then closes the modal and resolves. */

/** Must be at least the exit duration in ConfirmDialog.module.css, which is
 *  --bdw-fast (120ms) for both the card and the scrim. The extra 40ms is one
 *  frame's slack at 30fps, so the dialog is never removed mid-animation on a slow
 *  paint. Under prefers-reduced-motion the wait is skipped entirely rather than
 *  shortened: tokens.css clamps the animation to 1ms, so there is nothing to wait
 *  for and a timer would only add lag. */
const EXIT_MS = 160;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function ConfirmProvider({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement {
  const { closeModal, isModalOpen, openModal } = useModal();

  const [queue, setQueue] = React.useState<ConfirmRequest[]>([]);
  const [closing, setClosing] = React.useState(false);

  const current = queue[0] ?? null;
  const modalIsOpen = isModalOpen(CONFIRM_MODAL_SLUG);

  /** The request we have already called openModal for. A ref, not state, because
   *  it exists to make the opening effect idempotent: openModal dispatches into
   *  Payload's reducer, and re-dispatching on every render of a context whose
   *  helpers are not referentially stable is how an effect turns into a loop. */
  const openedFor = React.useRef<ConfirmRequest | null>(null);

  /** Whether the modal has actually been observed open for the current request.
   *  Without this, the "someone else closed it" check below would fire on the
   *  render where we have called openModal but the state update has not landed
   *  yet, and cancel every dialog the moment it was raised. */
  const sawOpen = React.useRef(false);

  const exitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** A mirror of the queue for the unmount cleanup, which cannot read state from
   *  a closure that was created when the queue was still empty. */
  const queueRef = React.useRef<ConfirmRequest[]>(queue);
  React.useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setQueue((previous) => [...previous, { options, resolve }]);
    });
  }, []);

  const notify = React.useCallback(
    async (options: Omit<ConfirmOptions, "acknowledgeOnly" | "cancelLabel">): Promise<void> => {
      await confirm({ ...options, acknowledgeOnly: true });
    },
    [confirm]
  );

  const settle = React.useCallback(
    (result: boolean) => {
      /* Ignores a second answer for the same question. Two clicks land here when
       * an editor double-clicks Confirm, and the second would resolve an
       * already-resolved promise (harmless) after shifting a second request off
       * the queue (not harmless: it would skip the next dialog and leave its
       * promise pending). */
      if (!current || closing) {
        return;
      }

      const finish = () => {
        exitTimer.current = null;
        sawOpen.current = false;
        openedFor.current = null;
        closeModal(CONFIRM_MODAL_SLUG);
        setClosing(false);
        setQueue((previous) => previous.slice(1));

        /* Resolved outside every state updater. React may invoke an updater twice
         * in development to check that it is pure, and a resolve() inside one
         * would run twice — which is not an error for a promise, but is an error
         * for whatever side effect the caller performs on the answer. */
        current.resolve(result);
      };

      if (prefersReducedMotion()) {
        finish();
        return;
      }

      setClosing(true);
      exitTimer.current = setTimeout(finish, EXIT_MS);
    },
    [closeModal, closing, current]
  );

  /* Raise the dialog for whatever is at the head of the queue. */
  React.useEffect(() => {
    if (!current) {
      openedFor.current = null;
      sawOpen.current = false;
      return;
    }

    if (openedFor.current !== current) {
      openedFor.current = current;
      sawOpen.current = false;
      openModal(CONFIRM_MODAL_SLUG);
    }
  }, [current, openModal]);

  /* Payload closes every open modal on a route change (CloseModalOnRouteChange in
   * its RootProvider). Our promise knows nothing about that, so a confirmation
   * whose caller navigates away would hang forever. Treating an unexplained close
   * as a cancel is both the safe answer and the honest one: the editor never
   * answered. */
  React.useEffect(() => {
    if (!current || closing) {
      return;
    }

    if (modalIsOpen) {
      sawOpen.current = true;
      return;
    }

    if (!sawOpen.current) {
      return;
    }

    sawOpen.current = false;
    openedFor.current = null;
    setQueue((previous) => previous.slice(1));
    current.resolve(false);
  }, [closing, current, modalIsOpen]);

  /* Unmounting the provider means the admin app is going away, but a pending
   * promise still has a caller sitting on an await. Cancel them rather than
   * leaving the awaits dangling. */
  React.useEffect(() => {
    return () => {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }

      const pending = queueRef.current;
      queueRef.current = [];
      pending.forEach((request) => request.resolve(false));
    };
  }, []);

  const value = React.useMemo<ConfirmContextValue>(() => ({ confirm, notify }), [confirm, notify]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {/* Rendered only while there is a question. Mounting on demand is what makes
        * the entrance keyframes play every time: an always-mounted dialog would
        * animate once and then sit at 100% forever. */}
      {current ? (
        <ConfirmDialog closing={closing} onSettle={settle} options={current.options} />
      ) : null}
    </ConfirmContext.Provider>
  );
}

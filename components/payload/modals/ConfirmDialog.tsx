"use client";

import * as React from "react";
import { Button, Modal, useTranslation } from "@payloadcms/ui";

import ToneIcon from "./ToneIcon";
import type { ConfirmOptions, ConfirmTone } from "./types";
import styles from "./ConfirmDialog.module.css";

/** The dialog itself: markup and nothing else.
 *
 *  It owns no state and holds no queue. Every decision has already been made by
 *  ConfirmProvider, which passes the options in and gets a single boolean back
 *  through onSettle. The split is what makes the dialog readable: this file is
 *  about a heading, a paragraph and two buttons, and the awkward parts (a promise
 *  per question, an exit that has to outlive the modal's own state) live next
 *  door.
 *
 *  WHAT PAYLOAD'S MODAL GIVES US, AND WHAT IT TAKES AWAY
 *
 *  <Modal> is @faceless-ui/modal's asModal() wrapper, re-exported by
 *  @payloadcms/ui. It portals a <dialog> into the container Payload already
 *  renders at the root of the admin app, locks body scroll, and lays a focus trap
 *  on mount. Three of its defaults are wrong for a confirmation and are overridden
 *  below: closeOnBlur, focusTrapOptions.escapeDeactivates, and the exit
 *  transition, which is disabled globally by Payload (transTime: 0) and therefore
 *  reimplemented in CSS. Each is commented at the point of use.
 *
 *  Note the <dialog> is rendered with a plain `open` attribute rather than through
 *  showModal(), so it is a NON-modal dialog as far as the browser is concerned.
 *  That is why Escape is handled by hand here: the UA only fires `cancel` for
 *  dialogs opened with showModal(), so without the handler below Escape would do
 *  nothing at all. */

/** Payload's modal state is keyed by slug, and there is exactly one confirmation
 *  in the tree at a time, so a constant is enough. Exported for the provider,
 *  which is the only thing that opens and closes it. */
export const CONFIRM_MODAL_SLUG = "bdw-confirm";

const TONE_ICON_CLASS: Record<ConfirmTone, string> = {
  danger: styles.iconDanger,
  warning: styles.iconWarning,
  info: styles.iconInfo,
};

/* Static ids rather than useId(). The provider renders at most one dialog, so
 * these cannot collide, and a fixed id is one less thing to trace when reading
 * the accessibility tree. */
const TITLE_ID = "bdw-confirm-title";
const BODY_ID = "bdw-confirm-body";

/** escapeDeactivates defaults to TRUE in focus-trap, which is a trap of its own
 *  here: Escape would tear down the focus trap while leaving Payload's modal state
 *  open, so the dialog would stay on screen with focus free to wander behind it
 *  into a page the editor cannot see. Turning it off and handling Escape in
 *  onKeyDown keeps the two in step.
 *
 *  Hoisted to module scope because asModal lists focusTrapOptions in an effect's
 *  dependency array; an object literal in JSX would be a new value every render.
 *
 *  Typed through Modal's own props so this file does not import from focus-trap,
 *  which is a transitive dependency we do not declare. */
const FOCUS_TRAP: React.ComponentProps<typeof Modal>["focusTrapOptions"] = {
  escapeDeactivates: false,
};

export type ConfirmDialogProps = {
  options: ConfirmOptions;
  /** True for the length of the exit animation, while the promise is still
   *  unresolved and Payload's modal state is still open. */
  closing: boolean;
  /** Called once, with the editor's answer. */
  onSettle: (result: boolean) => void;
};

export default function ConfirmDialog({
  closing,
  onSettle,
  options,
}: ConfirmDialogProps): React.ReactElement {
  /* Payload's own translations, so Cancel and Confirm read the same as the Cancel
   * and Confirm on every dialog Payload ships and follow the editor's chosen
   * language. Both keys are in @payloadcms/translations' client bundle. */
  const { t } = useTranslation();

  const tone: ConfirmTone = options.tone ?? "info";
  const acknowledgeOnly = options.acknowledgeOnly === true;

  /* Escape and a click on the backdrop are the same gesture: "I did not answer".
   * For an acknowledge-only message there is nothing to decline, so dismissing it
   * IS the acknowledgement and resolves true — that is what lets a caller await
   * notify() and carry on, the way the alert() it replaces used to behave. */
  const dismiss = React.useCallback(() => {
    onSettle(acknowledgeOnly);
  }, [acknowledgeOnly, onSettle]);

  /* Payload's ModalContainer closes every open modal when it is clicked and
   * closeOnBlur is set, which would fire for clicks on our own buttons: the
   * <dialog> is a portal child of that container, so everything inside it bubbles
   * there. closeOnBlur is off below and backdrop dismissal is done here instead,
   * where "the backdrop" can be defined precisely as the dialog element itself
   * rather than anything descended from it. */
  const handleBackdropClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) {
        dismiss();
      }
    },
    [dismiss]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Escape") {
        return;
      }

      /* stopPropagation matters: a confirmation raised from inside one of
       * Payload's drawers would otherwise close the drawer as well, discarding
       * the form behind the question the editor was just asked. */
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    },
    [dismiss]
  );

  return (
    <Modal
      aria-describedby={options.body ? BODY_ID : undefined}
      aria-labelledby={TITLE_ID}
      className={[styles.dialog, closing ? styles.closing : null].filter(Boolean).join(" ")}
      closeOnBlur={false}
      focusTrapOptions={FOCUS_TRAP}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      /* alertdialog interrupts a screen reader to read the dialog immediately,
       * which is right when something is about to be destroyed or changed and
       * wrong for an ordinary question — an interruption for every "carry on?"
       * teaches the editor to ignore the interruption. `undefined` leaves the
       * <dialog> element's implicit role in place; asModal spreads this last, so
       * it wins over the role it would otherwise set. */
      role={tone === "info" ? undefined : "alertdialog"}
      slug={CONFIRM_MODAL_SLUG}
    >
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={[styles.icon, TONE_ICON_CLASS[tone]].join(" ")}>
            <ToneIcon tone={tone} />
          </span>

          <div className={styles.text}>
            {/* h2, not h1: the admin view behind the dialog already owns the
              * page's h1, and a dialog is not a new document. The dialog's
              * accessible name comes from aria-labelledby either way. */}
            <h2 className={styles.title} id={TITLE_ID}>
              {options.title}
            </h2>
            {options.body ? (
              /* div rather than p, because body is a ReactNode and a caller
               * listing what is about to be lost will pass a <ul>, which is not
               * valid inside a paragraph. */
              <div className={styles.body} id={BODY_ID}>
                {options.body}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.controls}>
          {/* Cancel first in the DOM so the focus trap lands on it: the safe
            * answer should be the one an editor gets by pressing Enter on a
            * dialog they have not read. The visual order is the conventional
            * one (confirm on the right) because .controls is a flex row, and on
            * phones it is column-reverse. */}
          {acknowledgeOnly ? null : (
            <Button
              buttonStyle="secondary"
              margin={false}
              onClick={() => onSettle(false)}
              size="large"
              type="button"
            >
              {options.cancelLabel ?? t("general:cancel")}
            </Button>
          )}

          <Button
            buttonStyle="primary"
            /* Not buttonStyle="error": the type advertises it but Payload ships
             * no .btn--style-error rule, so it renders as an unfilled button.
             * styles.confirmDanger reassigns a primary button's colour custom
             * properties instead. */
            className={tone === "danger" ? styles.confirmDanger : undefined}
            margin={false}
            onClick={() => onSettle(true)}
            size="large"
            type="button"
          >
            {options.confirmLabel ??
              (acknowledgeOnly ? t("general:close") : t("general:confirm"))}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

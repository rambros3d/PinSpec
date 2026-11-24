/**
 * DOM-only focus helper shared by native dialogs. It records the control that
 * opened the dialog, focuses a control inside the dialog on open, and restores
 * the opener when the dialog closes by any path, including Escape and cancel.
 */
export function openDialogWithFocus(
  dialog: HTMLDialogElement | null,
  focusTarget?: HTMLElement | null,
  openerOverride?: HTMLElement | null,
): void {
  if (!dialog) return;
  const opener =
    openerOverride ??
    (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  if (!dialog.open) dialog.showModal();
  const target =
    focusTarget ??
    dialog.querySelector<HTMLElement>('button, input, select, textarea, [tabindex="0"]') ??
    dialog;
  target.focus();

  const restoreFocus = (): void => {
    dialog.removeEventListener('close', restoreFocus);
    opener?.focus();
  };
  dialog.addEventListener('close', restoreFocus);
}

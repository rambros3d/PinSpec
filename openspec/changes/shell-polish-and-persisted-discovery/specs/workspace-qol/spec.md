# Spec Delta

## MODIFIED Requirements

### Requirement: Catalog load failure is visible and retryable

When the static catalog cannot be loaded, the landing quick-search dropdown
SHALL show the failure message and a retry action instead of a normal result
list. Retrying SHALL start a new catalog load; a successful retry SHALL restore
normal search results, and a failed retry SHALL show the failure again. Covered
error rows SHALL use daisyUI alert classes and pending rows SHALL use daisyUI
loading indicators.

#### Scenario: Failed catalog fetch shows an error row

- **WHEN** the catalog index or metadata request fails and the user opens the quick-search dropdown
- **THEN** the dropdown shows the failure message and a retry control instead of an empty-result message

#### Scenario: Retry recovers the catalog

- **WHEN** the user activates the retry control and the catalog requests now succeed
- **THEN** the error row is replaced by the loading state and then by matching parts

#### Scenario: Retry failure is reported again

- **WHEN** the user activates the retry control and the catalog requests fail again
- **THEN** the dropdown shows the failure message and the retry control again without leaving an empty result list

#### Scenario: Error and pending surfaces adopt component classes

- **WHEN** a catalog error or pending state is shown on any covered surface
- **THEN** the error uses `alert alert-soft alert-error` with unchanged text and the pending text is accompanied by `loading loading-spinner loading-xs`

### Requirement: Native dialogs manage focus on open and close

Every native dialog in the workspace SHALL move focus to a control inside the
dialog when it opens and SHALL return focus to the control that opened it when
it closes, including close by Escape, cancel, backdrop click, and the dialog's
own close action. This applies to the export, MCU switcher, board selector,
compatible-part finder, pinout diff, ambiguous-part, and shortcut-help dialogs.
The shortcut-help modal backdrop SHALL be a direct child of the dialog element
outside `.modal-box`.

#### Scenario: Export dialog opens with focus inside

- **WHEN** the export dialog is opened
- **THEN** focus is on a control inside the dialog and not on the underlying page

#### Scenario: Focus returns after close

- **WHEN** any workspace native dialog is closed by Escape or its close control
- **THEN** focus returns to the control that opened that dialog

#### Scenario: Shortcut help backdrop keeps dismissal behavior

- **WHEN** shortcut help is closed by a backdrop click with the backdrop placed directly under the dialog
- **THEN** the dialog closes and focus returns to the control that opened it

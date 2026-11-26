# shared-ui-abstractions Specification

## ADDED Requirements

### Requirement: UI preferences share one persistence helper

The application SHALL provide one runes-backed localStorage helper for
presentation-only preferences. It SHALL normalize values on load and on write,
ignore no-op writes, tolerate missing or throwing storage, and preserve the
existing storage keys and JSON shapes of the shell, workspace-view, discovery,
and theme stores. The four stores SHALL keep their existing public properties,
getters, setters, actions, defaults, and normalization rules.

#### Scenario: Stored preference shape is unchanged

- **WHEN** a shell, workspace-view, or discovery preference is changed
- **THEN** its namespaced localStorage record contains the same keys and normalized values as before the shared helper was introduced

#### Scenario: Unavailable storage does not break the UI

- **WHEN** `localStorage` access throws or `window` is absent
- **THEN** constructing each store and setting any preference neither throws nor loses the in-memory value

#### Scenario: Theme stays a raw localStorage string

- **WHEN** the theme mode is read or set
- **THEN** the value under `pinspec:theme` is one of the three mode strings and unknown saved values still resolve to system mode

#### Scenario: Preferences stay out of shareable state

- **WHEN** a share URL or version-2 project file is produced from workspace state
- **THEN** no sidebar, dock, filter, or theme preference field appears in it

### Requirement: Pin and peripheral view state has pure helpers

`src/core/pin-view.ts` SHALL be pure TypeScript with no Svelte or DOM import. It
SHALL define power-pin detection, baseline pin status for a chip and assignment
map, exact pin status CSS-variable tokens, and a keyed peripheral status view.
The package renderers, diff modal, and peripheral tree/detail components SHALL
use these helpers with unchanged geometry, class tokens, labels, and SVG
attributes.

#### Scenario: Power pins are detected consistently

- **WHEN** a pin has type `power`, `reset`, or `boot`
- **THEN** `isPowerPin` returns true, and other pin types return false

#### Scenario: Baseline status matches the previous diff mapping

- **WHEN** `basePinStatus` receives a chip and an assignment map
- **THEN** each I/O position with an assignment is `assigned`, each unassigned I/O position is `unused`, fixed power positions are `power`, and other positions are `unused`

#### Scenario: Status tokens are unchanged

- **WHEN** `pinStatusTokens` receives a status with selected, remap-source, and highlighted flags
- **THEN** it returns the same fill, stroke, text, and tag-background CSS variables previously produced by the renderers, with remap source outranking highlight and highlight outranking status

#### Scenario: Peripheral status view carries existing tokens

- **WHEN** the peripheral tree or detail panel resolves a status
- **THEN** `PERIPHERAL_STATUS_VIEW` supplies the same hue, border, badge, and label tokens for `none`, `partial`, `active`, and `error`

### Requirement: Native dialogs use one wrapper and one owner

All modal surfaces SHALL render through one `Dialog.svelte` component that owns
the native dialog, modal box, backdrop, opener capture, focus restoration,
`showModal()`, `close()`, cancel, and backdrop closing. Dialogs SHALL pass their
own aria label, sizing class, close handler, and optional focus target. The
transient top-bar store SHALL expose one typed active-dialog value backing the
existing boolean flags, and dialogs with more than one owner SHALL mount once in
the global shell.

#### Scenario: Every modal uses the wrapper

- **WHEN** any workspace dialog or the start-screen ambiguous-import dialog is open
- **THEN** its native dialog element, backdrop, and focus behavior come from `Dialog.svelte` and no caller duplicates `showModal()` or `modal-backdrop` markup

#### Scenario: Compare and shortcut help mount once

- **WHEN** the compare action is used from the landing page or the global bar, or Hotkeys is used from any route
- **THEN** exactly one `PinoutDiffModal` and one `ShortcutHelpDialog` exist in the shell and both close through the shared owner

#### Scenario: Dialog state remains transient

- **WHEN** a dialog flag changes or the workspace unmounts
- **THEN** no dialog state is written to localStorage, a share URL, a project file, recent sessions, or undo history

#### Scenario: Dialogs keep observable behavior

- **WHEN** a dialog opens, is cancelled with Escape, or is closed by clicking the backdrop
- **THEN** focus returns to the opener and the owning flag or local state is cleared exactly once

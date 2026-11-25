# Spec Delta

## Purpose

Defines the consolidated About catalog-sources surface and the shell-level
Hotkeys entry that opens the shared shortcut reference over the current route.

## ADDED Requirements

### Requirement: About presents one grouped catalog sources table

The About destination SHALL present catalog provenance in one grouped table
named Catalog sources. A vendor row SHALL carry the chip count, match and
coverage ratios when present, and the sync time. Nested source rows SHALL carry
the source id, resolved SHA, license, and an external link. Totals SHALL appear
in the merged table header instead of a separate summary card.

#### Scenario: Vendor rows carry counts ratios and sync time

- **WHEN** generated metadata is available and About is rendered
- **THEN** each vendor row shows its chip count, any match and coverage ratios, and the formatted sync time

#### Scenario: Nested source rows carry provenance

- **WHEN** the grouped table is rendered with generated metadata
- **THEN** each nested source row shows its source id, resolved SHA or pending placeholder, license, and an external link

#### Scenario: Totals appear in the table header

- **WHEN** About renders with a loaded catalog index
- **THEN** the indexed total and family count appear in the merged table header and no separate summary card is shown

#### Scenario: One table replaces the split cards

- **WHEN** the About surface is inspected
- **THEN** provenance appears in one grouped table and no separate per-vendor card and no separate upstream-sources card remain

### Requirement: About keeps loading and failure states on the merged surface

The merged catalog sources surface SHALL show a loading state while metadata is
pending and SHALL show an error message with a retry control when metadata
cannot be loaded. The failure and retry controls SHALL belong to the merged
surface and SHALL NOT depend on shortcut content.

#### Scenario: Metadata is pending

- **WHEN** metadata has not loaded and no error is present
- **THEN** the merged surface shows a loading state and an external-link layout is not required

#### Scenario: Metadata fails to load

- **WHEN** the metadata request fails
- **THEN** the merged surface shows the failure message and a retry control that reattempts the load

#### Scenario: Retry succeeds

- **WHEN** the user activates retry and metadata loads
- **THEN** the merged table replaces the failure message with vendor and source rows

### Requirement: About contains no shortcut listings

The About destination SHALL NOT render a keyboard shortcut list, an inline
shortcut summary, or a Shortcuts tab. Non-shortcut tabs SHALL remain available.
Removing shortcut content from About SHALL NOT remove the shortcut reference
from other surfaces of the application.

#### Scenario: No shortcut text on About

- **WHEN** About is rendered in any tab or metadata state
- **THEN** no shortcut key, shortcut action, or inline shortcut summary is shown

#### Scenario: Shortcuts tab is absent

- **WHEN** the About tab strip is rendered
- **THEN** it offers only non-shortcut tabs and the sources tab remains available

#### Scenario: Other shortcut surfaces remain

- **WHEN** the user leaves About and opens a surface that owns the shortcut reference
- **THEN** that surface still lists the documented shortcuts from the shared reference

### Requirement: The sidebar offers a Hotkeys entry above About

The global sidebar SHALL offer a Hotkeys entry positioned immediately above the
About entry. The entry SHALL be reachable in both collapsed and expanded
sidebar states and SHALL NOT be a hash-route destination.

#### Scenario: Hotkeys sits above About

- **WHEN** the sidebar entries are rendered
- **THEN** Hotkeys appears immediately above About in both rail and expanded states

#### Scenario: Hotkeys opens no route

- **WHEN** the user activates the Hotkeys entry
- **THEN** the active hash route stays on the current destination and no new route is added

### Requirement: Hotkeys opens the shared shortcut dialog

Activating the Hotkeys entry SHALL open the existing shortcut help component as
a native dialog using the modal class over the current route. The dialog SHALL
render its entries from the shared `SHORTCUTS` reference in
`src/data/provenance.ts` and SHALL NOT keep a second hardcoded shortcut list.
Focus, Escape, close, and backdrop behavior SHALL match the existing dialog.

#### Scenario: Modal opens over the current route

- **WHEN** the user activates Hotkeys from any shell or workspace route
- **THEN** a native modal dialog opens above the current route with focus inside and the route content remains mounted

#### Scenario: Dialog lists the shared reference

- **WHEN** the Hotkeys dialog is open
- **THEN** it lists the entries from `SHORTCUTS` and contains no separate hardcoded shortcut array

#### Scenario: Dialog closes and restores focus

- **WHEN** the user closes the Hotkeys dialog with the close control, Escape, or the backdrop
- **THEN** the dialog closes and focus returns to the control that opened it

### Requirement: Hotkeys dialog state is transient

Any dialog-open flag used for Hotkeys SHALL be transient UI state. It SHALL NOT
be persisted to localStorage and SHALL NOT enter share URLs, version-2 project
files, recent sessions, or undo history.

#### Scenario: Hotkeys state is never shared

- **WHEN** a workspace is shared or exported after the Hotkeys dialog has been used
- **THEN** neither the payload nor the project file contains a dialog-open field and all pin configuration is preserved

### Requirement: About consolidation preserves existing contracts

This capability SHALL add no dependency, no raw color literal outside the
vendored theme file, no emoji, and no change to generated data, pin
configuration, solver, exporters, or hash routing. `npm test`, `npm run check`,
and `BASE_PATH="/pincraft/" npm run build` SHALL exit zero with no build
warnings.

#### Scenario: Generated data and pin contracts remain stable

- **WHEN** the verification commands are run after implementation
- **THEN** generated-data, share-link, and pin-configuration tests pass unchanged alongside the updated UI contracts

#### Scenario: Source hygiene holds

- **WHEN** changed source files are scanned
- **THEN** no color literal appears outside the vendored theme file and no emoji character appears

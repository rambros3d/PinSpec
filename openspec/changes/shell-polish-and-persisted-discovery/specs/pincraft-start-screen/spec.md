# Spec Delta

## MODIFIED Requirements

### Requirement: The central discovery column keeps existing search and presets

The central column SHALL keep the existing quick search with `Ctrl+K`, vendor
tabs, family and package filters, and its catalog error and retry row. Query and
filters SHALL be restored from localStorage. The error and pending rows SHALL
use daisyUI component classes. The column SHALL keep recent local sessions and the
cross-vendor starter chips with their current part identifiers and section
anchor.

#### Scenario: Quick search opens a part

- **WHEN** the user searches for a catalog part on the start screen and selects a result
- **THEN** the workspace opens on the `#/mcu/<PART_NUMBER>` route for that part

#### Scenario: Catalog failure stays retryable

- **WHEN** the catalog index cannot be loaded and the quick search dropdown is opened
- **THEN** the existing failure message and retry control are shown instead of an empty result list

#### Scenario: Quick-search filters survive reload

- **WHEN** the user changes query, vendor, family, or package filters and reloads the start screen
- **THEN** the quick search restores those filters and can still reset them to defaults

#### Scenario: Quick-search status surfaces use daisyUI classes

- **WHEN** the quick-search dropdown shows a catalog error or a pending catalog load
- **THEN** the error uses `alert alert-soft alert-error` and the pending text is accompanied by `loading loading-spinner loading-xs`

#### Scenario: Starter chips remain cross-vendor

- **WHEN** the starter chip section is rendered
- **THEN** it contains the existing STM32, CH32, and RP part identifiers and the Cross-Vendor Starter Chips heading

### Requirement: The right rail shows live catalog facts and shortcuts

The right rail SHALL show the indexed chip count, per-vendor counts and match or
coverage ratios from `meta.json` when available, a compact provenance summary,
and a text list of the keyboard shortcuts available in the application and
workspace. Its catalog statistics error SHALL use `alert alert-soft alert-error`
and its pending message SHALL include an extra-small daisyUI loading indicator.
It SHALL NOT contain pin assignments or other shareable pin configuration.

#### Scenario: Catalog metadata is available

- **WHEN** `meta.json` has loaded
- **THEN** the rail shows the indexed chip count and the per-vendor counts and ratios from that metadata

#### Scenario: Catalog metadata is unavailable

- **WHEN** `meta.json` has not loaded or cannot be loaded
- **THEN** the rail shows a loading or unavailable state and the rest of the start screen remains usable

#### Scenario: Statistics error uses an alert surface

- **WHEN** catalog statistics are unavailable on the start screen
- **THEN** the existing "Catalog statistics unavailable." guidance is shown inside an `alert alert-soft alert-error` surface

#### Scenario: Statistics pending state uses a loading indicator

- **WHEN** catalog statistics are still loading
- **THEN** the existing loading text is accompanied by a `loading loading-spinner loading-xs` indicator

#### Scenario: Shortcut reference is textual

- **WHEN** the rail is rendered
- **THEN** it lists `Ctrl+K`, `Ctrl+F`, `Ctrl+Click`, `Ctrl+Z`, `Ctrl+Y`, `0`, and `Escape` as text

### Requirement: Presentation state stays out of shareable pin configuration

No new shareable state field SHALL be introduced by the start screen. Action
selection and rail expansion SHALL remain component-local presentation state,
while quick-search discovery filters SHALL be presentation state persisted only
in localStorage. The theme preference SHALL remain in localStorage only. Pin
configuration handoff to the workspace SHALL continue through the existing
workspace store path and SHALL NOT gain a presentation field.

#### Scenario: Start screen state is not shared

- **WHEN** a workspace is opened through a start-screen action and then shared or exported as project JSON
- **THEN** neither the share payload nor the project JSON contains an action, rail, shortcut, or discovery filter field

#### Scenario: Theme preference remains local

- **WHEN** the theme control is used on the start screen and the workspace is later shared
- **THEN** the theme value is written only to localStorage and is absent from the share payload and project JSON

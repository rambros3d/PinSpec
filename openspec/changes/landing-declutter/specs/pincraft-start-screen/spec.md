# Spec Delta

## MODIFIED Requirements

### Requirement: The landing route is a three-zone start screen

The `#/` route SHALL render an application start screen inside one
`.landing-shell` container with three zones: a left action column, a central
discovery column for search, recent sessions, and starter chips, and a right
rail with a compact vendor list and sync date. The shell SHALL remain in the
visible viewport and scroll its own content. Spacing SHALL read as
a focused application start screen, and the pass SHALL change presentation only
with no new route, feature, or shareable field.

#### Scenario: Opening the start screen

- **WHEN** the user opens the `#/` route
- **THEN** the left action column, the central discovery column, and the right rail are rendered inside `.landing-shell`

#### Scenario: Narrow viewport stacks the zones

- **WHEN** the viewport is too narrow for three side-by-side columns
- **THEN** the zones stack in a single scrollable column inside `.landing-shell` and the root document does not scroll

#### Scenario: No hero-dependent control remains

- **WHEN** the start screen renders before catalog data has loaded
- **THEN** no control on the start screen is disabled by or bound to a hero chip load

#### Scenario: Focused hierarchy is applied across all zones

- **WHEN** the reworked start screen renders at a supported desktop width
- **THEN** the action, discovery, and rail zones use consistent spacing and card density and no zone uses promotional language

### Requirement: The central discovery column keeps existing search and presets

The central column SHALL keep the existing quick search with `Ctrl+K`, vendor
tabs, family and package filters, and its catalog error and retry row. Query and
filters SHALL be restored from localStorage. The error and pending rows SHALL
use daisyUI component classes. The column SHALL keep recent local sessions and the
cross-vendor starter chips with their current part identifiers and section
anchor. The discovery header SHALL be the only location of the parts-indexed
and families count.

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

#### Scenario: Index count appears only in the discovery header

- **WHEN** `meta.json` has loaded and the start screen is rendered
- **THEN** the parts-indexed and families count appears in the discovery header with its two badges and is absent from the right rail

### Requirement: The right rail shows live catalog facts and shortcuts

The right rail SHALL show a compact catalog card with vendor label and chip
count rows plus the sync date from `meta.json` when available. It SHALL NOT show
a total, match or coverage ratios, or shortcuts; the Shortcuts card SHALL be
removed. Statistics errors SHALL use `alert alert-soft alert-error` and pending
text SHALL use `loading loading-spinner loading-xs`. It SHALL NOT contain pin
assignments or shareable configuration. The sidebar Hotkeys dialog SHALL be the
only shortcut reference.

#### Scenario: Catalog metadata is available

- **WHEN** `meta.json` has loaded
- **THEN** the rail lists each available vendor label with its chip count and the sync date, and shows no total count and no match or coverage ratio

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

- **WHEN** the shared shortcut reference is rendered in the shortcut help dialog
- **THEN** it lists `Ctrl+K`, `Ctrl+F`, `Ctrl+Click`, `Ctrl+Z`, `Ctrl+Y`, `0`, and `Escape` as text and the right rail contains no shortcut card

#### Scenario: Rail carries no shortcut reference

- **WHEN** the right rail is rendered in any metadata state
- **THEN** it contains no shortcut keys, no shortcut action list, and no Shortcuts card

#### Scenario: Rail omits derived ratios and totals

- **WHEN** a vendor row is rendered in the rail
- **THEN** the row text contains only the vendor label and chip count, with no match percentage, coverage percentage, or indexed total

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

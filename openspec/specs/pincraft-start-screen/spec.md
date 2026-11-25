# pincraft-start-screen Specification

## Purpose

Defines the `#/` application start screen: its three zones, the entry points for
new, opened, imported, and compared pinouts, the retained discovery and
provenance surfaces, and the boundary between shareable pin configuration and
local-only presentation state.

## Requirements

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

### Requirement: The sticky header keeps navigation and theme

The header SHALL remain sticky and SHALL keep the brand link, the `#presets`
anchor, a link to the About destination that replaces the former provenance
anchor, and the theme control. An export-preview anchor SHALL NOT be present.

#### Scenario: Header remains available

- **WHEN** the start screen is scrolled or opened at any supported viewport width
- **THEN** the header keeps the brand link, the Starter Chips anchor, the About link, and the theme control

#### Scenario: Export anchor is gone

- **WHEN** the header is inspected
- **THEN** it contains no `#export-preview` anchor

#### Scenario: Data Sources opens About

- **WHEN** the user activates the Data Sources or About navigation link
- **THEN** the About destination opens with the provenance information previously shown in the start-screen footer

### Requirement: The left action column provides five entry points

The action column SHALL expose New pinout MCU/Board, Open project, Import
`.ioc`, Import pinout.json, and Compare. New pinout MCU/Board SHALL navigate to
`#/catalog`; the other actions SHALL reuse their existing navigation, dialog,
and handoff paths without adding a new persisted field.

#### Scenario: New pinout MCU or board

- **WHEN** the user activates New pinout MCU/Board
- **THEN** the catalog route opens and the start screen keeps its inline quick search and board preset selector for direct use

#### Scenario: Board preset seeds a workspace

- **WHEN** the user selects a board preset from the start screen and its MCU is in the catalog
- **THEN** the preset state is handed to the workspace store and the workspace opens for that MCU

#### Scenario: Open project reveals recent local sessions

- **WHEN** the user activates Open project
- **THEN** the recent local sessions area is made visible and a listed session can be reopened in the workspace

#### Scenario: Open project with no recent sessions

- **WHEN** the user activates Open project and no recent session exists
- **THEN** the start screen shows the existing hint that opening a part creates a recent session in this browser

#### Scenario: Import pinout.json from the start screen

- **WHEN** the user selects a version-2 pinout JSON file and the project parser accepts it
- **THEN** the parsed state is handed to the workspace store and the workspace opens for its MCU identifier

#### Scenario: Invalid pinout JSON is reported in place

- **WHEN** the selected project file cannot be parsed
- **THEN** the start screen shows a readable inline error and does not navigate or change the current workspace

#### Scenario: Compare opens the read-only diff modal

- **WHEN** the user activates Compare from the start screen
- **THEN** the existing read-only pinout diff modal opens with two project file inputs and no workspace state is changed

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

### Requirement: The hero preview and landing export preview are removed

The start screen SHALL NOT render an interactive chip preview, a hero vendor
switcher, a hero demo state, a hero-dependent workspace button, or a live export
preview with copy and download controls. The interactive chip preview component
and its dedicated demo-state builder SHALL be removed from the application.
Export generation and copy or download controls SHALL remain in the workspace
export modal only.

#### Scenario: No hero strings on the start screen

- **WHEN** the start screen source is inspected
- **THEN** it contains no hero chip identifier, hero loader, hero vendor selector, or hero preview component

#### Scenario: No export preview section

- **WHEN** the start screen is rendered
- **THEN** it contains no `#export-preview` section and no export copy or download control

#### Scenario: Workspace exports remain

- **WHEN** a workspace is open
- **THEN** its export modal still offers the Rust, C header, CSV, and JSON tabs with copy and download controls

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

### Requirement: Source hygiene and verification remain green

The start screen SHALL add no dependency, SHALL keep raw color literals in the
vendored theme file, SHALL contain no emoji characters, and SHALL keep strict
TypeScript clean. `npm test`, `npm run check`, and
`BASE_PATH="/pincraft/" npm run build` SHALL exit zero with no build warnings.

#### Scenario: Verification sequence passes

- **WHEN** the three verification commands are run after the change
- **THEN** all three exit zero and the build resolves assets under `/pincraft/` without root-absolute data or asset paths

#### Scenario: No new raw colors or emoji

- **WHEN** the changed source files are scanned
- **THEN** no color literal appears outside `src/themes/daisyui.css` and no emoji character appears

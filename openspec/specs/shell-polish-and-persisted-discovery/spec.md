# shell-polish-and-persisted-discovery Specification

## Purpose

Defines the shared presentation contract for this change: browser-local
discovery filter persistence, a direct Workspace entry in the global sidebar,
and daisyUI 5 class structure for error, pending, tab, DMA, and dialog surfaces
on shell and workspace routes.

## Requirements

### Requirement: Discovery filters are restored from browser-local storage

Catalog route filters (`query`, `vendorFilter`, `familyFilter`, `packageFilter`)
and the equivalent start-screen quick-search filters SHALL be UI preferences
persisted only in localStorage. They SHALL restore after reload and route
changes, SHALL reset to defaults when absent or malformed, and SHALL NOT enter
share URLs, version-2 project JSON, recent sessions, or undo history. Pin
configuration persistence SHALL remain unchanged.

#### Scenario: Catalog filters survive a reload

- **WHEN** the user sets a catalog query and vendor, family, and package filters and reloads the page or returns to `#/catalog`
- **THEN** the same four filters are applied to the catalog result list

#### Scenario: Quick-search filters survive a reload

- **WHEN** the user sets quick-search query, vendor, family, and package filters and reloads the page
- **THEN** the quick search restores those filters and keeps its own filter state independent of the catalog route

#### Scenario: Malformed stored filters use defaults

- **WHEN** the stored filter record is absent, unparseable, or contains unrecognized field types
- **THEN** the query and family and package values are empty, the vendor value is `all`, and no error is shown

#### Scenario: Reset clears persisted filters

- **WHEN** the user activates the reset control on either discovery surface
- **THEN** that surface returns to its default filters and the stored record for that surface reflects the defaults

#### Scenario: Filters stay out of shared state

- **WHEN** a workspace opened through either discovery surface is shared or exported as a version-2 project file
- **THEN** neither the share payload nor the project file contains a discovery filter field and all pin configuration is preserved

### Requirement: The sidebar offers a direct Workspace entry

The global sidebar SHALL show a Workspace entry next to Home. Activating it
SHALL open `#/mcu/<PART_NUMBER>` for the loaded chip, or for the most recent
local session when no chip is loaded. The entry SHALL be visibly disabled when
neither target exists. It SHALL live in the existing single sidebar mount and
SHALL NOT change the collapsed rail width, expanded overlay width, or the
placement of the other section entries and recent sessions.

#### Scenario: Workspace entry opens the loaded chip

- **WHEN** a chip is loaded and the user activates the sidebar Workspace entry
- **THEN** the app opens `#/mcu/<PART_NUMBER>` for that chip through the existing MCU navigation path

#### Scenario: Workspace entry falls back to the most recent session

- **WHEN** no chip is loaded and at least one recent session exists
- **THEN** activating Workspace opens the workspace for the most recent session

#### Scenario: Workspace entry is disabled without a target

- **WHEN** no chip is loaded and no recent session exists
- **THEN** the Workspace entry is visibly disabled and does not change the route

#### Scenario: Sidebar geometry and mount are unchanged

- **WHEN** the Workspace entry is present in either sidebar state
- **THEN** the collapsed rail is still 3rem, the expanded panel is still an overlay, and no second sidebar is mounted

### Requirement: Error messages use daisyUI alert classes

Catalog route, start-screen statistics, quick-search results, and About
provenance error messages SHALL use `alert alert-soft alert-error` while every
existing visible error string and retry control remains unchanged. The error
message SHALL continue to appear instead of an empty result or statistics
list, and retry SHALL continue to start a new catalog load.

#### Scenario: Error surfaces adopt the alert style

- **WHEN** the catalog index or metadata request fails on any of the four surfaces
- **THEN** the surface shows its existing error text inside an `alert alert-soft alert-error` container

#### Scenario: Error text and retry are unchanged

- **WHEN** the user compares a failed surface with its behavior before this change
- **THEN** the same message text and the same Retry catalog load control are present and retry still reloads the catalog

### Requirement: About tabs use a supported daisyUI 5 tab style

The About tab strip SHALL use a supported daisyUI 5 tab style, `tabs-box` or
`tabs-border`, and SHALL NOT use the retired `tabs-boxed` style. The sources
tab, its persisted selection, and its accessible tab semantics SHALL remain
unchanged.

#### Scenario: Tab strip uses daisyUI 5 styles

- **WHEN** the About route is rendered in either theme
- **THEN** the tab strip carries a supported daisyUI 5 tab style and no `tabs-boxed` class

#### Scenario: Tab selection is unchanged

- **WHEN** the user selects the Sources tab and reloads
- **THEN** the same tab is selected and reports the same selected state as before

### Requirement: DMA status rows use one component family

Each SummaryDrawer DMA status row SHALL render either a `card` branch for
ordinary statuses or an `alert` branch for contention, never both component
families on the same element. Peripheral, signal, status badge, and channel
detail text SHALL remain unchanged.

#### Scenario: Contention uses an alert branch

- **WHEN** a DMA entry has contention status
- **THEN** its row is an alert surface and does not also carry card component classes

#### Scenario: Non-contention uses a card branch

- **WHEN** a DMA entry has a shared or normal status
- **THEN** its row is a card surface and does not also carry alert component classes

### Requirement: Pending states use daisyUI loading indicators

The workspace load view SHALL use `loading loading-spinner loading-lg
text-info` in place of the hand-rolled animated border spinner. The catalog
route, MCU switcher, quick search, start-screen statistics, About provenance,
and compatible-MCU finder SHALL each pair their existing pending text with a
`loading loading-spinner loading-xs` indicator.

#### Scenario: Workspace pending view uses the loading component

- **WHEN** the workspace is fetching an MCU or shared pinout
- **THEN** the loading view shows a large daisyUI spinner and the existing loading text

#### Scenario: Six pending messages keep their text

- **WHEN** each of the six discovery surfaces is in its pending state
- **THEN** its existing message text is unchanged and an extra-small daisyUI spinner accompanies it

#### Scenario: No raw color or custom animation is added

- **WHEN** changed surfaces are scanned
- **THEN** spinner appearance comes from daisyUI classes and theme tokens and no new raw color literal appears

### Requirement: Shortcut help uses the daisyUI dialog structure

The shortcut help dialog SHALL place its `form.modal-backdrop` as a direct child
of `<dialog class="modal">`, outside `.modal-box`. Opening focus, focus
restoration on close, Escape, cancel, backdrop click, and the close control
SHALL behave as before. The dialog SHALL be the only keyboard shortcut reference
rendered in the app; the start screen SHALL have no Shortcuts card and About no
shortcut list. The shared `SHORTCUTS` list in `src/data/provenance.ts` SHALL
remain its data source.

#### Scenario: Backdrop is a direct dialog child

- **WHEN** the shortcut help dialog markup is inspected
- **THEN** the modal backdrop form is a sibling of `.modal-box` under the dialog and is not nested inside `.modal-box`

#### Scenario: Dialog dismissal is unchanged

- **WHEN** the user closes shortcut help by Escape, cancel, the close control, or a backdrop click
- **THEN** the dialog closes and focus returns to the control that opened it

#### Scenario: Dialog is the only rendered shortcut reference

- **WHEN** any shell route or the start screen is rendered in either theme
- **THEN** the only rendered keyboard shortcut list is the one inside the shortcut help dialog, with no Shortcuts card on the start screen and no shortcut reference in About

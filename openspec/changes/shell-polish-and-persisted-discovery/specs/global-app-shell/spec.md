# Spec Delta

## MODIFIED Requirements

### Requirement: The sidebar provides four section entries

The sidebar SHALL provide entries for Home, Workspace, Catalog, Projects, and
About, targeting `#/`, `#/mcu/<PART_NUMBER>`, `#/catalog`, `#/projects`, and
`#/about`, with no word "screen" in any navigation label. Home and Projects
SHALL appear at the top followed by the recent-projects list. Catalog and About SHALL appear at the
bottom after a visual separator. The sidebar SHALL indicate the active
destination and SHALL remain usable while a workspace or shared pinout is open.

#### Scenario: Section entries navigate to their routes

- **WHEN** the user activates a section entry
- **THEN** the hash route for that destination opens and the entry is marked active

#### Scenario: Navigation works from pin-planning routes

- **WHEN** the user activates a section entry from a workspace or shared pinout
- **THEN** the destination opens without changing the saved pin configuration of that session

#### Scenario: Navigation labels drop the word screen

- **WHEN** the sidebar section entries are rendered
- **THEN** the labels are Home, Workspace, Catalog, Projects, and About without the word "screen", and Workspace appears next to Home in the top group

#### Scenario: Bottom group is separated

- **WHEN** the sidebar is viewed in either rail or expanded state
- **THEN** Home and Projects sit above the recent-projects list and Catalog and About form a bottom group preceded by a visual separator

#### Scenario: Workspace entry resolves its target

- **WHEN** a chip is loaded, or no chip is loaded and a recent session exists
- **THEN** activating Workspace opens `#/mcu/<PART_NUMBER>` for the chip or for the most recent session

#### Scenario: Workspace entry is visibly disabled

- **WHEN** no chip is loaded and no recent session exists
- **THEN** the Workspace entry is visibly disabled and activation does not change the route

#### Scenario: Workspace entry keeps sidebar geometry

- **WHEN** the Workspace entry is added to the single sidebar mount
- **THEN** the collapsed rail remains 3rem, the expanded panel remains an overlay with a backdrop, and no second sidebar is mounted

### Requirement: The catalog route browses all generated parts

The `#/catalog` route SHALL render a full-screen catalog browser over all
entries in `index.json` with search and vendor, family, and package filters.
Those filters SHALL be restored from browser-local storage on open and after a
reload, and clearing them SHALL clear the stored values. Selecting a part SHALL
open its workspace route through the existing catalog load and handoff path.
Catalog load failure SHALL remain retryable on this route.

#### Scenario: Catalog route lists available parts

- **WHEN** the catalog index has loaded and the user opens `#/catalog`
- **THEN** the route lists the generated parts with their vendor, package, and pin count information

#### Scenario: Catalog filters narrow the list

- **WHEN** the user enters a query or selects a vendor, family, or package filter
- **THEN** the browser shows only matching parts and clearing the filters restores the full list

#### Scenario: Part selection opens a workspace

- **WHEN** the user selects a listed part
- **THEN** the app opens `#/mcu/<PART_NUMBER>` and loads that part's chip data

#### Scenario: Catalog failure is retryable on the catalog route

- **WHEN** the catalog index cannot be loaded on `#/catalog`
- **THEN** the route shows a failure message with a retry control instead of an empty part list

#### Scenario: Catalog filters return after navigation

- **WHEN** the user sets filters, leaves the catalog route, and returns or reloads
- **THEN** the same query and vendor, family, and package filters are applied and the result list matches them

### Requirement: Shell preferences stay in localStorage

Sidebar expansion and the selected About tab SHALL be UI preferences persisted
only in localStorage. Their defaults SHALL be collapsed and the first About
tab. Catalog discovery filters and equivalent quick-search filters SHALL also
be UI preferences in localStorage, with default empty query, family, and
package values and an `all` vendor value. Neither these values nor the shell
values SHALL appear in share URLs, project JSON, recent session state, or undo
history.

#### Scenario: Shell preferences survive reload

- **WHEN** the sidebar is expanded and an About tab is selected and the page reloads
- **THEN** the same sidebar state and About tab are restored from localStorage

#### Scenario: Absent or unknown preference values use defaults

- **WHEN** the stored preference values are absent or unrecognized
- **THEN** the sidebar is collapsed and the first About tab is selected

#### Scenario: Shell preferences are never shared

- **WHEN** a workspace opened through the shell is shared or exported as project JSON
- **THEN** neither the payload nor the project JSON contains a sidebar or About tab field and all pin configuration is preserved

#### Scenario: Discovery filters are local only

- **WHEN** discovery filters are changed and the workspace is shared or exported
- **THEN** the filters persist across reload in localStorage and no filter field appears in a share URL or project file

#### Scenario: Discovery filters use defaults when storage is unavailable

- **WHEN** localStorage is unavailable or the stored filter record is malformed
- **THEN** discovery surfaces use their defaults without failing and in-memory filter changes still apply

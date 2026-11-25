# Spec Delta

## Purpose

Defines the global application shell: a collapsible sidebar available on every route, the catalog, projects, and about destinations, recent-project navigation, and the boundary between local shell preferences and shareable pin configuration.

## ADDED Requirements

### Requirement: A collapsible sidebar is present on every route

The shell SHALL render a left sidebar on the home, catalog, projects, about,
workspace, and shared routes. Its collapsed state SHALL be a narrow icon rail
that remains visible. Expanding the sidebar SHALL overlay page content without
shifting, resizing, or reflowing the canvas or any other content.

#### Scenario: Collapsed rail stays visible on every route

- **WHEN** the user opens any supported route with the sidebar collapsed
- **THEN** the narrow icon rail is visible and every sidebar entry remains reachable

#### Scenario: Expansion overlays without moving the page

- **WHEN** the user expands the sidebar while a page is open
- **THEN** the expanded panel overlays the page and the canvas, toolbars, and panes keep their prior geometry, pan, and zoom

#### Scenario: Collapse restores the unobstructed page

- **WHEN** the user collapses the sidebar
- **THEN** the overlay is removed and the underlying page content and state are unchanged

#### Scenario: Navigation keeps the sidebar state

- **WHEN** the user navigates to another route through the sidebar
- **THEN** the sidebar keeps its expanded or collapsed state and the new route renders with that state

### Requirement: The sidebar provides four section entries

The sidebar SHALL provide entries for Home screen, Catalog screen, Projects
screen, and About, targeting `#/`, `#/catalog`, `#/projects`, and `#/about`.
It SHALL indicate the active destination and SHALL remain usable while a
workspace or shared pinout is open.

#### Scenario: Section entries navigate to their routes

- **WHEN** the user activates a section entry
- **THEN** the hash route for that destination opens and the entry is marked active

#### Scenario: Navigation works from pin-planning routes

- **WHEN** the user activates a section entry from a workspace or shared pinout
- **THEN** the destination opens without changing the saved pin configuration of that session

### Requirement: Recent projects are listed in the sidebar

The sidebar recent-projects area SHALL list at most 10 sessions from
`pincraft:recent_sessions_v1` in the same order as the workspace store. Each
entry SHALL offer quick open and delete. Opening SHALL restore the saved pin
configuration through the existing workspace handoff.

#### Scenario: Recent projects are limited to ten

- **WHEN** more than 10 recent sessions are stored
- **THEN** the sidebar lists only the 10 most recent sessions from the store

#### Scenario: Quick open restores a session

- **WHEN** the user activates a recent project entry
- **THEN** the workspace opens for that MCU with the session's assignments, labels, locks, and modes restored

#### Scenario: Recent project delete updates the list

- **WHEN** the user deletes a recent project from the sidebar
- **THEN** that entry is removed from the sidebar and from the stored session list and no other session changes

#### Scenario: No recent projects

- **WHEN** no recent sessions are stored
- **THEN** the sidebar shows an empty-state message and no open or delete control for a session

### Requirement: The catalog route browses all generated parts

The `#/catalog` route SHALL render a full-screen catalog browser over all
entries in `index.json` with search and vendor, family, and package filters.
Selecting a part SHALL open its workspace route through the existing catalog
load and handoff path. Catalog load failure SHALL remain retryable on this
route.

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

### Requirement: New project opens the catalog

The start screen's New pinout MCU/Board action SHALL navigate to `#/catalog`.
The start screen's inline quick search, board preset control, imports, and
comparison action SHALL remain available.

#### Scenario: New project redirects to the catalog

- **WHEN** the user activates New pinout MCU/Board on the start screen
- **THEN** the app opens `#/catalog` instead of focusing only the inline search

#### Scenario: Start screen quick actions remain

- **WHEN** the user returns to the start screen
- **THEN** quick search, board presets, imports, and comparison remain available with their prior behavior

### Requirement: The projects route manages recent sessions

The `#/projects` route SHALL list recent sessions with open and delete controls
and SHALL provide import and export actions using the existing version-2
project parser and exporter. An empty list SHALL show guidance and a link to
the catalog or home screen.

#### Scenario: Projects route lists sessions

- **WHEN** recent sessions exist and the user opens `#/projects`
- **THEN** the route lists them with their MCU identifiers and open and delete controls

#### Scenario: Projects route opens and deletes sessions

- **WHEN** the user opens or deletes a listed session
- **THEN** the existing workspace handoff opens that session or the stored list loses only that entry

#### Scenario: Projects route imports a project file

- **WHEN** the user selects a valid version-2 pinout JSON file on `#/projects`
- **THEN** the parsed state is handed off and its workspace route opens

#### Scenario: Projects route exports a session

- **WHEN** the user exports a listed session
- **THEN** a version-2 project file is produced from that session's pin configuration

#### Scenario: Projects route has no sessions

- **WHEN** no recent sessions exist
- **THEN** the route shows a short hint and a link to the catalog or home screen

### Requirement: About presents provenance and shortcuts

The `#/about` destination SHALL present the catalog statistics, upstream source
revisions, licenses, and keyboard shortcut reference previously held by the
start-screen footer. It SHALL read live values from `meta.json` and SHALL NOT
contain pin configuration or shareable fields.

#### Scenario: About reports provenance

- **WHEN** generated metadata is available and the user opens About
- **THEN** the panel shows per-vendor counts, source revisions, licenses, and the indexed chip count

#### Scenario: About lists shortcuts

- **WHEN** the About panel is rendered
- **THEN** it lists `Ctrl+K`, `Ctrl+F`, `Ctrl+Click`, `Ctrl+Z`, `Ctrl+Y`, `0`, and `Escape` as text

#### Scenario: About tolerates missing metadata

- **WHEN** `meta.json` has not loaded or cannot be loaded
- **THEN** About shows a loading or unavailable state while the shortcut reference remains visible

#### Scenario: About carries no pin configuration

- **WHEN** About is rendered or left
- **THEN** no assignment, label, lock, mode, remap, or PIO field is written to a share URL or project file

### Requirement: Shell preferences stay in localStorage

Sidebar expansion and the selected About tab SHALL be UI preferences persisted
only in localStorage. Their defaults SHALL be collapsed and the first About
tab. Neither value SHALL appear in share URLs, project JSON, recent session
state, or undo history.

#### Scenario: Shell preferences survive reload

- **WHEN** the sidebar is expanded and an About tab is selected and the page reloads
- **THEN** the same sidebar state and About tab are restored from localStorage

#### Scenario: Absent or unknown preference values use defaults

- **WHEN** the stored preference values are absent or unrecognized
- **THEN** the sidebar is collapsed and the first About tab is selected

#### Scenario: Shell preferences are never shared

- **WHEN** a workspace opened through the shell is shared or exported as project JSON
- **THEN** neither the payload nor the project JSON contains a sidebar or About tab field and all pin configuration is preserved

### Requirement: Existing routes and data loading remain stable

Adding the shell and new routes SHALL NOT change workspace or shared-link
behavior, the start screen's three zones and quick actions, hash-based routing
under a GitHub Pages subpath, or data fetches through `dataUrl()`.

#### Scenario: Workspace routes remain unchanged

- **WHEN** the user opens `#/mcu/<PART_NUMBER>` from the shell or directly
- **THEN** the three-pane workspace opens with the same pin canvas, diagnostics, and export behavior

#### Scenario: Shared links remain unchanged

- **WHEN** the user opens a version-2 `#/s/<PAYLOAD>` link
- **THEN** the pinout hydrates in the workspace with the same state it has before this change

#### Scenario: Shell routes work under a subpath

- **WHEN** the built app is served under `/pincraft/` and a shell route is opened
- **THEN** the route resolves from the hash and data requests resolve relative to `import.meta.env.BASE_URL`

### Requirement: Shell surfaces meet source and verification constraints

Shell surfaces SHALL use existing theme tokens and monochrome vector icons,
SHALL add no npm dependency, SHALL contain no emoji, and SHALL keep raw color
literals in the vendored theme file. `npm test`, `npm run check`, and
`BASE_PATH="/pincraft/" npm run build` SHALL exit zero with no build warnings.

#### Scenario: Theme tokens cover the shell

- **WHEN** the user changes theme while the shell is expanded
- **THEN** the sidebar, catalog, projects, and About surfaces use the active theme tokens and remain readable

#### Scenario: Verification sequence passes

- **WHEN** the three verification commands are run after implementation
- **THEN** all three exit zero and the build resolves assets under `/pincraft/` without root-absolute data or asset paths

#### Scenario: No new raw colors or emoji

- **WHEN** changed source files are scanned
- **THEN** no color literal appears outside `src/themes/daisyui.css` and no emoji character appears

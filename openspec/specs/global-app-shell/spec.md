# global-app-shell Specification

## Purpose

Defines the global application shell: a collapsible sidebar available on every route, the catalog, projects, and about destinations, recent-project navigation, and the boundary between local shell preferences and shareable pin configuration.

## Requirements

### Requirement: A collapsible sidebar is present on every route

The shell SHALL render a left sidebar on all six routes with a collapsed 3rem
rail in reserved space and a top-bar expand/collapse control. Expansion SHALL
overlay content without reflow. The sidebar SHALL NOT render a separate brand
header with an app logo or PinSpec label; section navigation SHALL be its
first visible content.

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

#### Scenario: Collapsed rail reserves its width

- **WHEN** the user opens any supported route with the sidebar collapsed
- **THEN** the route content begins after the reserved 3rem rail and no content is covered by the rail

#### Scenario: Toggle is in the global bar

- **WHEN** the user looks for the sidebar control on any route
- **THEN** the control is the leftmost control of the global top bar and is not present in the rail header

#### Scenario: Navigation starts at the top

- **WHEN** the sidebar is opened on any supported route
- **THEN** the first visible block inside the panel is the section navigation and no separate logo or PinSpec label appears above it

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

### Requirement: Recent projects are listed in the sidebar

The sidebar recent-projects area SHALL list at most 10 sessions from
`pinspec:recent_sessions_v1` in the same order as the workspace store. Each
entry SHALL offer quick open and delete. Opening SHALL restore the saved pin
configuration through the existing workspace handoff. Each entry SHALL also
display its saved project name when present.

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

#### Scenario: Recent entry shows its project name

- **WHEN** a saved session carries a project name
- **THEN** its sidebar entry displays that name alongside the MCU identifier

#### Scenario: Recent entry without a name

- **WHEN** a saved session has no project-name field
- **THEN** its sidebar entry shows no name text and keeps its open and delete controls

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

The `#/projects` route SHALL render recent sessions as cards with open and
delete controls, not as table rows. Each card SHALL show a package thumbnail
derived from the saved package name and pin count, the MCU ID, package name,
assigned/total pins, and relative time. The route SHALL keep import and
export actions from the version-2 project parser and exporter and SHALL NOT
fetch shards for thumbnails. An empty list SHALL show guidance
and a link to the catalog or home screen.

#### Scenario: Projects route lists sessions

- **WHEN** recent sessions exist and the user opens `#/projects`
- **THEN** the route shows one card per session with its MCU identifier, package thumbnail, and open and delete controls

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

#### Scenario: Session cards show package details without shard fetches

- **WHEN** the projects route renders stored sessions
- **THEN** each card shows package name, assigned/total pins, and relative time alongside its thumbnail and no chip shard request is made

### Requirement: About presents provenance and shortcuts

The `#/about` destination SHALL present catalog statistics, upstream source
revisions, licenses, and the indexed total in one grouped Catalog sources
table. It SHALL read live values from `meta.json`, SHALL keep loading and retry
states on that merged surface, SHALL NOT contain a separate summary card or any
keyboard shortcut reference, and SHALL NOT contain pin configuration or
shareable fields. The sidebar Hotkeys dialog SHALL be the only keyboard shortcut
reference.

#### Scenario: About reports provenance

- **WHEN** generated metadata is available and the user opens About
- **THEN** the merged table shows per-vendor counts, match and coverage ratios, sync time, nested source ids, revisions, licenses, links, and the indexed total in its header

#### Scenario: About lists shortcuts

- **WHEN** the About panel is rendered in any tab or metadata state
- **THEN** it lists no shortcut key, shortcut action, inline shortcut summary, or Shortcuts tab

#### Scenario: About tolerates missing metadata

- **WHEN** `meta.json` has not loaded or cannot be loaded
- **THEN** About shows a loading or unavailable state with a retry control on the merged table and no shortcut reference as a fallback

#### Scenario: About carries no pin configuration

- **WHEN** About is rendered or left
- **THEN** no assignment, label, lock, mode, remap, or PIO field is written to a share URL or project file

#### Scenario: About keeps non-shortcut tabs

- **WHEN** the About tab strip is rendered
- **THEN** only non-shortcut tabs are offered and the Sources tab remains available

#### Scenario: Hotkeys dialog is the only shortcut reference

- **WHEN** the user looks for keyboard shortcuts from any shell route or the start screen
- **THEN** the sidebar Hotkeys entry opens the shared dialog as the only shortcut reference, and neither the start screen nor About repeats the shortcut list

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

### Requirement: Existing routes and data loading remain stable

Adding the global top bar and the reserved rail SHALL NOT change workspace or
shared-link behavior, the start screen's three zones and quick actions,
hash-based routing under a GitHub Pages subpath, or data fetches through
`dataUrl()`. Pin configuration SHALL remain shareable and presentation
preferences SHALL remain in localStorage only. A presentation-only start-screen
rework SHALL add no route, feature, or shareable field and SHALL keep one top bar
and `.landing-shell`.

#### Scenario: Workspace routes remain unchanged

- **WHEN** the user opens `#/mcu/<PART_NUMBER>` from the shell or directly
- **THEN** the three-pane workspace opens with the same pin canvas, diagnostics, and export behavior

#### Scenario: Shared links remain unchanged

- **WHEN** the user opens a version-2 `#/s/<PAYLOAD>` link
- **THEN** the pinout hydrates in the workspace with the same state it has before this change

#### Scenario: Shell routes work under a subpath

- **WHEN** the built app is served under `/pinspec/` and a shell route is opened
- **THEN** the route resolves from the hash and data requests resolve relative to `import.meta.env.BASE_URL`

#### Scenario: Global bar preserves persistence

- **WHEN** the user navigates through the global bar or toggles the sidebar
- **THEN** no presentation field enters a share URL or project file and all pin configuration is preserved

#### Scenario: Landing presentation pass preserves shell contracts

- **WHEN** the start screen zones are reworked for density and hierarchy
- **THEN** the three zones, quick actions, single global top bar, hash routing, and `dataUrl()` fetches remain unchanged and no new shareable state is introduced

### Requirement: Shell surfaces meet source and verification constraints

Shell surfaces SHALL use existing theme tokens and bold duotone vector icons, SHALL add no npm dependency other than the single icon package, SHALL contain no emoji, and SHALL keep raw color literals in the vendored theme file. Catalog and projects thumbnails SHALL be static inline SVG with no interaction handler, no raw color literal, and no texture primitive. `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` SHALL exit zero with no build warnings.

#### Scenario: Theme tokens cover the shell

- **WHEN** the user changes theme while the shell is expanded
- **THEN** the sidebar, catalog, projects, and About surfaces use the active theme tokens and remain readable

#### Scenario: Verification sequence passes

- **WHEN** the three verification commands are run after implementation
- **THEN** all three exit zero and the build resolves assets under `/pinspec/` without root-absolute data or asset paths

#### Scenario: No new raw colors or emoji

- **WHEN** changed source files are scanned
- **THEN** no color literal appears outside `src/themes/daisyui.css` and no emoji character appears

#### Scenario: Texture effects stay in the two package renderers

- **WHEN** all Svelte sources are scanned for texture primitives
- **THEN** matches exist only inside `PerimeterPackage.svelte` and `GridPackage.svelte` and no thumbnail component adds one

#### Scenario: Shell icons use the single icon package

- **WHEN** shell and route source files are scanned for icon imports
- **THEN** every icon comes from the single bold duotone package and no retired icon library import remains

#### Scenario: Sidebar icons use the accent token

- **WHEN** the sidebar is rendered in rail or expanded state with a non-active section
- **THEN** that section's icon resolves to the accent token and remains legible in both bundled themes

#### Scenario: Section labels keep their foreground treatment

- **WHEN** the sidebar renders an active or inactive section
- **THEN** the label inherits the link foreground treatment and is not colored by the icon accent class

#### Scenario: Active route icons keep info highlighting

- **WHEN** a sidebar section matches the current route
- **THEN** its icon resolves to the `info` token while its label keeps the existing active foreground treatment

### Requirement: Catalog result rows lead with a package thumbnail

The catalog result table SHALL add a leading 40-48px package thumbnail column while keeping its dense layout, ranking, 500-result cap, filters, load states, and Open handoff. A silhouette derived from index data SHALL appear immediately; exact geometry SHALL refine only visible rows with at most four shard loads in flight and a fixed per-pass cap through the catalog store. The thumbnail SHALL be decorative and SHALL NOT navigate.

#### Scenario: Every result row has a leading thumbnail

- **WHEN** catalog results are rendered
- **THEN** each row begins with a 40-48px decorative package thumbnail and the existing Part, Vendor, Family, Package, Pins, Flash / RAM, and Open cells follow it

#### Scenario: Thumbnail refinement stays bounded

- **WHEN** the result set contains more parts than are visible
- **THEN** only visible rows are refined from shards, with at most four loads in flight and a fixed per-pass cap, and the 500-result cap and filter behavior are unchanged

#### Scenario: Thumbnail is not a navigation control

- **WHEN** the user clicks a thumbnail in a result row
- **THEN** no route changes and only the existing Open control opens the workspace

### Requirement: Shared dialogs mount once in the global shell

The global shell SHALL mount once every dialog with more than one owner:
`PinoutDiffModal` and `ShortcutHelpDialog`. One typed value in the transient
top-bar store SHALL own their state and back the existing boolean accessors.
Dialog state SHALL stay out of localStorage, share URLs, and project files.

#### Scenario: Compare opens from either owner

- **WHEN** the start-screen Compare action or the global bar compare action is activated
- **THEN** the one shared `PinoutDiffModal` in `AppShell` opens and closing it clears the shared owner

#### Scenario: One help dialog on every route

- **WHEN** Hotkeys is activated from the sidebar, the bar, or the keyboard
- **THEN** the one shared `ShortcutHelpDialog` in `AppShell` opens over the current route and focus returns to its opener on close

### Requirement: Shortcut reference is complete

The shared shortcut list SHALL include the `?` key that opens the help dialog
and SHALL name the part search, pin search, and MCU switcher actions exactly as
they appear on their controls. The reference SHALL remain owned by the shared
dialog and SHALL NOT be repeated on About or the landing page.

#### Scenario: Help lists its own trigger

- **WHEN** the shortcut dialog is opened with `?` or from the sidebar
- **THEN** the list includes `?` with an action describing the shortcut dialog

#### Scenario: No duplicate shortcut reference

- **WHEN** About, the landing page, or any shell route other than the dialog is inspected
- **THEN** none renders its own shortcut list

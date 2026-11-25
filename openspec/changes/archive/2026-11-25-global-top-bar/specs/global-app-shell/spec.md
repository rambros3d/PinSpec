# Spec Delta

## MODIFIED Requirements

### Requirement: A collapsible sidebar is present on every route

The shell SHALL render a left sidebar on the home, catalog, projects, about,
workspace, and shared routes. Its collapsed state SHALL be a narrow 3rem icon
rail that remains visible in reserved horizontal space so it never covers route
content. The expand/collapse control SHALL live in the global top bar. Expanding
the sidebar SHALL overlay page content with a backdrop without shifting,
resizing, or reflowing the canvas or any other content.

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

### Requirement: The sidebar provides four section entries

The sidebar SHALL provide entries for Home, Catalog, Projects, and About,
targeting `#/`, `#/catalog`, `#/projects`, and `#/about`, with no word "screen" in
any navigation label. Home and Projects SHALL appear at the top followed by the
recent-projects list. Catalog and About SHALL appear at the bottom after a visual
separator. The sidebar SHALL indicate the active destination and SHALL remain
usable while a workspace or shared pinout is open.

#### Scenario: Section entries navigate to their routes

- **WHEN** the user activates a section entry
- **THEN** the hash route for that destination opens and the entry is marked active

#### Scenario: Navigation works from pin-planning routes

- **WHEN** the user activates a section entry from a workspace or shared pinout
- **THEN** the destination opens without changing the saved pin configuration of that session

#### Scenario: Navigation labels drop the word screen

- **WHEN** the sidebar section entries are rendered
- **THEN** the labels are Home, Catalog, Projects, and About without the word "screen"

#### Scenario: Bottom group is separated

- **WHEN** the sidebar is viewed in either rail or expanded state
- **THEN** Home and Projects sit above the recent-projects list and Catalog and About form a bottom group preceded by a visual separator

### Requirement: Existing routes and data loading remain stable

Adding the global top bar and the reserved rail SHALL NOT change workspace or
shared-link behavior, the start screen's three zones and quick actions,
hash-based routing under a GitHub Pages subpath, or data fetches through
`dataUrl()`. Pin configuration SHALL remain shareable and presentation
preferences SHALL remain in localStorage only.

#### Scenario: Workspace routes remain unchanged

- **WHEN** the user opens `#/mcu/<PART_NUMBER>` from the shell or directly
- **THEN** the three-pane workspace opens with the same pin canvas, diagnostics, and export behavior

#### Scenario: Shared links remain unchanged

- **WHEN** the user opens a version-2 `#/s/<PAYLOAD>` link
- **THEN** the pinout hydrates in the workspace with the same state it has before this change

#### Scenario: Shell routes work under a subpath

- **WHEN** the built app is served under `/pincraft/` and a shell route is opened
- **THEN** the route resolves from the hash and data requests resolve relative to `import.meta.env.BASE_URL`

#### Scenario: Global bar preserves persistence

- **WHEN** the user navigates through the global bar or toggles the sidebar
- **THEN** no presentation field enters a share URL or project file and all pin configuration is preserved

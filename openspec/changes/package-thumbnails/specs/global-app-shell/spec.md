# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Shell surfaces meet source and verification constraints

Shell surfaces SHALL use existing theme tokens and monochrome vector icons,
SHALL add no npm dependency, SHALL contain no emoji, and SHALL keep raw color
literals in the vendored theme file. Catalog and projects thumbnails SHALL be
static inline SVG with no interaction handler, no raw color literal, and no
texture primitive. `npm test`, `npm run check`, and
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

#### Scenario: Texture effects stay in the two package renderers

- **WHEN** all Svelte sources are scanned for texture primitives
- **THEN** only `PerimeterPackage.svelte` and `GridPackage.svelte` contain `feTurbulence` and no thumbnail component adds one

# package-thumbnails Specification

## Purpose

Defines package outline thumbnails in catalog results and recent-session cards: an immediate silhouette from index data, visible-row refinement from generated shards, and the rendering, fetch, and persistence boundaries that keep thumbnails out of shareable state.

## Requirements

### Requirement: The catalog table has a leading thumbnail column

The catalog route SHALL keep its dense result table and add a leading package thumbnail column sized between 40px and 48px. Existing columns, the 500-result cap, query/vendor/family/package filters, retry, loading, and empty states, and the Open workspace handoff SHALL remain. The thumbnail SHALL be decorative and non-interactive. Clicking a thumbnail SHALL NOT open a workspace; only the Open control SHALL navigate.

#### Scenario: Leading column is present

- **WHEN** catalog results are rendered
- **THEN** each row begins with a 40-48px package thumbnail followed by the existing Part, Vendor, Family, Package, Pins, Flash / RAM, and Open cells

#### Scenario: Dense table behavior is unchanged

- **WHEN** the user searches, changes a vendor/family/package filter, clears filters, or scrolls the result set
- **THEN** the same ranking, 500-result cap, and table layout apply as before the thumbnail column

#### Scenario: Thumbnail is not an action

- **WHEN** the user clicks or focuses a thumbnail inside a result row
- **THEN** no navigation or state change occurs and only the Open control opens the workspace

#### Scenario: Non-result states remain unchanged

- **WHEN** the index is loading, fails to load, or matches no parts
- **THEN** the existing loading text, retry control, or empty message is shown without thumbnail rows

### Requirement: The projects route shows recent sessions as cards

The projects route SHALL render recent sessions as cards instead of table rows. Each card SHALL show a package thumbnail derived from the saved package name and pin count, the MCU ID, package name, assigned/total pins, relative time, and Open, Export, and Delete controls. The existing 10-session limit, import, New project, empty-state guidance, and workspace handoff SHALL remain. The projects route SHALL NOT fetch chip shards for thumbnails.

#### Scenario: Session cards carry package information

- **WHEN** recent sessions exist and the projects route is opened
- **THEN** each session is shown as a card with a package thumbnail, MCU ID, package name, assigned/total pin counts, relative updated time, and Open, Export, and Delete controls

#### Scenario: Existing session actions remain

- **WHEN** the user opens, exports, imports, creates, or deletes a session from the projects route
- **THEN** the existing workspace handoff, version-2 exporter/parser, empty-state guidance, and stored-list update behavior apply unchanged

#### Scenario: Session limit is unchanged

- **WHEN** more than 10 recent sessions are stored
- **THEN** only the 10 most recent sessions are shown as cards

#### Scenario: Projects thumbnails do not fetch shards

- **WHEN** the projects route renders any number of cards
- **THEN** no chip shard request is made and every thumbnail is derived from the saved session fields

### Requirement: Thumbnails are static and theme-token driven

A thumbnail SHALL be a static inline SVG with no click, pointer, or keyboard handlers and no focusable element. It SHALL use existing theme-token utility classes for body and pad shapes, SHALL contain no raw color literal, emoji, SVG filter, or texture primitive, and SHALL NOT add an npm dependency. The texture restriction that limits the filter primitive to the two interactive package renderers SHALL remain true.

#### Scenario: No interaction surface

- **WHEN** a thumbnail SVG is inspected in either surface
- **THEN** it has no click or pointer handler, no keyboard handler, no tabindex, and no focusable child

#### Scenario: Theme colors only

- **WHEN** the user switches between light and dark themes
- **THEN** the thumbnail body and pad shapes follow the active theme tokens and remain readable without a raw color literal

#### Scenario: No texture filter

- **WHEN** thumbnail source is scanned
- **THEN** it contains no SVG filter or `feTurbulence` primitive and the two interactive package renderers remain the only files with that primitive

#### Scenario: No new dependency

- **WHEN** the dependency manifests are compared before and after the change
- **THEN** no package is added and icons and utilities continue to come from the existing stack

### Requirement: Thumbnail state is not shareable or persisted

Thumbnail geometry, refinement results, approximation fidelity, and visibility SHALL NOT enter share URLs, version-2 project JSON, workspace state, undo history, or recent-session storage. No new localStorage preference SHALL be introduced; display state SHALL be component-local and reset on route teardown. Data fetches SHALL continue to resolve through the existing base-URL-aware catalog path so workspaces work under `/pinspec/`.

#### Scenario: Share and export stay unchanged

- **WHEN** a workspace opened from a catalog row or project card is shared or exported
- **THEN** neither the share payload nor the project JSON contains a thumbnail, fidelity, or geometry field and all pin configuration is preserved

#### Scenario: No new persisted preference or session field

- **WHEN** localStorage keys and stored records are inspected after using thumbnails
- **THEN** no new key exists and the recent-session and view-preference records keep their prior shapes

#### Scenario: Subpath fetches remain catalog-owned

- **WHEN** the catalog is served under `/pinspec/` with any number of rows
- **THEN** no chip shard request is made for a thumbnail, and workspace shard fetches still resolve relative to `import.meta.env.BASE_URL` without a root-absolute data or asset path

### Requirement: Package outlines come from generated index geometry

A package thumbnail SHALL be derived from the exact geometry fields on its catalog index entry: perimeter side counts, grid rows and columns, and exposed-pad flag. A plain rectangular outline SHALL remain the fallback for unknown geometry. Session cards SHALL continue to derive outlines from saved package name and pin count without shard fetches. No part table, hardcoded identifier, or datasheet value SHALL be introduced.

#### Scenario: Exact index geometry renders immediately

- **WHEN** a catalog index entry declares perimeter sides or grid rows and columns
- **THEN** its thumbnail shows those exact pads or balls and any declared exposed pad before any other request

#### Scenario: Missing geometry falls back safely

- **WHEN** an index entry has absent or non-finite geometry values
- **THEN** its thumbnail uses a plain body outline, all emitted numbers stay finite, and the row remains usable

#### Scenario: No hardcoded part facts

- **WHEN** the thumbnail helper source is inspected
- **THEN** it contains no part identifier, approximate-grid guess, or generated shard geometry conversion

# Spec Delta

## Purpose

Defines package outline thumbnails in catalog results and recent-session cards: an immediate silhouette from index data, visible-row refinement from generated shards, and the rendering, fetch, and persistence boundaries that keep thumbnails out of shareable state.

## ADDED Requirements

### Requirement: An approximate package silhouette is available from index data

A package thumbnail SHALL be available for every catalog result before any shard is fetched. Its silhouette SHALL be derived by a pure helper from existing index fields only: package string, pin count, vendor, and module marker. Rules SHALL be deterministic for four-sided, two-sided, grid, and unknown packages. A grid silhouette SHALL be approximate and SHALL NOT claim exact ball positions. No part table, generated field, or datasheet value SHALL be introduced.

#### Scenario: Four-sided package silhouette

- **WHEN** a catalog entry declares an LQFP or QFN package string and a pin count
- **THEN** its thumbnail immediately shows a four-sided outline with pad marks distributed around the four sides before any shard request

#### Scenario: Two-sided package silhouette

- **WHEN** a catalog entry declares an SOP, SO, DIP, SSOP, or TSSOP package string
- **THEN** its thumbnail shows two vertical pad rows rather than four equal sides

#### Scenario: Grid package silhouette is approximate

- **WHEN** a catalog entry declares a BGA, WLCSP, or CSP package string
- **THEN** its thumbnail shows an approximate square ball outline sized from the pin count without claiming exact ball labels or row identifiers

#### Scenario: Unknown package string falls back

- **WHEN** a catalog entry has a package string that matches none of the known rules
- **THEN** its thumbnail shows a plain rectangular outline and the catalog row remains usable

#### Scenario: No per-chip facts are added

- **WHEN** silhouettes are derived for the whole index
- **THEN** no helper reads a hardcoded part table, invents a datasheet value, or requires a new generated data field

### Requirement: Exact geometry refines only visible catalog rows

Exact package geometry SHALL refine a thumbnail only for visible catalog rows. A refinement pass SHALL enqueue only visible, not-yet-refined parts, keep at most four shard loads in flight, cap each pass at a fixed limit, and fetch each shard only through the catalog store's chip loader. A generation token SHALL invalidate stale results on query, filter, result-set, or teardown changes. Failed shards SHALL keep the approximate silhouette. No pass SHALL fetch all results or all shards.

#### Scenario: Only visible results are requested

- **WHEN** the catalog displays up to 500 results and only a small subset is visible
- **THEN** only those visible results are enqueued and no shard request is made for offscreen results

#### Scenario: Bounded concurrency and pass cap

- **WHEN** more visible results are pending than the concurrency or pass limit
- **THEN** at most four shard loads are in flight and the pass stops at the fixed cap while remaining rows keep their approximate silhouettes

#### Scenario: Exact geometry replaces approximation

- **WHEN** a visible part's shard resolves while its generation is current
- **THEN** the thumbnail uses that shard's package kind, side counts, grid rows and columns, and exposed-pad declaration instead of the approximate silhouette

#### Scenario: Stale results are discarded

- **WHEN** a query, vendor/family/package filter, or result-set change replaces the visible rows while shard loads are pending
- **THEN** the generation changes and late results are not applied to the new row set

#### Scenario: Failed shard keeps the outline

- **WHEN** a visible part's shard request fails or the part has no shard
- **THEN** its thumbnail keeps the approximate silhouette and the catalog table stays usable without an error banner

#### Scenario: Teardown cancels refinement

- **WHEN** the catalog route is left while shard loads are pending
- **THEN** the generation changes and no late result updates a destroyed view

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

Thumbnail geometry, refinement results, approximation fidelity, and visibility SHALL NOT enter share URLs, version-2 project JSON, workspace state, undo history, or recent-session storage. No new localStorage preference SHALL be introduced; display state SHALL be component-local and reset on route teardown. Data fetches SHALL continue to resolve through the existing base-URL-aware catalog path so thumbnails work under `/pinspec/`.

#### Scenario: Share and export stay unchanged

- **WHEN** a workspace opened from a thumbnail-bearing catalog row or project card is shared or exported
- **THEN** neither the share payload nor the project JSON contains a thumbnail, fidelity, or geometry field and all pin configuration is preserved

#### Scenario: No new persisted preference or session field

- **WHEN** localStorage keys and stored records are inspected after using thumbnails
- **THEN** no new key exists and the recent-session and view-preference records keep their prior shapes

#### Scenario: Subpath fetches remain catalog-owned

- **WHEN** the built app is served under `/pinspec/` and a thumbnail is refined
- **THEN** the shard fetch resolves relative to `import.meta.env.BASE_URL` and no root-absolute data or asset path is used

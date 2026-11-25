# Spec Delta

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: An approximate package silhouette is available from index data

**Reason**: Generated index entries now carry exact package geometry, so approximating silhouettes from package strings adds an unnecessary, less accurate path.

**Migration**: Render thumbnails from `CatalogIndexEntry.geometry`, which the six adapters derive from their generated chip package data. Session cards keep their saved-field fallback helper.

### Requirement: Exact geometry refines only visible catalog rows

**Reason**: Per-row shard refinement fetched shards only for presentation and required visibility observers, concurrency limits, generation tokens, and failure fallbacks. Exact geometry is now in the index.

**Migration**: Remove the refinement pass and render exact geometry from the index entry directly. Chip shards remain lazily fetched only for workspace and compatibility operations.

## MODIFIED Requirements

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

Thumbnail geometry, refinement results, approximation fidelity, and visibility SHALL NOT enter share URLs, version-2 project JSON, workspace state, undo history, or recent-session storage. No new localStorage preference SHALL be introduced; display state SHALL be component-local and reset on route teardown. Data fetches SHALL continue to resolve through the existing base-URL-aware catalog path so workspaces work under `/pincraft/`.

#### Scenario: Share and export stay unchanged

- **WHEN** a workspace opened from a catalog row or project card is shared or exported
- **THEN** neither the share payload nor the project JSON contains a thumbnail, fidelity, or geometry field and all pin configuration is preserved

#### Scenario: No new persisted preference or session field

- **WHEN** localStorage keys and stored records are inspected after using thumbnails
- **THEN** no new key exists and the recent-session and view-preference records keep their prior shapes

#### Scenario: Subpath fetches remain catalog-owned

- **WHEN** the catalog is served under `/pincraft/` with any number of rows
- **THEN** no chip shard request is made for a thumbnail, and workspace shard fetches still resolve relative to `import.meta.env.BASE_URL` without a root-absolute data or asset path

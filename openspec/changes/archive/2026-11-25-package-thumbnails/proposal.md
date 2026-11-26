# Proposal

## Why

The catalog lists up to 500 generated parts in a dense text-only table, and the projects route lists recent sessions in rows. Neither surface shows the physical package shape, so a user scanning results has to read the package string or open a part to tell a four-sided QFP from a two-sided SOP or a grid BGA. The generated index already carries the package string and pin count; full package geometry exists only in per-chip shards that are fetched when a workspace opens. A package outline can be drawn for every row from index data and refined from shards only for rows that are actually visible.

## What Changes

- Add a leading 40-48px package thumbnail column to the dense catalog result table. The existing Part, Vendor, Family, Package, Pins, Flash / RAM, and Open columns, the 500-result cap, local filters, retry/loading/empty states, and workspace handoff stay unchanged.
- Render the thumbnail first as an approximate silhouette derived by a pure core helper from existing `index.json` fields only: package string, pin count, vendor, and module marker. No generated field, per-chip table, or datasheet value is added.
- Refine only visible catalog rows: fetch the shard through `catalogStore.loadChip()` with bounded concurrency (reusing `MAX_CONCURRENT_SHARD_LOADS`), a fixed per-pass cap, and a generation token that cancels stale results when results, filters, query, or the component change. A failed shard keeps its approximate silhouette. No pass fetches all results or all shards, and thumbnails do not depend on the uncapped `chipCache` for correctness.
- Change the projects route from a table to a card view. Each card shows a package thumbnail, MCU ID, package name, assigned/total pins, relative time, and Open, Export, and Delete controls. Import, New project, empty state, the 10-session limit, and the existing workspace handoff stay unchanged.
- Make the thumbnail a non-interactive inline SVG that uses existing theme-token utility classes. No SVG filter or texture primitive, no pointer or keyboard handlers, no raw color literal, no emoji, and no npm dependency.
- Keep version-2 share links, project JSON, recent-session storage, workspace state, and undo history unchanged. Thumbnail display and refinement state is component-local; no new localStorage preference is introduced.
- Update the static test contracts deliberately and add pure unit tests for geometry derivation, bounded refinement, cancellation, and the fetch budget.

## Capabilities

### New Capabilities

- `package-thumbnails`: Package outline thumbnails in the catalog and projects surfaces, index-only silhouette derivation, visible-row shard refinement, non-interactive themed SVG, and the fetch and persistence boundaries that keep thumbnails out of shareable state.

### Modified Capabilities

- `global-app-shell`: The catalog route gains a leading thumbnail column while keeping its dense table and load states. The projects route changes from a list to session cards while keeping import, export, handoff, and empty-state behavior. Source and verification constraints now cover thumbnails.
- `multi-vendor-workspace`: Full package geometry from shards (`kind`, `sides`, `rows`, `cols`, `hasExposedPad`) also drives a non-interactive thumbnail surface without changing the interactive package renderers, their mux/bonded/exposed-pad behavior, or their theme and texture constraints.

`pinspec-start-screen` is not modified. Its three zones, quick search, presets, recent-session list, and no-preview contract remain unchanged, and no thumbnail or shard fetch is added to `#/`.

## Impact

- Files: new `src/core/package-thumbnail.ts`, new `src/components/catalog/PackageThumbnail.svelte`, `src/pages/CatalogPage.svelte`, `src/pages/ProjectsPage.svelte`, a small component-local refinement helper, new `tests/package-thumbnails.test.ts`, `tests/global-app-shell.test.ts`, `tests/ui-multi-vendor.test.ts`, and `README.md`.
- Data: no generator, shard, index, `meta.json`, or `build-warnings.json` change. All runtime fetches continue through `catalogStore` and `dataUrl()` with `import.meta.env.BASE_URL`.
- State: no share, project, workspace, undo, or recent-session schema change. No new localStorage preference; refinement state is component-local and cancelled on teardown.
- Dependencies: none added. Colors come from existing theme utilities; icons remain `lucide-svelte` where used.
- Verification: `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` must pass with zero warnings, after which the implementation agent archives the change. This planning artifact makes no commit.

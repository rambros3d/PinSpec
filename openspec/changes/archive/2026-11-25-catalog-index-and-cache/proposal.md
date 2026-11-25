# Proposal

## Why

Catalog rows fetch chip shards only to draw an approximate outline, even though the generator already has exact package geometry in every shard. The compact index also carries fields no runtime surface reads, chip loads have no dedupe or eviction, and CI re-clones large upstream repositories on every build. These costs are avoidable without changing pin-planning behavior.

## What Changes

- **BREAKING**: `index.json` entries now carry `vendor` and exact `geometry` (`kind`, `sides`, `rows`, `cols`, `hasExposedPad`) derived by each adapter from its generated `ChipData.package`. `peripherals` counts and `series` are removed from index entries. The version-2 share/project schema is unchanged.
- Catalog thumbnails render exact geometry directly from the index entry. The visible-row `IntersectionObserver` refinement, generation token, `mapWithConcurrency` refinement pass, and per-thumbnail shard fetch are removed. Filters, table columns, 500-result cap, click-through, and projects cards stay unchanged.
- All display and filter paths read `entry.vendor` directly; the `?? 'stm32'` fallback is removed now that every entry declares a vendor.
- `chipCache` deduplicates in-flight loads, caps retained chips with LRU eviction, and accepts an optional `AbortSignal` while keeping `loadChip(id)` compatible. Generation-token callers pass abort signals.
- CI caches `.cache/` keyed on source declarations and the lockfile, still force-refreshing on the weekly schedule. Nordic SVDs are fetched as three raw files instead of cloning `nrf-pacs`; duplicate Zephyr declarations collapse into one source id and cache directory without losing provenance.

## Capabilities

### New Capabilities

- `catalog-index-geometry`: Generated index entries carry exact, adapter-derived package geometry and an explicit vendor; catalog and session thumbnails render from stored/index data with no runtime shard fetch.
- `catalog-chip-cache`: Catalog chip-shard loading deduplicates concurrent requests, bounds memory with LRU eviction, and supports cancellation for callers with generation tokens.

### Modified Capabilities

- `package-thumbnails`: Replace approximate index silhouettes and visible-row shard refinement with exact geometry from index data; retain decorative themed SVG and no-shard-fetch session cards.
- `ci-data-generation`: Cache acquired sources in Actions, acquire Nordic SVDs as raw files, consolidate Zephyr declarations, and keep weekly refresh and STM32 shard byte-stability.
- `multi-vendor-ci-gates`: Extend shard-integrity checks to require and validate index geometry and explicit vendors, replacing removed `peripherals`/`series` index fields.

## Impact

- `src/core/types.ts`, `src/core/package-thumbnail.ts`, `src/core/vendor-view.ts`, `src/state/catalog.svelte.ts`
- `src/pages/CatalogPage.svelte`, `src/pages/ProjectsPage.svelte`, `src/components/catalog/PackageThumbnail.svelte`, `src/components/workspace/CompatibleMcuFinder.svelte`, `src/components/workspace/PinoutDiffModal.svelte`, `src/components/landing/QuickSearchBar.svelte`, `src/components/workspace/McuSwitcherModal.svelte`, `src/components/workspace/PackageCanvas.svelte`
- All six adapters in `tools/data-gen/adapters/`, `tools/data-gen/gates.ts`, `tools/data-gen/sources.ts`, `tools/data-gen/artifacts.ts`, Nordic adapter readers/gates
- `.github/workflows/deploy.yml`, README/AGENTS generated-index and source descriptions, and the affected Vitest suites
- No new dependencies, no backend, no new persisted UI preference, no changes to share/project schema

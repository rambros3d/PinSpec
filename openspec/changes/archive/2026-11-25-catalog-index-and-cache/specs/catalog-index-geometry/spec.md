# Spec Delta

## Purpose

Defines the generated catalog index as the single source for package geometry and vendor identity, so catalog outlines are exact immediately and no chip shard is fetched for presentation.

## ADDED Requirements

### Requirement: Index entries carry generated vendor and exact package geometry

Every `index.json` entry SHALL declare an explicit `vendor` and a `geometry` object with `kind` (`perimeter` or `grid`), `sides` as four pad counts, `rows` and `cols` for grids, and `hasExposedPad`. These values SHALL be copied from the generated chip's `package` by the emitting vendor adapter and MUST NOT be hand-authored. Index entries SHALL NOT carry peripheral counts or an upstream `series` field.

#### Scenario: Adapter emits geometry from its own chip data

- **WHEN** any of the six adapters emits an index entry
- **THEN** the entry geometry equals that adapter's generated `ChipData.package` kind, sides, rows, columns, and exposed-pad flag, and the entry has an explicit vendor

#### Scenario: Compact index shape is stable

- **WHEN** `index.json` is generated for all vendors
- **THEN** every entry contains `vendor`, `geometry`, `id`, `family`, `core`, `package`, `pinCount`, `flashKb`, and `ramKb` and no `peripherals` or `series` key

#### Scenario: STM32 shards are unchanged

- **WHEN** the STM32 catalog is regenerated from the same pinned sources
- **THEN** every STM32 chip shard is byte-identical to the prior generation; only index and metadata shape changes

### Requirement: Catalog thumbnails render exact geometry without shard fetches

The catalog SHALL render each leading package thumbnail from its index entry geometry. Query, vendor/family/package filters, result ranking, the 500-result cap, retry/loading/empty states, decorative SVG behavior, and the Open control SHALL remain unchanged. No thumbnail path SHALL fetch a chip shard, observe row visibility, or maintain a refinement generation token.

#### Scenario: Exact outline is present on first paint

- **WHEN** a catalog row renders from the generated index
- **THEN** its thumbnail uses the entry's exact side counts, grid rows/columns, and exposed pad without any shard request

#### Scenario: No refinement machinery remains

- **WHEN** catalog and thumbnail sources are inspected
- **THEN** they contain no `IntersectionObserver`, visibility-id list, refinement cap, concurrency pass, or `loadChip()` call for thumbnails

#### Scenario: Table and navigation are unchanged

- **WHEN** the user filters, sorts by query relevance, or clicks a row's Open control
- **THEN** the same results and workspace handoff apply as before and a thumbnail click performs no navigation

### Requirement: Vendor identity is explicit at every display and filter site

Every catalog index entry declares a vendor, so search, tabs, compatibility filtering, and badges SHALL read `entry.vendor` directly. No display or filter path SHALL synthesize a default vendor with a nullish fallback.

#### Scenario: Filters use the generated vendor

- **WHEN** a vendor tab or compatibility filter is applied
- **THEN** entries are matched against their declared `vendor` value without a fallback branch

#### Scenario: Badge shows the generated vendor

- **WHEN** a catalog row, quick-search result, MCU-switcher result, or compatibility candidate is displayed
- **THEN** its vendor badge shows the entry's declared vendor

# Design

## Context

The catalog build runs one orchestrator over `DEFAULT_ADAPTERS`. Each adapter declares source specs, emits `ChipData` shards and index entries, contributes gates, and records warnings through a shared collector. The orchestrator owns all writes to `public/data/` and evaluates per-vendor gates before global gates, so a failing vendor aborts without publishing a partial catalog. Provenance is stored in `meta.json` under `sources`, keyed by vendor for legacy consumers and by `CatalogSourceId` for the canonical registry. Thirteen canonical ids and six vendor summaries exist after the SAM change; `canonicalSourceId` deliberately collapses related source specs, and `buildSourceRegistry` keeps the first declaration after sources are sorted by spec id.

Nordic facts live in three machine-readable formats. The nrf-pacs SVD supplies peripherals, registers, interrupts, and memory, but no physical pins. The Zephyr device tree supplies peripheral inventory, interrupts, and `ngpios`, and its pinctrl binding and header define PSEL function names and constants. The KiCad Nordic symbol supplies physical pin numbers, ball identifiers, and multi-function names. No generated Nordic JSON database exists, and PSEL routing has no numbered AF. See `proposal.md` for motivation and the two delta specs for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Convert the Nordic pilot selectors into deterministic, provenance-tagged shards and index entries.
- Preserve upstream names and physical positions verbatim, including ball identifiers and multi-function labels.
- Emit every chip fact from the three acquired sources; record any unfounded gap as a warning.
- Add one canonical source id and a `nordic` vendor summary without displacing existing canonical SHAs.
- Make Nordic gates strict and identical between local generation and CI.
- Reuse the existing flexible-routing allocation behavior for `psel`.

**Non-Goals:**

- Vendor-specific exporter dispatch, board presets, and starter-chip or hero changes.
- Editing upstream files under `.cache/` or committing generated data.
- Adding a backend, a new runtime parser dependency, or a legacy version-1 import path.
- Changing STM32 shard bytes, thresholds, reference parts, or existing canonical source records.
- Building a full Nordic family catalog beyond the three declared pilot selectors.
- Inventing strapping, input-only, fixed-pin, or exposed-pad facts.

## Decisions

### Adapter layout

Add `tools/data-gen/adapters/nordic/` with focused pure-TypeScript modules: `index.ts` (adapter object and gate list), `sources.ts` (three source declarations), `svd.ts` (peripheral and memory reader), `zephyr.ts` (device-tree reader), `pinctrl.ts` (binding and header reader), `kicad.ts` (symbol pin reader), `parts.ts` (pilot selectors and shard emission), `gates.ts` (strict reference assertions), and `types.ts` (normalized intermediate records). This mirrors `adapters/rp/` and `adapters/esp32/` and keeps each parse step host-testable with synthetic fixtures.

Alternative: a single large adapter file. Rejected because three formats and multiple pilot selectors make failures hard to attribute in warnings and tests.

### Source acquisition and pinning

- `nrf-pacs`: shallow clone with the verified `master` branch for `svds/nrf52840.svd`; short git SHA recorded; source spec id `nrf-pacs`. The branch name is part of the declaration because this source does not use `main`.
- `zephyr-nordic`: raw-file declarations for `dts/arm/nordic/nrf52840.dtsi`, `dts/bindings/pinctrl/nordic,nrf-pinctrl.yaml`, and `include/zephyr/dt-bindings/pinctrl/nrf-pinctrl.h` at a declared ref; SHA-256 content hash recorded; canonical id `zephyr`.
- `kicad-mcu-nordic`: raw-file declaration for `MCU_Nordic.kicad_symdir/nRF52840.kicad_sym` from kicad-symbols at `master`; SHA-256 content hash recorded; canonical id `kicad`.
- Spec ids are chosen so RP's `kicad-footprints` and `zephyr` declarations stay alphabetically first. This preserves the existing canonical `kicad` and `zephyr` SHA and URL records while the Nordic file hashes remain visible in the `nordic` vendor record.

Alternative: clone both kicad-symbols and Zephyr in full, or add three new canonical ids. Rejected because the Nordic files come from the same upstream repositories as existing canonical sources, and duplicating their identity would split license attribution and cause unnecessary metadata churn.

### Canonical identifiers and provenance

Extend `CatalogSourceId` and `CATALOG_SOURCE_IDS` from twelve to thirteen entries by adding `nrf-pacs`. Add an explicit `canonicalSourceId` mapping from `zephyr-nordic` to `zephyr`; `kicad-mcu-nordic` uses the existing `kicad` prefix rule. The provenance gate vendor list gains `nordic`. The `nordic` vendor record lists the three source SHAs, URLs, and licenses so every consumed file is attributed. Documentation and count wording move from twelve to thirteen sources and from five to six vendors in `README.md`, `AGENTS.md`, footer attribution data, and the docs-attribution test.

Alternative: keep twelve canonical ids by folding the SVD into an existing id. Rejected because provenance would lose the distinct 0BSD source and its SHA.

### Schema and solver compatibility

Add `psel` as a fifth `MuxModel` value and `nordic` to `VendorId`. `getChipMuxModel` returns `psel` for Nordic chips, and `formatMuxLabel` renders the `funcLabel` for that model. Nordic signals always carry `af: null`. Flexible-routing scarcity scoring and alternate discovery are extended through a shared predicate that covers both `gpio-matrix` and `psel`, so PSEL plans keep the same ranking behavior for pins with many candidate signals. Matrix route capacity and direct-route diagnostics remain gated on `gpio-matrix` because the acquired Nordic sources declare neither a route capacity nor an IO_MUX direct path. Input-only and strapping penalties fire only when those tags were derived from source data.

Alternative: reuse `gpio-matrix` for Nordic. Rejected because it would mislabel PSEL as an ESP32-style output matrix and require capacity fields the sources do not provide.

### Parsing and join rules

Use narrow readers over the declared fields. The SVD reader consumes peripheral names, instances, interrupts, and address-block sizes. The device-tree reader consumes `compatible`, `ngpios`, interrupt properties, and peripheral nodes. The pinctrl reader consumes the `NRF_PSEL(<FUNC>, <port>, <pin>)` macro form and function constants to produce `funcLabel` values. The KiCad reader consumes `(pin ...)` number and name fields, including ball identifiers and labels such as `AIN7/P0.31`. The join matches PSEL function identities to GPIO names parsed from KiCad labels; the physical position is the symbol `number` value. Multi-function labels stay verbatim, package pin count is counted from symbol pin entries, and an exposed pad is emitted only when the symbol or footprint declares one. Unmatched identities are deferred.

Alternative: introduce generic XML, DTS, and s-expression parser packages. Rejected to avoid a new dependency and to keep parse failures attributable per source.

### Fixed pins and electrical facts

Fixed Nordic pins (SWD, NFC, reset, QSPI) and electrical tags appear only when a symbol name or device-tree property declares them. Strapping and input-only tags require an explicit declaration; otherwise the gap is recorded in `build-warnings.json` with source and reason. This is the enforcement point for the "No handwritten MCU data" rule.

### Pilot selection and gates

Pilot selectors are upstream identifiers used to choose which acquired files to parse, not tables of chip facts: `nRF52840-QIAA`, `nRF5340`, and `nRF54L15`. Strict gates assert the nRF52840-QIAA shard against the pin set derived from the KiCad symbol, the peripheral inventory derived from SVD and device tree, at least one PSEL `funcLabel` with null `af`, a nonzero emitted part count, and all three Nordic SHAs. nRF5340 is emitted only when both core sources map to one complete symbol pin set. nRF54L15 is emitted only with complete evidence and otherwise deferred.

Alternative: assert hard-coded pin counts for each pilot. Rejected because fixed counts would be handwritten chip data.

### Verification approach

Per-group verification uses `npx vitest run tests/data-gen-nordic.test.ts`, `npm run check`, and a focused `npm run gen-data` gate run. Full verification requires `npm test`, `npm run check`, `BASE_PATH="/pincraft/" npm run build`, an end-to-end `npm run gen-data`, `openspec validate nordic-data-adapter --strict`, and archive by the implementation agent after all tasks pass.

## Risks / Trade-offs

- SVD has no package geometry, so the KiCad symbol is the sole physical-pin source. Incomplete symbols defer the affected part instead of guessing.
- The nrf-pacs source tracks `master`, so upstream drift can change the SVD. Recorded SHAs and the weekly source refresh bound the change; raw Zephyr and KiCad files are pinned by declared ref.
- Source-id collapse could displace the canonical `kicad` or `zephyr` SHA. Source-spec ids keep existing declarations alphabetically first, and an adapter-list test asserts unchanged canonical records.
- Solver changes could leak into other vendors. All reused behavior is gated on the mux model, and the STM32 golden and gate tests remain in the full suite.
- Electrical facts could be invented. Tags require source evidence, and missing facts become attributed warnings.
- Dual-core mapping for nRF5340 is ambiguous when only one core source is present. The adapter defers the part instead of merging incomplete evidence.
- Source-count wording can drift across documentation. Adapter-list, gate-contract, docs-attribution, and vendor-tab tests are updated in the groups that change the counts.

## Migration Plan

Generated data is gitignored, so no runtime migration is needed. Land the schema and source declarations, add the adapter, regenerate locally, then run the full verification sequence. Rollback consists of removing the adapter from `DEFAULT_ADAPTERS`, its source declarations, and the added canonical id; no committed data needs reverting.

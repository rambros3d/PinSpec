# Design

## Context

The catalog build runs one orchestrator (`tools/data-gen/index.ts`) over `DEFAULT_ADAPTERS`. Each adapter declares sources, emits `ChipData` shards and index entries, contributes gates, and records warnings through a shared collector. The orchestrator owns every write to `public/data/` and evaluates per-vendor gates before global gates, so a strict vendor can abort without publishing a partial catalog. Provenance is stored in `meta.json` under `sources`, keyed by vendor for legacy consumers and by `CatalogSourceId` for the canonical registry. `createProvenanceGate` and `createWarningsContractGate` check those contracts.

Microchip facts live in ATDF XML inside `Microchip-MPLAB-Harmony/dev_packs`. A verified file, `Microchip/SAMD21_DFP/3.6.144/samd21a/atdf/ATSAMD21G18A.atdf`, is 531,678 bytes, carries an SPDX Apache-2.0 header, and contains 48 `<pin>` entries and 259 `<signal>` entries. The observed structure is `<variants><variant ordercode package pinout>`, `<pinouts><pinout><pin position pad>`, `<modules><module><instance><signals><signal group index function pad>`, plus `<memory-segment>`, `<interrupts>`, and instance `<param>` entries. Function values include single letters (`A` through `H`) and non-letters such as `default`, `XIN`, and `XOUT32`. The repository has no SPDX declaration and is about 320 MB. See `proposal.md` for motivation and the two delta specs for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Convert the curated ATDF subset into deterministic, provenance-tagged shards and index entries.
- Derive every emitted fact from ATDF XML; defer missing evidence instead of inventing it.
- Reuse the `af` mux model and keep function-letter normalization deterministic.
- Add strict SAM gates that are identical between local generation and CI.
- Extend provenance, documentation, and attribution without changing STM32, CH32, RP, or ESP32 output.

**Non-Goals:**

- UI, solver, exporter, start-screen, and board-preset work; SAM workspace rendering is not part of this change.
- A new mux model, a new `PinTag`, or handwritten chip tables and static overlays.
- Editing upstream files under `.cache/`, committing generated data, or adding a backend or runtime parser dependency.
- Changing STM32 shard bytes, thresholds, or reference assertions.

## Decisions

### Vendor identifier

Use `vendor: 'microchip'` in `VendorId`, with `SAM` recorded as the family filter on each emitted chip and index entry. Alternative: a dedicated `'sam'` id. Rejected because ATDF covers several SAM families under one vendor and the vendor id should identify the manufacturer, while the family field identifies D21, D51, E51, and SAMV. Adding `microchip` to `VendorId` is additive; exporter dispatch already has a default branch, so no exporter behavior changes in this change.

### Source acquisition and provenance

Add `microchipAtdfSourceSpecs()` to `tools/data-gen/sources.ts`, using the existing `SourceSpec.rawFiles` mechanism. Declare a pinned `dev_packs` ref constant and fetch only the curated ATDF paths with `ensureRawFiles`-style raw HTTP fetches. Reuse `resolveRawRevision` to record the short SHA-256 of the declared file paths and bytes, with license `Apache-2.0`. Alternative: shallow-clone `dev_packs`. Rejected because a 320 MB repository without an SPDX declaration is disproportionate when only selected ATDF files are consumed.

Define one canonical id, `microchip-atdf`, in `CatalogSourceId` and `CATALOG_SOURCE_IDS`, and add one explicit `canonicalSourceId` mapping from the declared source id. The on-disk base spec records eleven canonical sources; adding one makes twelve. The brief for this change mentioned twelve to thirteen sources, which appears to assume the parallel `nordic-data-adapter` change lands first. This change is written against the on-disk base; if that change lands first, reconcile the counts in the `multi-vendor-ci-gates` delta before implementation.

### Adapter layout

Add `tools/data-gen/adapters/sam/` with focused pure-TypeScript modules: `index.ts` (adapter object and gate list), `sources.ts` (declarations and pinned ref), `atdf.ts` (XML reader), `variants.ts` (variant and part scope), `pins.ts` (pinout geometry), `signals.ts` (instance signals and AF mapping), `memory.ts` (memory and capability evidence), `gates.ts` (reference assertions), and `types.ts` (normalized intermediate records). Parse XML with the already installed `fast-xml-parser`, configured to preserve attributes and to ignore register and memory-map sections that the catalog does not consume. Alternative: a single large adapter file. Rejected because four families and several ATDF sections make failures hard to attribute in warnings and tests.

### Part scope and variant handling

Curate 39 ATDF files: 14 SAM D21, 9 SAM D51, 7 SAM E51, and 9 SAMV71. Emit one shard and one `index.json` entry per ATDF file stem, for example `ATSAMD21G18A`. Record every `<variant>` ordercode on that shard with its package, temperature range, and voltage range. Alternative: emit one shard per ordercode. Rejected because ordercodes differ only in package, temperature grade, and voltage range while sharing one pinout and one signal table; the part stem is the stable planning identity. The count gate asserts exactly 39 entries.

### Pin geometry and alternate functions

Build physical pins from `<pinout><pin position pad>` in ascending position order, using the `<variant package>` value for package identity. Classify pad names such as `VDDIO`, `GNDIO`, `VDDANA`, and `RESET_N` into power, ground, and reset types from the ATDF strings; do not infer from position. Pin entries with no position are deferred.

Join `<signal>` rows to pins by `pad`. Derive a signal identity from instance name, `group`, and `index`, keeping the source labels verbatim; do not translate `PAD0` into a protocol role such as SCK. Map a single-letter `function` to `af` by alphabetical position with `A = 0`, so `B = 1`, `C = 2`, `D = 3`, and `H = 7`. Keep `default`, `XIN`, `XIN32`, `XOUT`, and `XOUT32` as `af: null` with the original label; these are not mux slots. Reuse `muxModel: 'af'`. Alternative: invent protocol-level signal names or a new SAM mux model. Rejected because neither is present in ATDF and both would break the no-handwritten-data rule.

### Memory, interrupts, and DMA evidence

Read `flashKb` and `ramKb` from `<memory-segment type="flash">` and the SRAM segment, converting byte sizes to kilobytes. Retain interrupt names and instance parameter names such as `DMAC_ID_RX` as capability evidence. ATDF exposes DMA trigger indices but not a complete channel-to-signal map, so no DMA channel assignment is emitted; the affected part is recorded in `build-warnings.json` with vendor, source, and reason. Unparseable sizes are omitted and warned rather than defaulted.

### Gates, warnings, and tests

Set the SAM adapter to strict. Assert the exact 39-part count, the four reference parts `ATSAMD21G18A` (48), `ATSAMD51P20A` (128-pin TQFP128 and 120-ball TFBGA120 pinouts), `ATSAME51J20A` (64), and `ATSAMV71Q21B` (144), the `microchip` vendor and `af` mux model, at least one function-letter AF index on `ATSAMD21G18A`, and the `microchip-atdf` SHA. Reference failures produce gate errors and abort before writes; missing evidence produces `ctx.warnings` records with vendor `microchip`. Add `tests/data-gen-sam.test.ts` with synthetic ATDF fixtures covering variants, pinouts, function letters, non-letter functions, memories, deferral, and gate outcomes, plus raw-shape assertions against the verified ATSAMD21G18A fixture shape. Extend adapter-list, gates-contract, and docs-attribution tests for the added vendor and source.

### Verification approach

Per-group verification uses `npx vitest run tests/data-gen-sam.test.ts`, `npm run check`, and a focused `npm run gen-data` with gate output. Full verification requires `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`, followed by `openspec validate sam-data-adapter --strict` and `openspec archive sam-data-adapter -y` by the implementation agent after all tasks pass.

## Risks / Trade-offs

- ATDF schema drift across DFP versions: narrow readers and raw-shape assertions detect drift; pinned paths keep builds reproducible.
- Non-letter function values: explicit `af: null` handling preserves the source label without a fabricated index.
- Pad naming differences between SAMD51 and SAME51 pinouts: unmatched pad names are deferred instead of guessed.
- Incomplete DMA evidence: warnings record the gap; no channel numbers are invented.
- Source or vendor count conflict with the parallel Nordic change: reconcile the delta counts before implementation.
- Additional shards increase catalog size: emitted JSON omits unused register and memory-map fields and the 150 MB budget gate remains build-blocking.
- STM32 regression from shared helpers: all changes are additive and STM32 golden and gate tests remain in the full suite.

## Migration Plan

No runtime migration is needed because generated data is gitignored. Add the source declaration, add the adapter to `DEFAULT_ADAPTERS`, regenerate the catalog locally, then run the full verification sequence. Rollback consists of removing the adapter from the default list and its source declaration; no committed data needs reverting.

## Open Questions

None that change the specs, approach, or task breakdown.

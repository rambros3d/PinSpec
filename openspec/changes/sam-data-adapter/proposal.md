# Proposal

## Why

PinCraft has no Microchip SAM catalog data, so SAM D21, D51, E51, and SAMV parts cannot be planned in the workspace. Microchip publishes complete machine-readable ATDF device files in the `Microchip-MPLAB-Harmony/dev_packs` repository; these files describe variants, physical pinouts, module instance signals with function letters, memories, and interrupts. The repository is about 320 MB and provides no SPDX declaration, so a full clone is not suitable for provenance-tagged generation. A raw-file adapter with SHA-256 provenance is needed to convert the selected ATDF files into catalog shards without hand-maintained chip tables.

## What Changes

- Add `tools/data-gen/adapters/sam/`, registered in `DEFAULT_ADAPTERS`, with vendor id `microchip`, `muxModel: 'af'`, strict per-vendor gates, and warning-backed deferral for unmapped evidence.
- Add `microchipAtdfSourceSpecs()` to `tools/data-gen/sources.ts`: raw-file fetch of the curated ATDF paths from a pinned `dev_packs` ref, with SHA-256 content revision, URL, and Apache-2.0 license recorded in `meta.json`. No full repository clone.
- Add canonical source id `microchip-atdf` to `CatalogSourceId`, `CATALOG_SOURCE_IDS`, and `canonicalSourceId` so provenance and footer attribution can resolve it. Extend `VendorId` with `microchip`.
- Expand ATDF `<variant>` ordercodes and `<pinouts><pin position pad>` entries into package geometry and physical pins. Join `<modules><instance><signals><signal group index function pad>` entries to pads by pad name. Map single-letter `function` values to numeric `af` indices (A=0, B=1, and so on) and keep non-letter values such as `default`, `XIN`, and `XOUT32` as `af: null` with the source label preserved.
- Derive flash and RAM from `<memory-segment>` sizes and capability facts from `<interrupts>` and instance `<param>` entries. DMA channel maps that ATDF does not declare are deferred to `build-warnings.json` with vendor, source, and reason; no channel numbers are invented.
- Emit a curated 39-part subset spanning SAM D21 (14), SAM D51 (9), SAM E51 (7), and SAMV71 (9) ATDF files. One shard is emitted per ATDF part stem; its `<variant>` ordercodes are recorded as package, temperature, and voltage metadata. The per-vendor gate asserts the exact count and reference parts.
- Add strict SAM gates for `ATSAMD21G18A` (48 pins, QFN48 and TQFP48 variants, function-letter AF indices), `ATSAMD51P20A` (128-pin TQFP128 and 120-ball TFBGA120 pinouts), `ATSAME51J20A` (64 pins), and `ATSAMV71Q21B` (144 pins), plus the canonical source SHA and exact part count.
- Add `tests/data-gen-sam.test.ts` with synthetic ATDF fixtures and raw-shape assertions, and update the adapter-list, gates-contract, and docs-attribution tests.

## Capabilities

### New Capabilities

- `sam-chip-data`: Build-time acquisition of Microchip ATDF, variant and pinout normalization, function-letter AF mapping, shard emission, provenance, strict gates, and warning-backed deferral for SAM chip data.

### Modified Capabilities

- `multi-vendor-ci-gates`: Extend the canonical source list from eleven to twelve and the provenance vendor list from four to five with the Microchip ATDF source and the `microchip` vendor summary; extend documentation attribution to cover SAM generation and the added source; add a strict SAM generation gate.

## Impact

- New adapter modules under `tools/data-gen/adapters/sam/` and `tests/data-gen-sam.test.ts`; additions to `tools/data-gen/sources.ts`, `tools/data-gen/gates.ts`, `tools/data-gen/index.ts`, `tools/data-gen/artifacts.ts`, `src/core/types.ts`, `tests/gates-contracts.test.ts`, `tests/docs-attribution.test.ts`, and any adapter-list test.
- `index.json` gains 39 entries with `vendor: 'microchip'`; `meta.json` gains one canonical source record with a SHA-256 content hash and a `microchip` vendor summary; `build-warnings.json` gains records for deferred parts or missing evidence.
- The AF mux model is reused without change. No new runtime dependency, no backend, no editing of upstream files under `.cache/`, and no committed generated data.
- STM32, CH32, RP, and ESP32 shards, gates, and reference assertions are unchanged. Shared helpers are extended additively and STM32 golden tests remain in the full suite.

## Dependencies

- None. This change adds its own source declaration and vendor id; it does not require another in-flight change. If the parallel `nordic-data-adapter` change lands first, the source and vendor counts in the `multi-vendor-ci-gates` delta need a one-line reconciliation before implementation.

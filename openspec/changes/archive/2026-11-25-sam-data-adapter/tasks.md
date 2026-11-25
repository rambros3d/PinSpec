# Tasks

## 1. Source declarations and schema

- [x] 1.1 Add the Apache-2.0 license constant, a pinned `dev_packs` ref constant, and `microchipAtdfSourceSpecs()` with raw-file declarations for the curated ATDF paths in `tools/data-gen/sources.ts`, and verify `npm run acquire-sources` fetches those files into the gitignored cache with a recorded SHA-256.
- [x] 1.2 Extend `VendorId` with `microchip` and `CatalogSourceId`, `CATALOG_SOURCE_IDS`, and `canonicalSourceId` with `microchip-atdf`, and verify `npm run check` passes with no changes to existing vendor ids.
- [x] 1.3 Add initial `tests/data-gen-sam.test.ts` cases for the source declaration, pinned ref, canonical id, and adapter-list registration in `DEFAULT_ADAPTERS`, and verify `npx vitest run tests/data-gen-sam.test.ts` passes.

## 2. ATDF parsing and raw-shape assertions

- [x] 2.1 Implement the narrow ATDF XML reader for `<variant>`, `<pinouts><pin>`, `<modules><instance><signals><signal>`, `<memory-segment>`, `<interrupts>`, and instance `<param>` attributes using the installed XML parser, skipping unused register and memory-map sections, and verify synthetic fixture cases in `tests/data-gen-sam.test.ts` pass.
- [x] 2.2 Add raw-shape assertions against the verified ATSAMD21G18A ATDF (Apache-2.0 header, 48 `<pin>` entries, 259 `<signal>` entries, function letters and non-letter function values), and verify the assertions pass with the cached raw file.

## 3. Part scope, geometry, and AF mapping

- [x] 3.1 Implement the curated 39-part scope (14 SAM D21, 9 SAM D51, 7 SAM E51, 9 SAMV71), one shard per ATDF part stem, and variant ordercode metadata with package, temperature, and voltage ranges, and verify a focused generation case emits exactly 39 `microchip` index entries.
- [x] 3.2 Implement physical pin geometry from `<pin position pad>` with power, ground, and reset classification from ATDF pad names and deferral of entries without a position, and verify the geometry fixture cases in `tests/data-gen-sam.test.ts` pass.
- [x] 3.3 Implement the pad-name signal join and function-letter AF mapping (`A` to zero through `H` to seven, non-letter functions to `af: null` with the label preserved), keeping group and index labels verbatim and setting `muxModel: 'af'`, and verify the mapping and unmatched-pad cases pass.

## 4. Evidence, shards, and warnings

- [x] 4.1 Implement flash and RAM derivation from `<memory-segment>`, retain interrupt and instance parameter names as capability evidence, and defer missing DMA channel maps and unreadable sizes, verifying the evidence cases in `tests/data-gen-sam.test.ts` pass.
- [x] 4.2 Implement shard and index emission with `vendor: 'microchip'`, family `SAM`, and no `NaN` or `undefined` values, and verify the emission cases in `tests/data-gen-sam.test.ts` pass.
- [x] 4.3 Route every unavailable or ambiguous SAM record to `ctx.warnings` with id, vendor `microchip`, source `microchip-atdf`, and reason, and verify `tests/gates-contracts.test.ts` accepts a warnings document containing those records.

## 5. Strict gates and provenance

- [x] 5.1 Implement strict SAM gates asserting the exact 39-part count, `ATSAMD21G18A` (48 pins), `ATSAMD51P20A` (128 and 120 pinouts), `ATSAME51J20A` (64 pins), `ATSAMV71Q21B` (144 pins), vendor and mux model, and a function-letter AF index, and verify passing and failing cases in `tests/gates-contracts.test.ts` pass.
- [x] 5.2 Extend the provenance gate vendor list with `microchip`, require all twelve canonical source SHAs plus the `microchip` vendor summary, and verify the provenance cases in `tests/gates-contracts.test.ts` pass.
- [x] 5.3 Run `npm run gen-data` after registering the adapter, verify shards, index entries, `meta.json` records, and `build-warnings.json` are consistent, and verify a forced SAM gate error writes no partial catalog.

## 6. Documentation and attribution

- [x] 6.1 Update `README.md` and `AGENTS.md` from eleven to twelve upstream sources, add the Microchip ATDF source with its Apache-2.0 license, and document SAM generation and its gate contract, and verify `tests/docs-attribution.test.ts` passes.
- [x] 6.2 Confirm generated `meta.json` carries non-empty SHA, URL, and license for `microchip-atdf` and a `microchip` vendor summary, and verify the attribution data case in `tests/docs-attribution.test.ts` passes.
- [x] 6.3 Scan all files touched by this change for emoji characters and raw color literals outside `src/themes/daisyui.css`, and verify no matches are found.

## 7. Full verification

- [x] 7.1 Run `npm test` and `npm run check` and verify zero failures and zero warnings.
- [x] 7.2 Run `BASE_PATH="/pincraft/" npm run build` and verify the subpath contract checks pass with no broken asset or data request.
- [x] 7.3 Run `npm run gen-data` end to end and verify all per-vendor and global gates pass with no STM32, CH32, RP, or ESP32 regression.
- [x] 7.4 Run `openspec validate sam-data-adapter --strict` and verify no validation errors.

## Workflow follow-up

- Archive the change after all tracked tasks and verification pass: `openspec archive sam-data-adapter -y`. The implementation agent performs this step and includes the synced specs and archived change files in the implementation commit.
- Verify the archived specs under `openspec/specs/sam-chip-data/` and `openspec/specs/multi-vendor-ci-gates/` contain the twelve-source wording, the `microchip` vendor summary, and the SAM gate contract, then commit and push.

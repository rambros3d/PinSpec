# Tasks

## 1. Schema and source declarations

- [x] 1.1 Add `nordic` to `VendorId` and `psel` as a fifth `MuxModel` in `src/core/types.ts`, update `getChipMuxModel` and `formatMuxLabel`, and verify `npm run check` plus a typed `psel` case in `tests/data-gen-nordic.test.ts` pass.
- [x] 1.2 Add three source declarations in `tools/data-gen/sources.ts`: `nrf-pacs` from the `master` branch with 0BSD, `zephyr-nordic` raw device-tree and pinctrl files with Apache-2.0, and `kicad-mcu-nordic` raw symbol with CC-BY-SA-4.0 generated-file exception; verify `npm run acquire-sources` fetches each into gitignored `.cache/` with a license and resolved SHA.
- [x] 1.3 Add `nrf-pacs` to `CatalogSourceId` and `CATALOG_SOURCE_IDS`, map `zephyr-nordic` to the `zephyr` canonical id and `kicad-mcu-nordic` to the `kicad` canonical id in `tools/data-gen/artifacts.ts`, and verify in `tests/data-gen-nordic.test.ts` that the thirteen canonical ids are complete and the existing `kicad` and `zephyr` primary records are unchanged.
- [x] 1.4 Seed `tests/data-gen-nordic.test.ts` with synthetic SVD, device-tree, pinctrl, and KiCad symbol fixtures, and verify `npx vitest run tests/data-gen-nordic.test.ts` passes.

## 2. Nordic parsers and evidence join

- [x] 2.1 Implement the narrow SVD reader for peripheral names, instances, interrupts, and address-block sizes with no physical-pin inference, and verify the SVD cases in `tests/data-gen-nordic.test.ts` pass.
- [x] 2.2 Implement the device-tree reader for `compatible`, `ngpios`, interrupts, and peripheral nodes, and verify the GPIO-count and memory cases in `tests/data-gen-nordic.test.ts` pass.
- [x] 2.3 Implement the pinctrl binding and header reader that maps `NRF_PSEL(<FUNC>, <port>, <pin>)` and function constants to `funcLabel` values with `af: null`, and verify the PSEL cases in `tests/data-gen-nordic.test.ts` pass.
- [x] 2.4 Implement the KiCad symbol reader for `(pin ...)` number and name fields, including ball identifiers, labels such as `AIN7/P0.31`, and exposed-pad evidence, and verify the physical-position and package-count cases in `tests/data-gen-nordic.test.ts` pass.
- [x] 2.5 Implement the join from PSEL identities to KiCad GPIO names with fixed-pin and electrical tags only when a symbol name or device-tree property declares them, and verify fixed-pin, no-invented-strapping, and deferred-gap cases in `tests/data-gen-nordic.test.ts` pass.

## 3. Adapter emission and shards

- [x] 3.1 Implement `tools/data-gen/adapters/nordic/` modules and a `VendorAdapter` with `vendor: 'nordic'`, the three `sourceSpecs`, and `strict: true`, register it in `DEFAULT_ADAPTERS`, and verify an adapter-list case confirms its presence.
- [x] 3.2 Emit the `nRF52840-QIAA` index entry and chip shard with `vendor: 'nordic'`, `muxModel: 'psel'`, the symbol-derived pin set, and no `NaN` or `undefined`, and verify the emission cases in `tests/data-gen-nordic.test.ts` pass.
- [x] 3.3 Emit nRF5340 only when both core sources map to one complete symbol pin set and nRF54L15 only with complete evidence, deferring either part otherwise, and verify the pilot selector cases in `tests/data-gen-nordic.test.ts` pass.
- [x] 3.4 Route every unavailable or ambiguous Nordic value to `ctx.warnings` with id, vendor, source, and reason, and verify `tests/gates-contracts.test.ts` accepts a warnings document containing those Nordic records.
- [x] 3.5 Run `npm run gen-data` and verify Nordic shards, index entries, `meta.json` vendor summary, and `build-warnings.json` are consistent and that a forced gate error leaves no partial catalog.

## 4. Gates, provenance, and solver compatibility

- [x] 4.1 Implement strict Nordic gates asserting the nRF52840-QIAA pin set from KiCad, peripheral inventory from SVD and device tree, at least one PSEL `funcLabel` with null `af`, and a nonzero emitted count, and verify passing and failing cases in `tests/gates-contracts.test.ts` pass.
- [x] 4.2 Extend the provenance gate vendor list with `nordic`, require the `nrf-pacs` SHA plus the Nordic Zephyr and KiCad file evidence, and verify a missing-SHA case fails generation in `tests/gates-contracts.test.ts`.
- [x] 4.3 Extend the shared flexible-routing predicate so `psel` reuses matrix-aware scarcity scoring and alternate discovery while route-capacity and direct-route diagnostics remain on `gpio-matrix`, with input-only and strapping penalties only for derived tags, and verify a Nordic `psel` allocation case in `tests/core-multi-vendor.test.ts` passes.
- [x] 4.4 Confirm STM32 golden shards and STM32 reference gates are byte-stable and unchanged, and verify `npm test` reports no failures or warnings.

## 5. Documentation, vendor tabs, and attribution

- [x] 5.1 Add `nordic` to the vendor tab list in `src/core/vendor-view.ts` and verify the updated expectation in `tests/ui-multi-vendor.test.ts` passes with live counts from `meta.json`.
- [x] 5.2 Update `README.md` and `AGENTS.md` from twelve to thirteen sources and from five to six vendors, add the three Nordic sources with licenses and the Nordic generation and gate description, and verify `tests/docs-attribution.test.ts` passes.
- [x] 5.3 Confirm generated `meta.json` carries the `nrf-pacs` record, the Nordic Zephyr and KiCad evidence, and the `nordic` vendor summary with non-empty SHA, URL, and license values, and verify the attribution data case in `tests/docs-attribution.test.ts` passes.
- [x] 5.4 Scan all files touched by this change for emoji characters and raw color literals outside `src/themes/daisyui.css`, and verify no matches are found.

## 6. Full verification

- [x] 6.1 Run `npm test` and `npm run check` and verify zero failures and zero warnings.
- [x] 6.2 Run `BASE_PATH="/pinspec/" npm run build` and verify the subpath checks in `tests/subpath-contracts.test.ts` pass with no broken asset or data request.
- [x] 6.3 Run `npm run gen-data` end to end and verify all per-vendor and global gates pass with consistent `index.json`, `meta.json`, and `build-warnings.json`.
- [x] 6.4 Run `openspec validate nordic-data-adapter --strict` and verify no validation errors.

## Workflow follow-up

- Archive the change after all tracked tasks and verification pass: `openspec archive nordic-data-adapter -y`. The implementation agent performs this step and includes the synced specs and archived change files in the implementation commit.
- Verify the archived specs under `openspec/specs/nordic-chip-data/` and `openspec/specs/multi-vendor-ci-gates/` contain the thirteen-source and six-vendor wording and the Nordic gate contract, then commit and push.

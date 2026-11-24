# Tasks

## 1. Dependency alignment and shared presentation helpers

- [x] 1.1 Confirm the dependency changes have landed: `VendorId` includes `esp32`, `MuxModel` includes `gpio-matrix`, the schema-defined `PinTag` values and `CatalogSourceId` entries exist, and `index.json` contains `vendor: 'esp32'` entries after generation. Verify with `npm run gen-data`, `npm run check`, and an inspection of `src/core/types.ts` and `public/data/index.json`.
- [x] 1.2 Add `esp32` to the vendor list in `buildVendorTabs()` and add labels and stable display order for every schema-defined ESP32 pin tag in `PIN_TAG_LABELS` and `PIN_TAG_ORDER` in `src/core/vendor-view.ts`. Verify with `tests/ui-multi-vendor.test.ts`: tab ids `['all', 'stm32', 'ch32', 'rp', 'esp32']`, live ESP32 count, existing tag order unchanged, and every new tag present.
- [x] 1.3 Add an ESP32 vendor option to the hardcoded filter list in `CompatibleMcuFinder.svelte` and keep the `all` option first. Verify with `tests/compatible-mcu-finder.test.ts` and a source assertion that all four vendor option values appear.

## 2. Starter chips and electrical-fact display

- [x] 2.1 Add ESP32 starter chip entries to `STARTER_CHIPS` in `src/components/landing/PresetGrid.svelte` whose identifiers resolve to generated module shards. Verify with `tests/ui-multi-vendor.test.ts` that the starter list contains STM32, CH32, RP, and ESP32 identifiers and that `npm run gen-data` produced matching shards.
- [x] 2.2 Keep board presets STM32-only and `.ioc` import start-screen-only with STM32 resolution. Verify with `tests/board-presets.test.ts`, `tests/ioc-import.test.ts`, and `tests/start-screen.test.ts` that no ESP32 board preset or workspace `.ioc` control is introduced.
- [x] 2.3 Keep pin views and the diagnostic summary on the shared mux-label and tag helpers so ESP32 matrix labels and electrical tags are shown without an `AF` fallback or dropped tag. Verify with `tests/ui-multi-vendor.test.ts` and `tests/core-multi-vendor.test.ts` tag-label assertions and `npm test`.

## 3. Vendor exporters and export modal

- [x] 3.1 Add `espPinIdent()` and `formatEsp32()` to `src/core/exporters/embassy-rust.ts`, route `esp32` in `exportEmbassyRust()`, and emit `use esp_hal::peripherals;`, `esp_hal::init()`, GPIO-number pad identifiers, and matrix-route comments. Verify with a synthetic `gpio-matrix` fixture in `tests/exporters-vendor.test.ts` that asserts the crate, init call, pad names, route label, empty struct, and absence of STM32 or RP crate text.
- [x] 3.2 Add `formatEsp32()` to `src/core/exporters/c-header.ts` with `GPIO<n>` macros, matrix function comments, a guard, and no `_AF` macro. Verify with `tests/exporters-vendor.test.ts` that ESP32 headers contain the GPIO macro and route comment and that STM32, RP, and CH32 header assertions are unchanged.
- [x] 3.3 Add the `esp-hal` crate label to the Rust tab mapping in `src/components/workspace/ExportModal.svelte` without changing copy, download, or import behavior. Verify with `tests/workspace-qol.test.ts` and `tests/ui-multi-vendor.test.ts` that all four crate labels and both controls remain present.

## 4. Provenance and documentation

- [x] 4.1 Extend `PROVENANCE_SOURCES` in `src/pages/LandingPage.svelte` to the eleven canonical sources and add `esp32` to `PROVENANCE_VENDORS`. Verify with `tests/ui-multi-vendor.test.ts` and `tests/docs-attribution.test.ts` that the footer contains all source and license tokens, all four vendors, and live `catalogStore.meta` counts with no STM32-only wording.
- [x] 4.2 Update the `index.html` title and description metadata from three vendors to four. Verify with `tests/docs-attribution.test.ts` that the metadata contract passes and no removed hero or landing export string returns.
- [x] 4.3 Update `README.md` and `AGENTS.md` to describe four vendors, eleven sources, esp-hal exports, ESP32 starter chips, and the existing verification commands. Verify with `tests/docs-attribution.test.ts` tokens and a repository scan for emoji characters and marketing claims.
- [x] 4.4 Update `tests/docs-attribution.test.ts` token lists and touched-file list for the ESP32 sources and exports, and update `tests/workspace-qol.test.ts` and `tests/core-multi-vendor.test.ts` where the changed contracts require it. Verify with `npm test` that every affected suite passes.

## 5. Integration verification

- [x] 5.1 Run `npm test` and confirm the full Vitest suite passes with zero failures.
- [x] 5.2 Run `npm run check` and confirm strict TypeScript validation passes with zero errors.
- [x] 5.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm the production subpath build succeeds with no broken asset path.
- [x] 5.4 Confirm STM32 exports, routes, solver output, and generated catalog are unchanged, no `public/data/` or `.cache/` file was modified, no Svelte or DOM import exists under `src/core/`, and no new state field was added to share URLs or version-2 project files.
- [x] 5.5 Run `openspec validate esp32-ui-exporters-and-docs --strict` and confirm all delta specs and scenarios pass strict validation.

## Workflow follow-up

- After every task passes and all verification is green, run `openspec archive esp32-ui-exporters-and-docs -y`, include the synced `openspec/specs/` files and archived change files in the implementation commit, and report validation, test, check, build, and archive output as evidence. Commit and push only after archive. This planning task set creates no commit and pushes nothing.

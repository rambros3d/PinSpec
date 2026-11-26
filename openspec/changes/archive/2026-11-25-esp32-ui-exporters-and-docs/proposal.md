# Proposal

## Why

ESP32 catalog data, schema fields, and matrix placement are supplied by sibling
changes, but the application still presents only STM32, CH32, and RP. Vendor
tabs, discovery filters, starter chips, pin-tag labels, export dispatch, and
upstream attribution all contain fixed three-vendor lists. Without this change,
ESP32 shards would be generated yet undiscoverable, unexportable through the
crate-matched formats, and absent from provenance copy.

## What Changes

- Add `esp32` to `src/core/vendor-view.ts` `buildVendorTabs`, pin-tag labels and
  tag display order, and to the hardcoded vendor option list in
  `CompatibleMcuFinder.svelte`. Preserve the `all` tab and the existing three
  vendors with their current labels, counts, and order.
- Add ESP32 identifiers to the `STARTER_CHIPS` list in `PresetGrid.svelte`,
  matching module shards emitted by the ESP32 data adapter. Keep board presets
  STM32-only, keep `.ioc` import on the start screen and STM32-only, and add no
  ESP32 board preset or project-import path.
- Label the new ESP32 electrical pin tags in `PIN_TAG_LABELS` and `PIN_TAG_ORDER`
  and keep existing tag order stable. Display solver diagnostics from the
  schema and placement changes through the existing pin views and summary
  surfaces without rewriting their values.
- Add `formatEsp32()` to `src/core/exporters/embassy-rust.ts` using
  `use esp_hal::peripherals;`, `esp_hal::init()`, and matrix-route comments.
  Add `espPinIdent()` for `GPIO<n>` pad names because `basePinIdent()` matches
  only `P[A-K]`. Keep STM32, RP, and CH32 output byte-identical.
- Add an ESP32 branch to `src/core/exporters/c-header.ts` that emits `GPIO<n>`
  macros and matrix function comments and emits no `_AF` macro. Keep CSV, JSON,
  and share-link codecs unchanged because their schemas are already
  vendor-neutral.
- Add the `esp-hal` tab label in `ExportModal.svelte` while keeping the existing
  crate labels, copy, and download controls.
- Extend `PROVENANCE_SOURCES` and `PROVENANCE_VENDORS` in `LandingPage.svelte`
  to the eleven canonical sources and four vendors supplied by the data
  adapter. Update `index.html` metadata, `README.md`, `AGENTS.md`, and
  `tests/docs-attribution.test.ts` to the same count and wording. Align with the
  archived start-screen layout: no hero chip preview, no landing export
  preview, and no edit to that change's artifacts.
- Update source-string and behavior tests: `tests/ui-multi-vendor.test.ts`,
  `tests/exporters-vendor.test.ts`, `tests/core-multi-vendor.test.ts` where the
  tag contract is asserted, `tests/docs-attribution.test.ts`, and
  `tests/workspace-qol.test.ts` where the crate label is asserted.
- No new workspace-state field, share-link field, project-file field, backend,
  dependency, commit of generated data, or STM32 behavior change.

Dependencies: `esp32-schema-and-core-mux` for `VendorId`, `gpio-matrix`, pin
tags, and signal direction; `esp32-matrix-placement` for placement facts and
their shareable-state boundary; `esp32-data-adapter-and-gates` for the shards,
families, and eleven-source provenance; and the archived `pinspec-start-screen`
change for the current discovery and provenance layout. The start-screen
artifacts are not edited by this change.

## Capabilities

### New Capabilities

- `esp32-ui-exporters-and-docs`: ESP32 presentation, starter-chip scope,
  electrical-fact display, esp-hal and C export mechanics, provenance and
  documentation attribution, and non-regression for the existing vendors.

### Modified Capabilities

- `multi-vendor-workspace`: vendor-correct mux labels cover `gpio-matrix`;
  discovery exposes an ESP32 tab and filter; export/provenance copy credits
  esp-hal and the ESP32 sources; curated presets include ESP32 module starter
  chips without board presets.
- `multi-vendor-exports`: Rust and C dispatch includes `esp-hal` and ESP32 GPIO
  macros; mux annotations use matrix route labels instead of AF indices.

`pinspec-start-screen` is an archived change rather than a main spec and is a
dependency only; no delta is created for it. `multi-vendor-ci-gates` is owned by
`esp32-data-adapter-and-gates` and is not modified here.

## Impact

- Core presentation helper: `src/core/vendor-view.ts`.
- Exporters: `src/core/exporters/embassy-rust.ts` and
  `src/core/exporters/c-header.ts`; CSV and JSON remain untouched.
- Components and pages: `CompatibleMcuFinder.svelte`, `PresetGrid.svelte`,
  `ExportModal.svelte`, and `LandingPage.svelte`.
- Documentation and metadata: `README.md`, `AGENTS.md`, and `index.html`.
- Tests: `tests/ui-multi-vendor.test.ts`, `tests/exporters-vendor.test.ts`,
  `tests/core-multi-vendor.test.ts`, `tests/docs-attribution.test.ts`, and
  `tests/workspace-qol.test.ts`.
- No change to generated data files, `.cache/`, dependency manifests, or the
  deployment workflow.

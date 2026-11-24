# Design

## Context

See `proposal.md` for motivation. The workspace already routes exporters by
`getChipVendor()` and derives mux text from `formatMuxLabel()`, so vendor work is
localized to fixed lists and formatters. `src/core/vendor-view.ts` hardcodes the
vendor tab list (`stm32`, `ch32`, `rp`), `PIN_TAG_LABELS`, and `PIN_TAG_ORDER`;
`CompatibleMcuFinder.svelte` has a separate hardcoded vendor `<option>` list.
`embassy-rust.ts` dispatches to `formatStm32`, `formatRp`, and `formatCh32`, and
its `basePinIdent()` regex matches only `P[A-K]`, which cannot name ESP32 GPIO
pads. `c-header.ts` has `parsePortAndPin()` and `parseGpionum()` plus one
formatter per existing vendor. `ExportModal.svelte` maps vendors to crate tab
labels. The start screen renders provenance from `PROVENANCE_SOURCES` and
`PROVENANCE_VENDORS` in `LandingPage.svelte`, and `index.html`, `README.md`,
`AGENTS.md`, and `tests/docs-attribution.test.ts` carry matching source-count
wording.

Constraints: `src/core/` stays pure TypeScript; all runtime data fetches use
`import.meta.env.BASE_URL`; no generated data is committed; no emoji, no
marketing copy; pin configuration remains shareable while view preferences stay
in `localStorage` or component state.

## Goals / Non-Goals

**Goals:**

- Make ESP32 a fourth selectable vendor in every discovery surface with the
  same behavior as the existing three vendors.
- Offer ESP32 module starter chips only, opening generated shards.
- Emit esp-hal Rust and ESP32 C headers with matrix-aware labels and no AF
  macros.
- Present schema-defined electrical tags and solver diagnostics without loss.
- Credit all eleven canonical sources and four vendors in footer, metadata,
  and documentation.
- Keep STM32, CH32, and RP output and ordering unchanged.

**Non-Goals:**

- No ESP32 board presets, `.ioc` import path, hero preview, or landing export
  preview.
- No new workspace-state field, share-link field, or project-file version.
- No change to the data adapter, gates, solver semantics, placement scoring,
  generated data files, dependency manifests, or deployment workflow.
- No edit to the archived `pincraft-start-screen` change artifacts.

## Decisions

- **Extend, do not fork, the shared presentation helper.** Add `esp32` to the
  `vendors` array in `buildVendorTabs()` and add the schema-defined ESP32 tags
  to `PIN_TAG_LABELS` and `PIN_TAG_ORDER`. The `all` tab and existing relative
  order stay first. Alternative: a parallel ESP32 tab builder was rejected
  because it would duplicate count logic and drift from `meta.json.sources`.
- **Keep mux labels behind the shared helper.** UI sites already call
  `formatMuxLabel()`; the matrix branch arrives with `esp32-schema-and-core-mux`.
  This change adds only the presentation assertions and tag labels, never a
  local `AF` fallback.
- **Add `espPinIdent()` alongside `rpPinIdent()`.** It maps a `GPIO<n>` pad name
  to the esp-hal peripheral identifier used in `BoardPins`, and `collectBindings()`
  selects it when the chip vendor is `esp32`. Alternative: widening
  `basePinIdent()` was rejected because it would change fallback output for
  other vendors.
- **Add `formatEsp32()` as a peer formatter.** It reuses `headerLines()` and
  `renderStruct()`, emits `use esp_hal::peripherals;`, an `esp_hal::init()`
  helper, and a comment block listing matrix routes from `formatMuxLabel()`. The
  `exportEmbassyRust()` switch gains one `case` and a default that remains
  STM32. Alternative: generating a generic "unknown vendor" output was
  rejected because it would hide matrix routing.
- **Add `formatEsp32()` to the C exporter.** A GPIO-number macro replaces port
  and pin macros, and a matrix function comment replaces the `_AF` macro. It
  reuses `parseGpionum()`, `toUpperSnakeCase()`, `headerPreamble()`,
  `emptyHeader()`, and `gpioMacroLines()`. Alternative: reusing the CH32 port
  macros was rejected because it would emit incorrect `GPIOA`-style names.
- **Treat CSV, JSON, and URL codecs as already vendor-neutral.** Their schemas
  use a `Vendor` column and version-2 fields, so no format change is needed.
- **Derive provenance data from generated metadata.** `PROVENANCE_SOURCES` grows
  from seven to eleven entries using the source identifiers introduced by
  `esp32-data-adapter-and-gates`, and `PROVENANCE_VENDORS` gains `esp32`. The
  footer's count string already uses the array length. Alternative: a separate
  ESP32 provenance block would split one source of truth into two.
- **Keep tests aligned with current code.** Source-string tests assert present
  strings in the post-start-screen files; no test asserts a removed hero or
  landing export string. Export tests add synthetic `gpio-matrix` fixtures
  mirroring the existing `stm32`, `rp`, and `ch32` fixtures.

## Risks / Trade-offs

- [Sibling changes land in a different order than this one] -> Write code
  against the shared types (`VendorId`, `PinTag`, `CatalogSourceId`) and
  generated metadata rather than hardcoding new enum values where avoidable;
  sequence implementation tasks after the dependency changes.
- [Exact starter-chip identifiers depend on emitted module shards] -> Choose
  identifiers that exist in `index.json` after generation and keep the starter
  list small; source-string tests assert vendor coverage rather than a fixed
  family count.
- [Byte-for-byte STM32 regression in exporters or tabs] -> Keep the default
  vendor branches unchanged and assert existing exporter strings and tab order
  in `tests/exporters-vendor.test.ts` and `tests/ui-multi-vendor.test.ts`.
- [Brittle footer and metadata strings] -> Use one source count in documentation
  and tests, and read `PROVENANCE_SOURCES.length` rather than a literal where
  practical.
- [Source-string tests drift after the start-screen rewrite] -> Inspect current
  files before editing assertions and preserve the start-screen no-hero
  contracts.

## Migration Plan

No runtime or data migration is required. Implementation proceeds in four
groups: presentation helpers and discovery, starter chips and tag display,
exporters and export modal, then provenance, documentation, and tests. After
every group, run the unit tests. After all groups, run `npm test`,
`npm run check`, and `BASE_PATH="/pincraft/" npm run build`, confirm STM32
stability and no generated-data edits, then run strict validation and archive
this change in the implementation commit.

# Design

## Context

The catalog build runs one orchestrator (`tools/data-gen/index.ts`) over `DEFAULT_ADAPTERS`. Each adapter declares its own sources, emits `ChipData` shards and index entries, contributes gates, and records warnings through a shared collector. The orchestrator owns all writes to `public/data/` and evaluates per-vendor gates before global gates, so a strict vendor can abort without publishing a partial catalog. Provenance is stored in `meta.json` under `sources`, keyed by vendor for legacy consumers and by `CatalogSourceId` for the canonical registry; `createProvenanceGate` and `createWarningsContractGate` check those contracts. The existing `canonicalSourceId` maps every id beginning with `kicad` to one canonical `kicad` id, which would erase the SHA of a separate Espressif KiCad source. See `proposal.md` for motivation and the two delta specs for the behavior contract.

ESP32 has no generated JSON. The first-party facts live in separate formats: YAML in `esp-gpio-tool`, TOML in `esp-hal` `esp-metadata`, S-expression symbols and footprints in `espressif/kicad-libraries`, and C headers in ESP-IDF. The generalized schema fields used here (`vendor: 'esp32'`, nullable `flashKb`, the ESP32 mux model and tags) are delivered by the parallel `esp32-schema-and-core-mux` change; this change consumes them and does not redefine them.

## Goals / Non-Goals

**Goals:**

- Convert every available ESP32 family into deterministic, provenance-tagged shards and index entries.
- Preserve first-party electrical facts without inference, including strapping, pull state, input-only and reserved pins, flash/PSRAM restrictions, ADC2 Wi-Fi conflict, and exposed pads.
- Make ESP32 gates strict and identical between local generation and CI.
- Extend provenance from seven to eleven canonical sources without changing STM32 output.
- Defer every unavailable or ambiguous ESP32 record to `build-warnings.json`.

**Non-Goals:**

- UI, solver, exporter, start-screen, or board-preset work owned by the other ESP32 changes.
- Editing upstream files under `.cache/` or committing generated data.
- Adding a backend, a runtime parser dependency, or a legacy version-1 import path.
- Changing STM32 shard bytes, thresholds, or reference assertions.

## Decisions

### Adapter layout

Add `tools/data-gen/adapters/esp32/` with focused pure-TypeScript modules: `index.ts` (adapter object and gate list), `sources.ts` (the four source declarations), `gpio-tool.ts` (target YAML records), `metadata.ts` (GPIO/signal TOML and SoC facts), `kicad.ts` (symbol and footprint pads), `esp-idf.ts` (pinned header facts), `join.ts` (identity join), `modules.ts` (module manifest and shard emission), `gates.ts` (strict reference assertions), and `types.ts` (normalized intermediate records). This mirrors the existing `adapters/rp/` directory and keeps every parse step host-testable.

Alternative: one large adapter file. Rejected because four formats and twelve families make failures hard to attribute in warnings and tests.

### Source acquisition and pinning

- `espressif/esp-gpio-tool` and `esp-rs/esp-hal`: shallow clones into `.cache/`, with HEAD short SHA recorded by the existing clone helpers.
- `espressif/kicad-libraries`: raw-file declarations for `symbols/Espressif.kicad_sym` and the selected QFN footprints, fetched at a declared ref so builds are reproducible; SHA-256 content hash recorded by `resolveRawRevision`.
- ESP-IDF: raw-file declarations for `soc_caps.h`, `gpio_sig_map.h`, and `io_mux_reg.h` at a declared release tag constant; the tag appears in each recorded URL and the content hash in the SHA field. The same constant feeds the matrix-count gate.

Alternative: add a `ref` option to `ensureRepo` and clone all four sources. Rejected because raw-file sources already have deterministic revision handling and avoid cloning large libraries.

### Canonical source identifiers

Extend `CatalogSourceId` and `CATALOG_SOURCE_IDS` from seven to eleven entries by adding `esp-gpio-tool`, `esp-hal-metadata`, `espressif-kicad`, and `esp-idf`. Extend `canonicalSourceId` with explicit mappings and place the `espressif-kicad` check before the existing `kicad` prefix rule. Extend the provenance gate vendor list from `stm32`, `ch32`, `rp` to include `esp32`, and update count wording in `README.md`, `AGENTS.md`, and the docs-attribution test.

Alternative: reuse the existing `kicad` canonical id. Rejected because provenance would drop the Espressif library SHA and its separate license attribution.

### Join and electrical mapping

Normalize each source into a record keyed by GPIO number, then join `esp-gpio-tool` to `esp-metadata` by that number. From `esp-gpio-tool`, retain `power_domain`, strapping text, at-reset `PUP`/`PDOWN`, `is_output`, functions, SoC `reserved_pins` and `not_connected`, `sram_kb`, peripheral counts, and ADC2 `wifi_conflict`. From `esp-metadata`, retain the IO_MUX funcSel functions, `analog`, `lp`, limitations (`strapping`, `input_only`, `spi_flash`, `spi_psram`, `usb_jtag`, `jtag`), and numeric input/output signal IDs; read `soc.toml` for DMA engines/channels and memory map. Apply the P4 `func_in_sel_offset = 1` only to P4 input IDs.

Map the joined record to a physical pin by matching its GPIO name to a KiCad pad. Keep multi-function labels verbatim, for example `GPIO0/BOOT` and `ADC2_CH1`; emit power, reset, boot, and exposed-pad pins from symbol and footprint geometry. A record present in only one source or with no KiCad pad is emitted only when the available evidence is unambiguous; otherwise it is deferred with its source and reason. Small line-oriented readers handle only the declared fields; unexpected structure produces a deferral rather than an invented value.

Alternative: add generic YAML and TOML parser packages. Rejected to avoid a new dependency and to keep parse failures attributable per source.

### Module and bare-die shards

Emit one shard per named module or MPN with its flash capacity, and one shard per bare die with `flashKb: null`. The module manifest in `modules.ts` is derived from first-party module names in KiCad symbols and ESP-IDF variant tables; it holds only the base die, package, and flash mapping. `ESP32-WROOM-E` is emitted as a module shard with a numeric flash size. A module without first-party flash or pad evidence is deferred, never assigned a guessed size. Index entries carry `vendor: 'esp32'`, the family, and the same `flashKb` value as the shard; the shard-integrity gate treats `null` as valid only when both agree.

Alternative: one die shard with embedded module variants. Rejected because the gate requires a named `ESP32-WROOM-E` shard and the user decided module-level shards.

### Gates and warnings

The ESP32 adapter sets `strict: true`. Its gate list asserts: ESP32-C3 QFN32 with 32 pads and an exposed pad, GPIO2 at pad 6 with the strapping fact and flash-reserved pins; ESP32-WROOM-E pad 25 GPIO0/BOOT and pad 3 EN; ESP32 GPIO34 through GPIO39 input-only; matrix input and output signal counts against the pinned `gpio_sig_map.h`; absence of `NaN` and `undefined` using the existing `findInvalidValues` helper; and the four ESP32 source SHAs plus the `esp32` vendor summary in `meta.json`. Reference-value failures produce gate errors and abort before writes. Family shortfalls, one-sided joins, unmatched pads, and incomplete modules produce `ctx.warnings.add({ vendor: 'esp32', ... })` records and never abort. The global warnings-contract gate already validates those records.

Alternative: use the existing lenient `createReferencePartsGate`. Rejected because it converts errors to notes, which would let a broken reference part reach a release.

### Verification approach

Per-group verification uses `npx vitest run tests/data-gen-esp32.test.ts`, `npm run check`, and a focused `npm run gen-data` with gate output. Full verification requires `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`, followed by `openspec validate esp32-data-adapter-and-gates --strict` and `openspec archive esp32-data-adapter-and-gates -y` by the implementation agent after all tasks pass.

## Risks / Trade-offs

- Upstream format drift in YAML or TOML: narrow readers and reference gates detect drift; deferral keeps a single family from blocking the catalog.
- KiCad symbol naming differences across modules: an explicit alias map handles known names; unmatched pads are deferred instead of guessed.
- Incomplete module flash data: modules without first-party flash are deferred; bare dies use `flashKb: null`.
- More shards increase catalog size: emitted JSON omits unused fields and the 150 MB budget gate remains build-blocking.
- STM32 regression from shared helpers: changes are additive; STM32 golden and gate tests remain in the full suite.
- P4 offset applied to the wrong signal direction: a dedicated P4 assertion checks input IDs only.
- Espressif KiCad id collapsing into the generic KiCad id: an explicit canonical mapping test guards the rule.

## Migration Plan

No runtime migration is needed because generated data is gitignored. Land the schema dependency, add the adapter, regenerate the catalog locally, then run the full verification sequence. Rollback consists of removing the adapter from `DEFAULT_ADAPTERS` and its source declarations; no committed data needs reverting.

## Open Questions

None that would change the specs, approach, or task breakdown.

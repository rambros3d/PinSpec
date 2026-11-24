# Proposal: ESP32 Data Adapter and Gates

## Why

PinCraft has no ESP32 catalog data. The ESP32 families are described by first-party Espressif and esp-hal sources that can be converted mechanically into `ChipData` shards, but no generated JSON exists today. Without an adapter and build-blocking gates, ESP32 workspace work cannot rely on reproducible pin, pad, and signal data.

## What Changes

- Add `tools/data-gen/adapters/esp32/`, registered in `DEFAULT_ADAPTERS`, with `vendor: 'esp32'`, four `sourceSpecs`, strict per-vendor gates, and warning-backed deferral for unavailable records.
- Acquire four new upstream sources into gitignored `.cache/`: `espressif/esp-gpio-tool` (Apache-2.0), `esp-rs/esp-hal` `esp-metadata` (MIT / Apache-2.0), `espressif/kicad-libraries` (CC-BY-SA-4.0 generated-file exception), and ESP-IDF (Apache-2.0) pinned to a release tag. Record short SHA, URL, and license for each.
- Join first-party records by GPIO number (`esp-gpio-tool` to `esp-metadata`), then map to physical pads by KiCad pad number. Derive power, reset, boot, exposed-pad, input-only, strapping, flash/PSRAM-reserved, and ADC2 Wi-Fi-conflict facts; capture IO_MUX funcSel, GPIO matrix signal IDs, DMA channels, memory, and the P4 input-select offset. Preserve electrical constraints verbatim from first-party evidence.
- Cover all available families: `esp32`, `esp32-s2`, `esp32-s3`, `esp32-c2`, `esp32-c3`, `esp32-c6`, `esp32-h2`, `esp32-p4`, and `esp32-s31` from `esp-gpio-tool`, plus `esp32-c5`, `esp32-c61`, and `esp32-h4` from `esp-metadata`.
- Emit one shard per named module or MPN with its flash size; bare dies carry `flashKb: null`. Defer records with unavailable mapping data to `build-warnings.json` instead of failing the catalog.
- Add strict ESP32 gates for ESP32-C3 QFN32 pad geometry and flash-reserved pins, ESP32-WROOM-E pad 25 GPIO0/BOOT and pad 3 EN, ESP32 GPIO34-39 input-only, matrix signal counts against `gpio_sig_map.h`, no `NaN` or `undefined` values, and provenance SHAs.
- Extend `CatalogSourceId` from seven to eleven identifiers, add `esp32` to the provenance gate vendor list, and update count wording in metadata, index, warnings, README, AGENTS.md, and footer attribution data.
- Add `tests/data-gen-esp32.test.ts` and extend gate-contract, adapter-list, and docs-attribution tests.

## Capabilities

### New Capabilities

- `esp32-chip-data`: Build-time acquisition, first-party join, module and bare-die shard emission, and strict gate contracts for ESP32 chip and module pin data.

### Modified Capabilities

- `multi-vendor-ci-gates`: Extend source provenance and documentation attribution from seven to eleven canonical sources, add `esp32` to the provenance vendor list, allow nullable `flashKb` in shard integrity, and add a strict ESP32 generation gate plus an ESP32 deferred-data warning scenario.

## Impact

- New adapter modules under `tools/data-gen/adapters/esp32/` and new tests `tests/data-gen-esp32.test.ts`; extensions to `tools/data-gen/sources.ts`, `tools/data-gen/gates.ts`, `tools/data-gen/artifacts.ts` (source-id mapping), `tools/data-gen/index.ts` (adapter list), and `src/core/types.ts` (`CatalogSourceId`).
- New `public/data/chips/<ESP32_PART_OR_MODULE>.json` shards and `index.json` entries with `vendor: 'esp32'`; `meta.json` gains four canonical source records and an `esp32` vendor summary; `build-warnings.json` gains ESP32 deferral records.
- Depends on `esp32-schema-and-core-mux` for nullable `flashKb`, `VendorId`, and mux model extensions; depends on `esp32-ui-exporters-and-docs` for footer rendering of the additional sources. This change supplies the data and the gate contracts.
- No committed generated data, no backend, no new runtime dependency. Start-screen and starter-chip scope is limited to data availability; no ESP32 board presets are added.

## Dependencies

- `esp32-schema-and-core-mux`: generalized schema fields consumed by the adapter.
- `esp32-ui-exporters-and-docs`: rendering of the extended attribution data.

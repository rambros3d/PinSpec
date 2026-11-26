# Proposal: Nordic Data Adapter

## Why

PinSpec has no Nordic catalog data. nRF parts are described by machine-readable SVD, Zephyr device-tree/pinctrl, and KiCad symbol sources, but no generated JSON exists today. Without a build-time adapter and strict gates, Nordic parts cannot be planned in the workspace and no provenance-backed facts can be trusted.

## What Changes

- Add `tools/data-gen/adapters/nordic/`, registered in `DEFAULT_ADAPTERS`, with `vendor: 'nordic'`, `muxModel: 'psel'` as a fifth mux model (no AF number, `funcLabel` such as `UART_TX`), source specs, strict per-vendor gates, and warning-backed deferral.
- Acquire three upstream sources into gitignored `.cache/`: the nrf-pacs `nrf52840.svd` from the `master` branch (0BSD), Zephyr Nordic device tree plus pinctrl binding and header (Apache-2.0), and the KiCad `MCU_Nordic.kicad_sym` symbol (CC-BY-SA-4.0, generated-file exception). Record SHA, URL, and license for each. Add one canonical source id `nrf-pacs` and map the Nordic Zephyr and KiCad specs onto the existing `zephyr` and `kicad` canonical ids.
- Derive peripheral inventory, interrupts, GPIO counts, and memory from SVD and Zephyr DTS; derive physical pin numbers, ball IDs, multi-function names, and package pin count from the KiCad symbol; derive PSEL routing from Zephyr pinctrl names and function constants. Fixed pins (SWD, NFC, reset, QSPI) are emitted only when a machine-readable symbol name or DTS property supports them. Every other value is deferred to `build-warnings.json`, never hand-curated.
- Add strict Nordic gates asserting the nRF52840-QIAA reference part against the pin set derived from the acquired KiCad symbol, its SVD/DTS peripheral inventory, and at least one PSEL `funcLabel` with a null AF. Emit nRF5340 and nRF54L15 only when their own machine-readable sources are present and complete; otherwise defer with vendor-attributed warnings.
- Add the `psel` mux model to core types and reuse the existing matrix-aware scoring for flexible routing. Apply input-only and strapping penalties only where source data declares those tags; do not synthesize strapping facts.
- Extend provenance and documentation wording from twelve to thirteen canonical sources and from five to six vendors, add `nordic` to the provenance vendor list and vendor tabs, and update `README.md`, `AGENTS.md`, footer attribution data, and related tests.
- Add `tests/data-gen-nordic.test.ts` with synthetic SVD, DTS, and KiCad fixtures, and extend adapter-list, gate-contract, docs-attribution, and vendor-tab tests.

## Capabilities

### New Capabilities

- `nordic-chip-data`: Build-time acquisition and parsing of Nordic SVD, Zephyr device-tree/pinctrl, and KiCad symbol data into provenance-tagged Nordic catalog shards, including PSEL routing, evidence-backed fixed pins, strict gates, and deferral of parts without complete physical-pin evidence.

### Modified Capabilities

- `multi-vendor-ci-gates`: Move the provenance and documentation contracts from twelve to thirteen canonical sources and from five to six vendors, add `nordic` to the provenance vendor list and deferred-part warning scenarios, and register a strict Nordic generation gate in the shared gate suite.

## Impact

- New adapter modules under `tools/data-gen/adapters/nordic/` and new tests in `tests/data-gen-nordic.test.ts`; additive changes to `tools/data-gen/sources.ts`, `tools/data-gen/gates.ts`, `tools/data-gen/artifacts.ts`, `tools/data-gen/index.ts`, `src/core/types.ts`, and `src/core/vendor-view.ts`.
- New `public/data/chips/<NORDIC_PART>.json` shards and `index.json` entries with `vendor: 'nordic'` and `muxModel: 'psel'`; `meta.json` gains one canonical source record and a `nordic` vendor summary; `build-warnings.json` records Nordic deferrals.
- STM32 adapter logic, STM32 reference gates, and STM32 shard bytes stay unchanged. Existing canonical source records for KiCad and Zephyr keep their current primary SHAs and URLs because the Nordic source-spec ids do not displace the existing alphabetical primaries.
- No committed generated data, no backend, no new runtime dependency, and no legacy version-1 import path. Vendor-specific exporter dispatch and board presets are outside this change.

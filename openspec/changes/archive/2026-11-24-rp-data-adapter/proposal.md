# Proposal

## Why

PinSpec's catalog currently covers STM32 only, so Raspberry Pi RP2040 / RP2350A / RP2350B / RP2354A / RP2354B parts cannot be planned in the workspace. The project decision is to generate all catalog data in CI from machine-readable upstream references, so RP support needs an adapter that derives physical pins and FUNCSEL mux data from those references rather than a hand-maintained pin table.

## What Changes

- Add `tools/data-gen/adapters/rp/` and wire it into the data-generation orchestrator alongside the STM32 adapter.
- Fetch and parse KiCad `kicad-symbols` `MCU_RaspberryPi.kicad_symdir/*.kicad_sym` s-expressions for RP2040, RP2350A, RP2350B, RP2354A and RP2354B: physical pad numbers (1-57/61/81), pad names (`GPIO0`, `GPIO26/ADC0`, `IOVDD`, `VREG_*`, `QSPI_*`, `SWCLK`, `RUN`), exposed pad (GND) and electrical types; use footprints for package geometry. Never hand-maintain pin tables.
- Join with RP FUNCSEL data from `raspberrypi/picotool` (`main.cpp` `pin_functions_rp2040` / `pin_functions_rp2350`) or pico-sdk `hardware/gpio.h` Doxygen F0-F11 tables, keyed by GPIO number parsed from the KiCad pin name. Derive PWM `resourceId` (`PWM0A`..`PWM11B`) from the FUNCSEL table itself, not by modulo arithmetic.
- Pull SRAM / flash / variant facts from Zephyr `rp2040.dtsi` / `rp2350*.dtsi` and the `raspberrypi/documentation` `rp2040.adoc` / `rp2350.adoc` variant table; RP2354A/B record 2 MB stacked flash.
- Emit `ChipData` with `vendor: 'rp'` and `muxModel: 'funcsel-pio'`: `funcLabel` (F1-F9 for RP2040, F0-F11 plus HSTX for RP235x), `resourceId`, `PinTag` tags (`hstx`, `adc`, `qspi`, `debug-swd`, `usb`, `5v-tolerant`), and `ChipPioConfig` (`gpioBaseOptions` `[0]` or `[0, 16]`, PIO instances and state machines).
- Add per-vendor Gate assertions: RP2040 QFN-56 (56 pins), RP2350A (60), RP2350B (80), RP2354A/B with 2 MB flash, PWM slices 8-11 only on RP2350B, RP2350B ADC0-7 on GPIO40-47, HSTX/QSPI tags, EP GND, `build-warnings.json` for unresolved symbols/parts.
- Record upstream SHAs and license attribution (KiCad CC-BY-SA-4.0 with generated-file exception; pico-sdk/picotool BSD-3-Clause; Zephyr Apache-2.0) in `meta.json` `sources.rp` and in the technical footer.
- No backward-compatibility shims: RP chips are emitted in the new schema consumed by the multi-vendor core.

## Capabilities

### New Capabilities
- `rp-chip-data`: CI-generated RP2040/RP235x chip catalog data, including physical pins, FUNCSEL mux tables, tags, PIO configuration and per-vendor gate assertions.

### Modified Capabilities
(None. `openspec/specs/` is empty; there are no existing specs to modify.)

## Impact

- Data pipeline: `tools/data-gen/index.ts` (orchestrator, emitter, gates), new `tools/data-gen/adapters/rp/` parser/normalizer, `tools/data-gen/helpers.ts` shared helpers; new `.cache/` clone targets for KiCad GitLab, picotool/pico-sdk and Zephyr/documentation references.
- Generated output (gitignored): `public/data/chips/RP*.json`, `public/data/index.json`, `public/data/meta.json`, `public/data/build-warnings.json`.
- CI: `.github/workflows/deploy.yml` runs the expanded `npm run gen-data`; no generated data committed.
- Consumers: hero chip preview lazy-fetches generated chip JSON; catalog store and landing footer read `meta.json` provenance. `src/core/types.ts` already declares the vendor/mux/PinTag fields consumed here.
- Verification: `tests/data-gen.test.ts` parser/normalizer cases; `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`.

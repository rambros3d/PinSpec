# Tasks

## 1. Source acquisition and fixtures

- [x] 1.1 Add CI-side fetch helpers for KiCad `kicad-symbols` `MCU_RaspberryPi.kicad_symdir`, `raspberrypi/picotool` / pico-sdk FUNCSEL data, and Zephyr `rp2040.dtsi` / `rp2350*.dtsi` plus `raspberrypi/documentation` variant tables, recording SHAs; verify `.cache/` paths appear after `npm run gen-data` with an empty cache and no reference data is modified.
- [x] 1.2 Add parser fixtures and unit tests in `tests/data-gen.test.ts` for KiCad s-expression symbol structure (pad numbers, multi-name pads, EP GND, electrical types) and both FUNCSEL source shapes; verify `npm test` passes the fixture cases.

## 2. RP parser and normalizer

- [x] 2.1 Implement the KiCad symbol/footprint parser that emits physical pins, power/ground classification, exposed pad and package geometry for RP2040, RP2350A, RP2350B, RP2354A and RP2354B; verify emitted chips carry `vendor: 'rp'` and `muxModel: 'funcsel-pio'` and tests assert 56/60/80 pin counts.
- [x] 2.2 Implement the FUNCSEL join keyed by GPIO number parsed from the pad name, emitting `af`, `funcLabel`, and table-derived PWM `resourceId` (`PWM0A`..`PWM11B`, slices 8-11 RP2350B-only); verify tests cover RP2040 F1-F9, RP235x F0-F11 with HSTX, `GPIO26/ADC0` joining and `PWM7B`-style IDs without modulo math.
- [x] 2.3 Implement variant metadata normalization (Zephyr memory sizes, documentation variant table, RP2354A/B 2 MB stacked flash, RP2350B ADC0-7 on GPIO40-47) and `ChipPioConfig` with `gpioBaseOptions` `[0]` or `[0,16]`; verify tests assert the flash value, ADC pin placement, PIO instances and base options.

## 3. Tags, warnings, attribution and gates

- [x] 3.1 Emit RP `PinTag` values (`adc`, `qspi`, `debug-swd`, `usb`, `5v-tolerant`, `hstx`) and route unresolved symbols/FUNCSEL entries into `public/data/build-warnings.json` without aborting generation; verify tests assert tag presence and that an unparseable fixture produces a warning rather than a failure.
- [x] 3.2 Wire the RP adapter into the generator orchestrator and shared emitters (`index.json`, `meta.json`, `sources.rp` with SHAs and CC-BY-SA-4.0 / BSD-3-Clause / Apache-2.0 attribution); verify `npm run gen-data` emits `RP*.json` shards and the landing footer can read provenance from `meta.json`.
- [x] 3.3 Add RP Gate assertions for 56/60/80 pins, GPIO counts, EP GND, PWM slice boundaries, HSTX/ADC tags, RP2354A/B flash and per-vendor match metrics; verify `npm run gen-data` passes with all assertions and `meta.json` `sources.rp` chip counts match the emitted shards.

## 4. Integration verification

- [x] 4.1 Run the full verification sequence `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; verify zero warnings, no committed generated data (`git status` clean for `public/data/`, `.cache/`, `dist/`), and unchanged STM32 gate results.

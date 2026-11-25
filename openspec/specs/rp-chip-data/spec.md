# rp-chip-data Specification

## Purpose

Defines the CI-generated Raspberry Pi RP2040 / RP2350 / RP2354 chip catalog data, including physical pins, FUNCSEL mux tables, tags, PIO configuration and per-vendor gates, so the workspace can plan RP parts without any hand-maintained pin tables.

## Requirements

### Requirement: RP sources are fetched and joined in CI
The data generator MUST fetch RP reference data from machine-readable upstreams during generation and MUST NOT rely on a hand-maintained pin table; all emitted pin data derives from those sources. Missing or unparseable sources MUST be recorded in `build-warnings.json` without aborting the whole catalog.

#### Scenario: CI generation fetches all RP upstreams
- **WHEN** the data generation step runs with an empty `.cache/`
- **THEN** it clones or fetches the KiCad, FUNCSEL and Zephyr/documentation references and emits RP chip JSON for every covered package

#### Scenario: Unresolved RP source is warned
- **WHEN** an RP symbol file or FUNCSEL table cannot be parsed
- **THEN** the affected part is recorded in `public/data/build-warnings.json` and generation continues with the remaining parts

### Requirement: RP physical pins are normalized from KiCad symbols
The generator MUST parse KiCad s-expression symbols to emit each RP chip's physical pad positions (1-57, 61 or 81 depending on package), pad names such as `GPIO0` / `GPIO26/ADC0` / `IOVDD` / `VREG_*` / `QSPI_*` / `SWCLK` / `RUN`, electrical types, power/ground classification, the exposed pad as GND, and package geometry from footprints. Each emitted chip MUST set `vendor: 'rp'` and `muxModel: 'funcsel-pio'`.

#### Scenario: RP2040 QFN-56 physical pins emit
- **WHEN** the RP2040 QFN-56 symbol is parsed
- **THEN** the emitted chip has 56 physical pins, an exposed-pad GND entry and typed power/ground pins

#### Scenario: Multi-name pad is preserved
- **WHEN** a pad name contains a slash such as `GPIO26/ADC0`
- **THEN** the full name is preserved for display and the GPIO number 26 is used for the FUNCSEL join

### Requirement: RP FUNCSEL and resource identifiers are derived
The generator MUST join FUNCSEL data to pins by GPIO number and emit per-signal `af` (FUNCSEL index) with a `funcLabel`. It MUST emit RP2040 functions F1-F9 and RP235x functions F0-F11 including HSTX. PWM `resourceId` values (`PWM0A`..`PWM11B`) MUST be derived from the FUNCSEL table entries themselves, not computed by modulo arithmetic.

#### Scenario: RP2040 SPI FUNCSEL is emitted
- **WHEN** an RP2040 GPIO with SPI0 SCK on F1 is normalized
- **THEN** the pin signal carries `af: 1`, `funcLabel: 'F1'` and the joined peripheral/signal name

#### Scenario: RP2350 HSTX is emitted
- **WHEN** an RP235x HSTX function is present in the FUNCSEL table
- **THEN** the affected GPIOs carry an `hstx` tag and a function with the HSTX `funcLabel`

#### Scenario: PWM slice identity comes from the table
- **WHEN** a GPIO maps to PWM slice 7 channel B in the FUNCSEL table
- **THEN** the emitted signal has `resourceId: 'PWM7B'` derived from the table value

### Requirement: RP variant facts and PIO configuration are emitted
The generator MUST emit per-part SRAM and flash from Zephyr/documentation, record RP2354A/B as 2 MB stacked flash, restrict PWM slices 8-11 to RP2350B, place RP2350B ADC0-7 on GPIO40-47 as package-exclusive pins, and emit `ChipPioConfig` with PIO instances, state machines per instance and `gpioBaseOptions` of `[0]` or `[0, 16]`.

#### Scenario: RP2354 flash and PIO base options
- **WHEN** RP2354A or RP2354B is emitted
- **THEN** its flash is recorded as 2 MB stacked and `gpioBaseOptions` contains `[0, 16]`

#### Scenario: RP2350B exclusive ADC and slices
- **WHEN** RP2350B is emitted
- **THEN** ADC0-7 are assigned to GPIO40-47 and PWM slices 8-11 appear only on this package

### Requirement: RP tags, attribution and gate assertions are emitted

The generator MUST emit `PinTag` values (`adc`, `qspi`, `debug-swd`, `usb`, `5v-tolerant`, `hstx`), record upstream SHAs and license attribution (KiCad CC-BY-SA-4.0 generated-file exception; pico-sdk/picotool BSD-3-Clause; Zephyr Apache-2.0) in `meta.json` `sources.rp`, and enforce gate assertions for every covered part.

#### Scenario: Gate assertions check pin counts and tags

- **WHEN** `npm run gen-data` completes
- **THEN** assertions verify RP2040 QFN-56 (56 pins), RP2350A (60), RP2350B (80) and RP2354A/B, plus GPIO counts, PWM slice boundaries and HSTX/ADC/EP tags

#### Scenario: Provenance is recorded

- **WHEN** RP data is emitted
- **THEN** `meta.json` `sources.rp` includes upstream SHAs and attribution consumed by the About provenance table

# rp-chip-data Delta

## MODIFIED Requirements

### Requirement: RP tags, attribution and gate assertions are emitted

The generator MUST emit `PinTag` values (`adc`, `qspi`, `debug-swd`, `usb`, `5v-tolerant`, `hstx`), record upstream SHAs and license attribution (KiCad CC-BY-SA-4.0 generated-file exception; pico-sdk/picotool BSD-3-Clause; Zephyr Apache-2.0) in `meta.json` `sources.rp`, and enforce gate assertions for every covered part.

#### Scenario: Gate assertions check pin counts and tags

- **WHEN** `npm run gen-data` completes
- **THEN** assertions verify RP2040 QFN-56 (56 pins), RP2350A (60), RP2350B (80) and RP2354A/B, plus GPIO counts, PWM slice boundaries and HSTX/ADC/EP tags

#### Scenario: Provenance is recorded

- **WHEN** RP data is emitted
- **THEN** `meta.json` `sources.rp` includes upstream SHAs and attribution consumed by the About provenance table

# Spec Delta

## MODIFIED Requirements

### Requirement: Source provenance in metadata

`meta.json` MUST record `generatedAt`, a short SHA for every upstream source, per-vendor part counts, per-vendor match or coverage ratios, and twelve upstream source identifiers. Per-vendor counts and ratios MUST be recorded for `stm32`, `ch32`, `rp`, `esp32`, and `microchip`.

#### Scenario: Metadata is complete

- **WHEN** generation succeeds for all five vendors
- **THEN** `meta.json` contains all twelve source SHAs and per-vendor counts and ratios, and the landing footer can render them

#### Scenario: Source SHA missing

- **WHEN** any upstream source SHA or per-vendor count is absent from `meta.json`
- **THEN** the gate fails generation

#### Scenario: ESP32 provenance records present

- **WHEN** generation succeeds with the ESP32 adapter registered
- **THEN** `meta.json` contains non-empty SHA, URL, and license records for esp-gpio-tool, esp-hal esp-metadata, espressif/kicad-libraries, and ESP-IDF, plus an `esp32` vendor summary with chip count and ratios

#### Scenario: SAM provenance records present

- **WHEN** generation succeeds with the SAM adapter registered
- **THEN** `meta.json` contains a non-empty SHA, URL, and Apache-2.0 license record for the Microchip ATDF source, plus a `microchip` vendor summary with chip count and ratios

### Requirement: Multi-vendor documentation and attribution

`README.md` and `AGENTS.md` MUST document multi-vendor data generation, the gate commands, and the verification sequence, and the landing technical footer MUST list all twelve upstream sources with their licenses and render the SHAs and counts from `meta.json`. Documentation MUST cover STM32, CH32, RP, ESP32, and SAM generation.

#### Scenario: Documentation reflects shipped behavior

- **WHEN** the change is complete
- **THEN** README and AGENTS.md describe STM32, CH32, RP, ESP32, and SAM generation and the footer lists all twelve sources with licenses and live metadata

#### Scenario: Footer omits a license

- **WHEN** any of the twelve upstream licenses is missing from the footer or documentation
- **THEN** the documentation verification check fails

#### Scenario: ESP32 attribution data available

- **WHEN** `meta.json` is generated with the ESP32 adapter registered
- **THEN** the four added ESP32 sources carry license and SHA values that the footer and documentation checks can render

#### Scenario: SAM attribution data available

- **WHEN** `meta.json` is generated with the SAM adapter registered
- **THEN** the Microchip ATDF source carries an Apache-2.0 license and a SHA value that the footer and documentation checks can render

## ADDED Requirements

### Requirement: SAM generation gate

The release gate suite SHALL register the SAM adapter's strict gates in `npm run gen-data` alongside the STM32, CH32, RP, and ESP32 gates. Registered SAM gate errors SHALL abort generation with a non-zero exit and no partial catalog; SAM notes and non-blocking shortfalls SHALL be recorded as attributed warnings with vendor `microchip`.

#### Scenario: SAM gate registered in the suite

- **WHEN** generation runs with the SAM adapter registered in the default adapter list
- **THEN** the SAM gate results appear in the generation summary together with the other vendor gate results

#### Scenario: Strict SAM gate failure blocks release

- **WHEN** any registered SAM gate reports an error
- **THEN** generation exits non-zero, reports the failing assertion, and writes no catalog artifacts

#### Scenario: Non-blocking SAM shortfall is attributed

- **WHEN** a SAM gate reports a note or a non-blocking shortfall such as a missing DMA channel map
- **THEN** generation continues and the shortfall is recorded in `build-warnings.json` with vendor `microchip`

### Requirement: Canonical source identifier coverage

The twelve canonical source identifiers SHALL be ST open pin data, Embassy stm32-data-generated, ch32-device-data, KiCad, pico-sdk, Zephyr, Raspberry Pi docs, esp-gpio-tool, esp-hal esp-metadata, espressif/kicad-libraries, ESP-IDF at a pinned release tag, and Microchip ATDF dev packs at a pinned ref. Every identifier SHALL resolve to a recorded SHA, URL, and license.

#### Scenario: All twelve identifiers are recorded

- **WHEN** generation succeeds with all adapters registered
- **THEN** `meta.json` contains a SHA, URL, and license for each of the twelve identifiers

#### Scenario: Microchip ATDF identifier is present

- **WHEN** generation succeeds with the SAM adapter registered
- **THEN** the `microchip-atdf` record carries a SHA-256 content hash, the pinned raw-file URL, and the Apache-2.0 license

#### Scenario: Canonical identifier missing

- **WHEN** any of the twelve identifiers is absent from `meta.json`
- **THEN** the provenance gate fails generation and names the missing identifier

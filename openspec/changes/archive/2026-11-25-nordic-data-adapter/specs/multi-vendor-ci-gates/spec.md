# Spec Delta

## MODIFIED Requirements

### Requirement: Source provenance in metadata

`meta.json` MUST record `generatedAt`, a short SHA for every upstream source, per-vendor part counts, per-vendor match or coverage ratios, and thirteen canonical source identifiers. Per-vendor counts and ratios MUST be recorded for `stm32`, `ch32`, `rp`, `esp32`, `microchip`, and `nordic`.

#### Scenario: Metadata is complete

- **WHEN** generation succeeds for all six vendors
- **THEN** `meta.json` contains all thirteen source SHAs and per-vendor counts and ratios, and the landing footer can render them

#### Scenario: Source SHA missing

- **WHEN** any upstream source SHA or per-vendor count is absent from `meta.json`
- **THEN** the gate fails generation

#### Scenario: ESP32 provenance records present

- **WHEN** generation succeeds with the ESP32 adapter registered
- **THEN** `meta.json` contains non-empty SHA, URL, and license records for esp-gpio-tool, esp-hal esp-metadata, espressif/kicad-libraries, and ESP-IDF, plus an `esp32` vendor summary with chip count and ratios

#### Scenario: SAM provenance records present

- **WHEN** generation succeeds with the SAM adapter registered
- **THEN** `meta.json` contains a non-empty SHA, URL, and Apache-2.0 license record for the Microchip ATDF source, plus a `microchip` vendor summary with chip count and ratios

#### Scenario: Nordic provenance records present

- **WHEN** generation succeeds with the Nordic adapter registered
- **THEN** `meta.json` contains a non-empty `nrf-pacs` source record and a `nordic` vendor summary with chip count and ratios, and the Nordic Zephyr and KiCad file evidence appears in the `nordic` vendor record

### Requirement: Deferred-part warning contract

`build-warnings.json` MUST always exist, containing an empty array when there are no warnings, and MUST record every deferred or unmapped part with its id, vendor, source, and reason. An unmapped part MUST be recorded and MUST NOT fail the whole catalog.

#### Scenario: Unmapped CH32 variant deferred

- **WHEN** a covered-source part lacks a curated package mapping
- **THEN** generation continues and that part appears in `build-warnings.json` with its id, vendor, source, and reason

#### Scenario: No warnings

- **WHEN** every source part maps successfully
- **THEN** `build-warnings.json` is present and contains an empty array

#### Scenario: ESP32 unavailable evidence deferred

- **WHEN** an ESP32 part or module lacks flash, pad, or signal evidence in the acquired sources
- **THEN** generation continues and that record appears in `build-warnings.json` with its id, vendor `esp32`, source, and reason

#### Scenario: Nordic part without physical-pin evidence deferred

- **WHEN** a Nordic pilot selector lacks complete machine-readable physical-pin evidence in the acquired SVD, device-tree, or KiCad sources
- **THEN** generation continues and that part appears in `build-warnings.json` with its id, vendor `nordic`, source, and reason

### Requirement: Multi-vendor documentation and attribution

`README.md` and `AGENTS.md` MUST document multi-vendor data generation, the gate commands, and the verification sequence, and the landing technical footer MUST list all thirteen upstream sources with their licenses and render the SHAs and counts from `meta.json`. Documentation MUST cover STM32, CH32, RP, ESP32, SAM, and Nordic generation.

#### Scenario: Documentation reflects shipped behavior

- **WHEN** the change is complete
- **THEN** README and AGENTS.md describe STM32, CH32, RP, ESP32, SAM, and Nordic generation and the footer lists all thirteen sources with licenses and live metadata

#### Scenario: Footer omits a license

- **WHEN** any of the thirteen upstream licenses is missing from the footer or documentation
- **THEN** the documentation verification check fails

#### Scenario: ESP32 attribution data available

- **WHEN** `meta.json` is generated with the ESP32 adapter registered
- **THEN** the four added ESP32 sources carry license and SHA values that the footer and documentation checks can render

#### Scenario: SAM attribution data available

- **WHEN** `meta.json` is generated with the SAM adapter registered
- **THEN** the Microchip ATDF source carries an Apache-2.0 license and a SHA value that the footer and documentation checks can render

#### Scenario: Nordic attribution data available

- **WHEN** `meta.json` is generated with the Nordic adapter registered
- **THEN** the nrf-pacs source, the Nordic Zephyr and KiCad evidence records, and the `nordic` vendor summary carry license and SHA values that the footer and documentation checks can render

### Requirement: Canonical source identifier coverage

The thirteen canonical source identifiers SHALL be ST open pin data, Embassy stm32-data-generated, ch32-device-data, KiCad, pico-sdk, Zephyr, Raspberry Pi docs, esp-gpio-tool, esp-hal esp-metadata, espressif/kicad-libraries, ESP-IDF at a pinned release tag, Microchip ATDF dev packs at a pinned ref, and nrf-pacs. Every identifier SHALL resolve to a recorded SHA, URL, and license.

#### Scenario: All thirteen identifiers are recorded

- **WHEN** generation succeeds with all adapters registered
- **THEN** `meta.json` contains a SHA, URL, and license for each of the thirteen identifiers

#### Scenario: Microchip ATDF identifier is present

- **WHEN** generation succeeds with the SAM adapter registered
- **THEN** the `microchip-atdf` record carries a SHA-256 content hash, the pinned raw-file URL, and the Apache-2.0 license

#### Scenario: Nordic identifier is present

- **WHEN** generation succeeds with the Nordic adapter registered
- **THEN** the `nrf-pacs` record carries a SHA, the pinned SVD URL, and the 0BSD license

#### Scenario: Canonical identifier missing

- **WHEN** any of the thirteen identifiers is absent from `meta.json`
- **THEN** the provenance gate fails generation and names the missing identifier

## ADDED Requirements

### Requirement: Nordic generation gate

The release gate suite SHALL register the Nordic adapter's strict gates in `npm run gen-data` alongside the STM32, CH32, RP, and ESP32 gates. Registered Nordic gate errors SHALL abort generation with a non-zero exit and no partial catalog; Nordic gate notes and non-blocking shortfalls SHALL be recorded as attributed warnings.

#### Scenario: Nordic gate registered in the suite

- **WHEN** generation runs with the Nordic adapter registered in the default adapter list
- **THEN** the Nordic gate results appear in the generation summary together with the other vendor gate results

#### Scenario: Strict Nordic gate failure blocks release

- **WHEN** any registered Nordic gate reports an error
- **THEN** generation exits non-zero, reports the failing assertion, and writes no catalog artifacts

#### Scenario: Non-blocking Nordic shortfall is attributed

- **WHEN** a Nordic gate reports a note or a non-blocking shortfall
- **THEN** generation continues and the shortfall is recorded in `build-warnings.json` with vendor `nordic`

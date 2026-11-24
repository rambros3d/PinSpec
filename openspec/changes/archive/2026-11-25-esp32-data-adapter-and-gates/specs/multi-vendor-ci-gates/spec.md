# Spec Delta

## MODIFIED Requirements

### Requirement: Artifact budget and shard integrity

Total generated JSON under `public/data/` MUST stay below 150 MB uncompressed and every `index.json` entry MUST resolve to a parseable `chips/<MCU>.json` shard whose id, vendor, and pin count agree with the index and which contains no `NaN` or `undefined` values. A bare die with no module flash capacity MAY carry `flashKb: null` in both the shard and the index; where a numeric flash size exists, the shard and the index MUST agree on it.

#### Scenario: Budget and shards valid

- **WHEN** generation finishes and the summed shard size is under 150 MB with all index entries resolving to consistent shards
- **THEN** the gate passes

#### Scenario: Broken shard or over-budget catalog

- **WHEN** an index entry has no matching shard, a shard disagrees with the index, or the total exceeds 150 MB
- **THEN** generation exits non-zero and reports the offending shard or byte total

#### Scenario: Bare die flash is null

- **WHEN** an ESP32 bare die has no module flash capacity and both its shard and index entry carry `flashKb: null`
- **THEN** the shard integrity gate accepts the entry without requiring a numeric flash value

#### Scenario: Flash size disagrees with index

- **WHEN** a module shard carries a different numeric `flashKb` than its index entry
- **THEN** generation exits non-zero and reports the mismatched shard

### Requirement: Source provenance in metadata

`meta.json` MUST record `generatedAt`, a short SHA for every upstream source, per-vendor part counts, per-vendor match or coverage ratios, and the eleven upstream source identifiers (ST open pin data, Embassy stm32-data-generated, ch32-device-data, KiCad, pico-sdk, Zephyr, Raspberry Pi docs, esp-gpio-tool, esp-hal esp-metadata, espressif/kicad-libraries, and ESP-IDF at a pinned release tag). Per-vendor counts and ratios MUST be recorded for `stm32`, `ch32`, `rp`, and `esp32`.

#### Scenario: Metadata is complete

- **WHEN** generation succeeds for all four vendors
- **THEN** `meta.json` contains all eleven source SHAs and per-vendor counts and ratios, and the landing footer can render them

#### Scenario: Source SHA missing

- **WHEN** any upstream source SHA or per-vendor count is absent from `meta.json`
- **THEN** the gate fails generation

#### Scenario: ESP32 provenance records present

- **WHEN** generation succeeds with the ESP32 adapter registered
- **THEN** `meta.json` contains non-empty SHA, URL, and license records for esp-gpio-tool, esp-hal esp-metadata, espressif/kicad-libraries, and ESP-IDF, plus an `esp32` vendor summary with chip count and ratios

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

### Requirement: Multi-vendor documentation and attribution

`README.md` and `AGENTS.md` MUST document multi-vendor data generation, the gate commands, and the verification sequence, and the landing technical footer MUST list all eleven upstream sources with their licenses and render the SHAs and counts from `meta.json`. Documentation MUST cover STM32, CH32, RP, and ESP32 generation.

#### Scenario: Documentation reflects shipped behavior

- **WHEN** the change is complete
- **THEN** README and AGENTS.md describe STM32, CH32, RP, and ESP32 generation and the footer lists all eleven sources with licenses and live metadata

#### Scenario: Footer omits a license

- **WHEN** any of the eleven upstream licenses is missing from the footer or documentation
- **THEN** the documentation verification check fails

#### Scenario: ESP32 attribution data available

- **WHEN** `meta.json` is generated with the ESP32 adapter registered
- **THEN** the four added ESP32 sources carry license and SHA values that the footer and documentation checks can render

## ADDED Requirements

### Requirement: ESP32 generation gate

The release gate suite SHALL register the ESP32 adapter's strict gates in `npm run gen-data` alongside the STM32, CH32, and RP gates. Registered ESP32 gate errors SHALL abort generation with a non-zero exit and no partial catalog; ESP32 gate notes and non-blocking shortfalls SHALL be recorded as attributed warnings.

#### Scenario: ESP32 gate registered in the suite

- **WHEN** generation runs with the ESP32 adapter registered in the default adapter list
- **THEN** the ESP32 gate results appear in the generation summary together with the other vendor gate results

#### Scenario: Strict ESP32 gate failure blocks release

- **WHEN** any registered ESP32 gate reports an error
- **THEN** generation exits non-zero, reports the failing assertion, and writes no catalog artifacts

#### Scenario: Non-blocking ESP32 shortfall is attributed

- **WHEN** an ESP32 gate reports a note or a non-blocking shortfall
- **THEN** generation continues and the shortfall is recorded in `build-warnings.json` with vendor `esp32`

# multi-vendor-ci-gates Specification

## Purpose

Defines the acceptance gates and provenance, warning, CI, and documentation contracts that certify a releasable multi-vendor PinCraft catalog without regressing the STM32 baseline.

## Requirements

### Requirement: STM32 generation gate
`npm run gen-data` SHALL emit at least 1000 STM32 MCUs and MUST pass reference assertions on STM32F411CEU6, STM32G431CBU6, STM32F103C8T6, STM32H743VIT6, STM32U575RIT6, and STM32H743XIH6, checking package name, pin count, power pins, key AF mappings, SYS signals, and DMA/TFBGA-grid entries. A failed assertion MUST abort generation with a non-zero exit and MUST NOT publish a partial catalog.

#### Scenario: STM32 baseline passes
- **WHEN** generation completes with all six reference parts matching their asserted package, pin count, power pins, AF, SYS, and DMA/grid values
- **THEN** the command exits zero and `index.json` lists at least 1000 STM32 entries

#### Scenario: STM32 reference regression
- **WHEN** any reference assertion fails, such as STM32F103C8T6 exposing a non-null AFIO AF or STM32H743XIH6 missing ordered grid rows
- **THEN** generation exits non-zero and no partial catalog is published

### Requirement: CH32 generation gate
The gate MUST verify that all 105 parts covered by `ch32-device-data` are emitted and MUST assert structural correctness of priority parts CH32V003F4P6 (20 pins), CH32V003J4M6 (8 bonded pins), CH32V203C8T6 (48 pins), and CH32X035G8U6 (28 pins), including `muxModel: remap-group`, grouped `remaps[]`, `bondedNames` and `bonded` tags on multi-bonded SOP8 pins, and the `debug-sdi` tag on PD1.

#### Scenario: CH32 covered parts pass
- **WHEN** generation emits the 105 covered parts and each priority part carries the expected pin count, remap groups, and tags
- **THEN** the gate passes and `meta.json` records the CH32 covered-part count

#### Scenario: CH32 priority part missing
- **WHEN** a priority part is absent or its expected pin count or bonded/remap structure is incorrect
- **THEN** generation exits non-zero and identifies the failing part

### Requirement: RP generation gate
The gate MUST assert RP2040 at 56 pins, RP2350A at 60 pins, and RP2350B at 80 pins, with GPIO counts of 30, 30, and 48 respectively, an exposed-pad flag on the QFN packages, `muxModel: funcsel-pio` with `funcLabel` and `resourceId` values spanning PWM slice boundaries `PWM0A` through `PWM11B`, plus HSTX, ADC, QSPI, SWD, and PIO instance tags.

#### Scenario: RP family passes
- **WHEN** the three parts have the asserted pin and GPIO counts, exposed pad, full PWM slice range, and required tags
- **THEN** the gate passes and `meta.json` records the RP part count

#### Scenario: RP slice boundary invalid
- **WHEN** a chip omits a `PWM0A` or `PWM11B` resource key or declares an out-of-range slice
- **THEN** generation exits non-zero and names the invalid resource

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

`meta.json` MUST record `generatedAt`, a short SHA for every upstream source, per-vendor part counts, per-vendor match or coverage ratios, and thirteen canonical source identifiers. Per-vendor counts and ratios MUST be recorded for `stm32`, `ch32`, `rp`, `esp32`, `microchip`, and `nordic`.

#### Scenario: Metadata is complete

- **WHEN** generation succeeds for all six vendors
- **THEN** `meta.json` contains all thirteen source SHAs and per-vendor counts and ratios, and the About provenance table can render them

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

### Requirement: CI multi-source refresh workflow
The deploy workflow MUST fetch all upstream sources used by the adapters, force-refresh the gitignored `.cache/` clones on the weekly schedule, record the resulting SHAs, and run `npm ci`, `npm run gen-data`, `npm test`, `npm run check`, and the subpath build in order. Existing push/manual/weekly triggers and the `upload-pages-artifact@v5` and `deploy-pages@v4` actions MUST remain.

#### Scenario: Weekly scheduled build
- **WHEN** the scheduled weekly run triggers the workflow
- **THEN** all source caches are refreshed, SHAs are recorded, and the full verification sequence runs before deployment

#### Scenario: A verification step fails
- **WHEN** generation, tests, checks, or the subpath build fails
- **THEN** the workflow exits non-zero and does not upload or deploy an artifact

### Requirement: Subpath build and runtime fetch verification
Every runtime asset and data fetch MUST resolve relative to `import.meta.env.BASE_URL`. Under `BASE_PATH="/pincraft/"`, verification MUST confirm that the built `index.html`, `data/index.json`, and a sample `data/chips/<MCU>.json` are reachable and that the build contains no root-absolute `/data/` or `/assets/` request.

#### Scenario: Subpath build verified
- **WHEN** the production build is served under `/pincraft/`
- **THEN** the page, catalog index, and a sample chip shard resolve with no broken subpath requests

#### Scenario: Hardcoded absolute path
- **WHEN** a data or asset URL is constructed from a root-absolute `/` path instead of `BASE_URL`
- **THEN** verification fails and identifies the offending URL

### Requirement: Multi-vendor documentation and attribution

`README.md` and `AGENTS.md` MUST document multi-vendor data generation, the gate commands, and the verification sequence. About owns the provenance reference: it MUST list all thirteen upstream sources with their licenses and render SHAs and counts from `meta.json`. Documentation MUST cover STM32, CH32, RP, ESP32, SAM, and Nordic generation and MUST NOT claim a landing technical footer.

#### Scenario: Documentation reflects shipped behavior

- **WHEN** the change is complete
- **THEN** README and AGENTS.md describe STM32, CH32, RP, ESP32, SAM, and Nordic generation, the About table lists all thirteen sources with licenses and live metadata, and no landing footer is claimed

#### Scenario: Footer omits a license

- **WHEN** any of the thirteen upstream licenses is missing from About or documentation
- **THEN** the documentation verification check fails

#### Scenario: ESP32 attribution data available

- **WHEN** `meta.json` is generated with the ESP32 adapter registered
- **THEN** the four added ESP32 sources carry license and SHA values that the About table and documentation checks can render

#### Scenario: SAM attribution data available

- **WHEN** `meta.json` is generated with the SAM adapter registered
- **THEN** the Microchip ATDF source carries an Apache-2.0 license and a SHA value that the About table and documentation checks can render

#### Scenario: Nordic attribution data available

- **WHEN** `meta.json` is generated with the Nordic adapter registered
- **THEN** the nrf-pacs source, the Nordic Zephyr and KiCad evidence records, and the `nordic` vendor summary carry license and SHA values that the About table and documentation checks can render

### Requirement: No emojis and no stray color literals
Delivered files MUST NOT contain emoji characters and MUST NOT introduce raw color literals outside `src/themes/daisyui.css`; new UI MUST use existing semantic tokens from `src/app.css`.

#### Scenario: Emoji scan
- **WHEN** a repository scan for emoji characters runs over files touched by this change
- **THEN** no matches are found

#### Scenario: Color token check
- **WHEN** new UI markup is reviewed for raw hex or `rgb()` color literals
- **THEN** none exist outside `src/themes/daisyui.css`

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

### Requirement: Index geometry gate

The shard-integrity gate SHALL reject any index entry whose `vendor` is missing or disagrees with its shard, whose `geometry` is absent or disagrees with the shard's package kind, sides, rows, columns, or exposed-pad flag, or which reintroduces `peripherals` or `series`. Geometry checks SHALL treat omitted optional perimeter or grid fields as equivalent to their generated absence and MUST NOT invent values.

#### Scenario: Geometry agrees with the shard

- **WHEN** generation finishes with each index entry carrying the exact geometry of its shard
- **THEN** the shard-integrity gate passes for all six vendors

#### Scenario: Divergent or missing geometry is rejected

- **WHEN** an index entry declares different sides, rows, columns, or exposed-pad state than its shard, or omits geometry entirely
- **THEN** generation exits non-zero and identifies the offending entry

#### Scenario: Removed index fields are rejected

- **WHEN** an index entry still carries peripheral counts or an upstream series field
- **THEN** generation exits non-zero before any artifact is written

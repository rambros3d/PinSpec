# Spec Delta

## Purpose

Defines the acceptance gates and provenance, warning, CI, and documentation contracts that certify a releasable multi-vendor PinCraft catalog without regressing the STM32 baseline.

## ADDED Requirements

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
Total generated JSON under `public/data/` MUST stay below 150 MB uncompressed and every `index.json` entry MUST resolve to a parseable `chips/<MCU>.json` shard whose id, vendor, and pin count agree with the index and which contains no `NaN` or `undefined` values.

#### Scenario: Budget and shards valid
- **WHEN** generation finishes and the summed shard size is under 150 MB with all index entries resolving to consistent shards
- **THEN** the gate passes

#### Scenario: Broken shard or over-budget catalog
- **WHEN** an index entry has no matching shard, a shard disagrees with the index, or the total exceeds 150 MB
- **THEN** generation exits non-zero and reports the offending shard or byte total

### Requirement: Source provenance in metadata
`meta.json` MUST record `generatedAt`, a short SHA for every upstream source, per-vendor part counts, per-vendor match or coverage ratios, and the seven upstream source identifiers (ST open pin data, Embassy stm32-data-generated, ch32-device-data, KiCad, pico-sdk, Zephyr, and Raspberry Pi docs).

#### Scenario: Metadata is complete
- **WHEN** generation succeeds for all three vendors
- **THEN** `meta.json` contains all seven source SHAs and per-vendor counts and ratios, and the landing footer can render them

#### Scenario: Source SHA missing
- **WHEN** any upstream source SHA or per-vendor count is absent from `meta.json`
- **THEN** the gate fails generation

### Requirement: Deferred-part warning contract
`build-warnings.json` MUST always exist, containing an empty array when there are no warnings, and MUST record every deferred or unmapped part with its id, vendor, source, and reason. An unmapped part MUST be recorded and MUST NOT fail the whole catalog.

#### Scenario: Unmapped CH32 variant deferred
- **WHEN** a covered-source part lacks a curated package mapping
- **THEN** generation continues and that part appears in `build-warnings.json` with its id, vendor, source, and reason

#### Scenario: No warnings
- **WHEN** every source part maps successfully
- **THEN** `build-warnings.json` is present and contains an empty array

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
`README.md` and `AGENTS.md` MUST document multi-vendor data generation, the gate commands, and the verification sequence, and the landing technical footer MUST list all seven upstream sources with their licenses and render the SHAs and counts from `meta.json`.

#### Scenario: Documentation reflects shipped behavior
- **WHEN** the change is complete
- **THEN** README and AGENTS.md describe STM32, CH32, and RP generation and the footer lists all seven sources with licenses and live metadata

#### Scenario: Footer omits a license
- **WHEN** any of the seven upstream licenses is missing from the footer or documentation
- **THEN** the documentation verification check fails

### Requirement: No emojis and no stray color literals
Delivered files MUST NOT contain emoji characters and MUST NOT introduce raw color literals outside `src/themes/daisyui.css`; new UI MUST use existing semantic tokens from `src/app.css`.

#### Scenario: Emoji scan
- **WHEN** a repository scan for emoji characters runs over files touched by this change
- **THEN** no matches are found

#### Scenario: Color token check
- **WHEN** new UI markup is reviewed for raw hex or `rgb()` color literals
- **THEN** none exist outside `src/themes/daisyui.css`

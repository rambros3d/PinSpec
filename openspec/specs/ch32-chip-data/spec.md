# ch32-chip-data Specification

## Purpose

Defines how WCH CH32 reference CSV data becomes complete, provenance-tagged catalog entries with physical pin geometry, remap groups, bonded pads, and explicit deferral of unsupported parts.

## Requirements

### Requirement: Verified CH32 source ingestion
The CH32 adapter SHALL verify the SHA-256 digest of every consumed CSV file against `index/manifest.csv` before parsing and MUST abort CH32 generation on any mismatch.

#### Scenario: All digests match
- **WHEN** generation reads `parts.csv`, `pinout.csv`, `routes.csv`, `packages.csv`, and the evidence CSVs with matching manifest digests
- **THEN** the adapter parses them and continues generating CH32 parts

#### Scenario: Digest mismatch
- **WHEN** a consumed CSV file's computed SHA-256 differs from its manifest entry
- **THEN** CH32 generation fails with an error naming the file, and no CH32 chip shards are written

### Requirement: Complete covered-part emission
The adapter SHALL emit one `ChipData` entry for each of the 105 part numbers listed in `index/parts.csv`, with `vendor: 'ch32'` and `muxModel: 'remap-group'`.

#### Scenario: Full catalog generation
- **WHEN** the CH32 adapter completes against the current upstream dataset
- **THEN** exactly the covered part numbers are present as chip shards and `index.json` entries, each tagged with the CH32 vendor and remap-group mux model

#### Scenario: Part stem not covered by the source
- **WHEN** a requested CH32 stem has no matching part rows or pinout rows
- **THEN** the part is skipped, a warning with an explicit reason is recorded, and all covered parts are still emitted

### Requirement: Physical pin geometry and memory
Each emitted CH32 chip SHALL describe its physical leads using package positions from the source, mark an exposed pad when present, map source electrical kinds to the catalog pin types, and carry flash and RAM sizes derived from the part record.

#### Scenario: Package with exposed pad
- **WHEN** a part's package includes an `EP` lead
- **THEN** the emitted package has `hasExposedPad: true` and the exposed pad is represented without duplicating physical lead positions

#### Scenario: Mixed electrical pin kinds
- **WHEN** a part has GPIO, power, analog, NC, and other electrical kinds
- **THEN** each pin's `type` is one of the catalog pin types and the pin count equals the package's physical lead count

### Requirement: Bonded pads and semantic tags
The adapter SHALL populate `bondedNames` and the `bonded` tag when multiple internal pads share one physical lead, and SHALL apply debug, USB, ADC, boot, and 5-volt-tolerant tags only where source evidence supports them.

#### Scenario: Bonded SOP8 lead
- **WHEN** two GPIO pads map to the same physical pin on CH32V003J4M6
- **THEN** that pin lists both pad names in `bondedNames`, carries the `bonded` tag, and emits one physical pin entry

#### Scenario: Debug and USB evidence
- **WHEN** a pin is identified as WCH 1-wire debug, SWD, USB/PD, or ADC-capable by the source
- **THEN** the emitted pin includes the corresponding `debug-sdi`, `debug-swd`, `usb`, or `adc` tag

### Requirement: Remap-group signal model
The adapter SHALL group each peripheral's signals by source route into `PeripheralInfo.remaps`, setting `remapId`, display labels, and register notes from remap evidence, with `af` set to `null` for CH32 signals.

#### Scenario: Default and alternate routes
- **WHEN** a signal has `main`, `default`, and `remap-N` route rows with selector metadata
- **THEN** each route becomes a remap option with a distinct `remapId`, the signal's pin mapping, and a register note when evidence provides one

#### Scenario: Peripheral with no remap evidence
- **WHEN** a peripheral has only default-route signals
- **THEN** it still emits signal data with remap ID zero and no fabricated register note

### Requirement: Warning-backed deferral
Uncovered stems, low-confidence records, and unparsable rows SHALL be written to `build-warnings.json` with vendor `ch32`, a part reference, and an explicit reason, and MUST NOT fail catalog generation.

#### Scenario: Low-confidence pinout rows
- **WHEN** upstream rows are flagged with low confidence
- **THEN** those parts are deferred with a reason mentioning confidence and generation continues for all other CH32 parts

### Requirement: CH32 reference assertions
Generation SHALL assert the emitted CH32V003F4P6, CH32V003J4M6, CH32V203C8T6, and CH32X035G8U6 parts against their expected pin counts and package characteristics before the CH32 gate passes.

#### Scenario: Reference parts are correct
- **WHEN** the CH32 adapter emits 20, 8, 48, and 28 pin packages for those four parts respectively
- **THEN** the CH32 gate passes and logs a per-part result

#### Scenario: Reference part is malformed
- **WHEN** a reference part has an unexpected pin count or missing pins
- **THEN** the CH32 gate fails with an error naming the part and the observed value

### Requirement: CH32 provenance and attribution
Generated metadata SHALL record the CH32 source revision, license, and emitted chip count under `meta.json.sources.ch32`, and the project documentation SHALL credit that source.

#### Scenario: Inspecting generated provenance
- **WHEN** CH32 generation completes
- **THEN** `meta.json.sources.ch32` contains a non-empty revision, the MIT license, and the count of emitted CH32 parts, and `README.md` credits the upstream repository

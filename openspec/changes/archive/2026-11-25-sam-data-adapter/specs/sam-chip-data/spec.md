# Spec Delta

## Purpose

Defines the build-time conversion of Microchip ATDF device files into provenance-tagged SAM chip shards, including variant scope, physical pins, function-letter alternate functions, memory and interrupt facts, strict gates, and warning-backed deferral.

## ADDED Requirements

### Requirement: SAM ATDF source acquisition

Catalog generation SHALL fetch the curated ATDF files as raw files from a pinned `Microchip-MPLAB-Harmony/dev_packs` ref into the gitignored cache, recording a SHA-256 content revision, URL, and Apache-2.0 license under the canonical source id `microchip-atdf`. A missing or unparseable ATDF file SHALL be recorded in `build-warnings.json` and SHALL NOT abort the whole catalog.

#### Scenario: Curated ATDF files are acquired

- **WHEN** generation runs with an empty SAM source cache
- **THEN** every declared ATDF file is fetched from the pinned ref and its SHA-256, URL, and license appear in `meta.json`

#### Scenario: Existing cache is reused

- **WHEN** generation runs with the declared ATDF files already cached
- **THEN** the existing files are reused and the recorded SHA-256 is unchanged

#### Scenario: ATDF file is unavailable

- **WHEN** a declared ATDF file cannot be fetched or parsed
- **THEN** the affected part is recorded in `build-warnings.json` with vendor `microchip`, source `microchip-atdf`, and a reason, and generation continues with the remaining parts

### Requirement: SAM part scope and variant metadata

Generation SHALL emit a curated 39-part subset spanning SAM D21, SAM D51, SAM E51, and SAMV71, with one shard and `index.json` entry per ATDF part stem. Every `<variant>` ordercode of a part SHALL be recorded on its shard with package, temperature range, and voltage range from the ATDF; ordercodes SHALL NOT create extra shards. Emitted entries SHALL carry `vendor: 'microchip'` and `muxModel: 'af'`.

#### Scenario: Curated parts are emitted

- **WHEN** generation completes with all declared ATDF files present
- **THEN** exactly 39 `microchip` entries exist in `index.json` with matching chip shards

#### Scenario: Variant ordercodes are preserved

- **WHEN** an ATDF part declares several ordercodes with different packages or temperature ranges
- **THEN** the shard lists those ordercodes with their ATDF package and electrical ranges and still has one physical pinout

#### Scenario: Part outside the curated set

- **WHEN** an ATDF file in the pack is not part of the curated subset
- **THEN** no shard is emitted for it and no warning is required

### Requirement: SAM physical pin geometry

The adapter SHALL derive physical pin positions and names from `<pinouts><pin position pad>` and SHALL use the `<variant package>` value for package identity. Pin types SHALL be classified from ATDF pad names and signal evidence only. Power, ground, and reset pads SHALL be emitted as distinct pins, and a package-exposed pad SHALL be marked when ATDF declares one. No pin number SHALL be invented where ATDF omits a position.

#### Scenario: D21 QFN48 pinout is emitted

- **WHEN** the ATSAMD21G18A ATDF declares 48 ordered pins for the `SAMD21G` pinout
- **THEN** the emitted shard has 48 physical pins whose positions and pad names match the ATDF entries

#### Scenario: Power and reset pads

- **WHEN** the pinout contains `VDDIO`, `GNDIO`, and `RESET_N` pads
- **THEN** those pads are emitted as power, ground, and reset pins at their ATDF positions

#### Scenario: Missing position

- **WHEN** an ATDF pin entry lacks a position attribute
- **THEN** the pin is deferred to `build-warnings.json` instead of receiving a guessed number

### Requirement: SAM function-letter alternate functions

The adapter SHALL join module instance signals to physical pins by pad name and SHALL map a single-letter ATDF `function` to a numeric `af` index by alphabetical position with A as zero. A non-letter function such as `default`, `XIN`, or `XOUT32` SHALL be emitted with `af: null` and its source label preserved. Peripheral and signal identities SHALL come from the ATDF module instance name, `group`, and `index`; the `af` mux model SHALL be reused without adding a new mux model.

#### Scenario: Function letter becomes an AF index

- **WHEN** an instance signal has `function="C"` for a pad
- **THEN** the emitted signal on that pad carries `af: 2` and keeps the ATDF group and index label

#### Scenario: Non-letter function is preserved

- **WHEN** a PORT signal has `function="default"` or an oscillator signal has `function="XIN32"`
- **THEN** the emitted signal carries `af: null` and the original function label, with no numeric fallback

#### Scenario: Signal join has no pad match

- **WHEN** an instance signal names a pad absent from the selected pinout
- **THEN** the signal is omitted from that shard and the gap is recorded in `build-warnings.json`

### Requirement: SAM memory, interrupt, and DMA evidence

Flash and RAM sizes SHALL be derived from ATDF `<memory-segment>` entries using their `type` and `size` values. Interrupt and instance parameter names SHALL be retained as capability evidence where present. DMA channel assignments SHALL be emitted only when ATDF declares them; a chip whose ATDF lacks a channel map SHALL be recorded in `build-warnings.json` with vendor and source attribution instead of receiving inferred channel numbers.

#### Scenario: Flash and RAM are derived

- **WHEN** a part declares FLASH and SRAM memory segments with explicit sizes
- **THEN** the shard and index entry carry the corresponding `flashKb` and `ramKb` values

#### Scenario: DMA map is absent

- **WHEN** an ATDF declares DMA instance parameters but no channel-to-signal map
- **THEN** the part is emitted and a warning records the missing DMA channel evidence

#### Scenario: Memory segment size is unreadable

- **WHEN** a memory segment has no parseable size
- **THEN** the value is omitted and a warning records the missing evidence rather than substituting a default

### Requirement: SAM data gate assertions

Generation SHALL assert, before writing artifacts, the exact 39-part count, the presence and pin counts of `ATSAMD21G18A` (48), `ATSAMD51P20A` (128 and 120 pinouts), `ATSAME51J20A` (64), and `ATSAMV71Q21B` (144), the `microchip` vendor and `af` mux model on each shard, the presence of function-letter AF indices, and the `microchip-atdf` SHA in `meta.json`. A failed assertion SHALL abort generation with a non-zero exit and no partial catalog.

#### Scenario: SAM reference parts pass

- **WHEN** all four reference shards match their asserted pin counts, vendor, and mux model
- **THEN** the gate passes and logs a per-part result

#### Scenario: AF mapping reference is missing

- **WHEN** ATSAMD21G18A has no signal with a function-letter AF index
- **THEN** generation exits non-zero and names the failing assertion

#### Scenario: Provenance SHA is absent

- **WHEN** `meta.json` lacks the `microchip-atdf` SHA
- **THEN** generation exits non-zero and publishes no catalog artifacts

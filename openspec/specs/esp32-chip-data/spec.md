# esp32-chip-data Specification

## Purpose

Defines the build-time conversion of first-party Espressif, esp-hal, KiCad, and ESP-IDF reference data into provenance-tagged ESP32 chip and module catalog shards, including electrical constraints and strict generation gates.

## Requirements

### Requirement: ESP32 source acquisition

Catalog generation SHALL acquire four additional upstream sources into gitignored local caches: `espressif/esp-gpio-tool`, `esp-hal` `esp-metadata`, `espressif/kicad-libraries`, and ESP-IDF at a pinned release tag. Each source SHALL contribute a resolved SHA, URL, and license to provenance metadata without crashing when a revision is unavailable.

#### Scenario: Clean ESP32 source acquisition

- **WHEN** generation runs with empty ESP32 source caches
- **THEN** all four sources are fetched, each with a non-empty SHA, URL, and license in `meta.json`

#### Scenario: Existing ESP32 source cache

- **WHEN** generation runs with the four ESP32 source caches already present
- **THEN** the existing files are reused and their recorded SHAs are unchanged

#### Scenario: ESP-IDF release pinning

- **WHEN** ESP-IDF headers are acquired for gate evidence
- **THEN** the declared release tag is fixed in the source declaration and the recorded SHA corresponds to that tag

#### Scenario: Source revision unavailable

- **WHEN** an ESP32 source checkout cannot expose a revision
- **THEN** the source revision is recorded as `unknown` and generation continues

### Requirement: ESP32 first-party GPIO join

The adapter SHALL join `esp-gpio-tool` target GPIO records to `esp-hal` `esp-metadata` GPIO records by GPIO number. The joined record SHALL carry the IO_MUX funcSel functions, analog and low-power capability, strapping and input-only and flash and PSRAM and JTAG limitations, GPIO matrix input and output signal IDs, SoC DMA channels, and memory sizes. RP2350-style assumptions SHALL NOT be applied; a P4 record SHALL apply the declared input-select offset of one to matrix input IDs.

#### Scenario: GPIO numbers align across sources

- **WHEN** a GPIO number exists in both `esp-gpio-tool` and `esp-metadata`
- **THEN** the emitted record contains functions, limitations, and matrix signal IDs from both sources without duplicate signal identities

#### Scenario: P4 input select offset

- **WHEN** an ESP32-P4 matrix input signal ID is joined
- **THEN** the emitted resource ID reflects the declared offset of one rather than the raw metadata index

#### Scenario: One-sided GPIO record

- **WHEN** a GPIO number is present in only one first-party source
- **THEN** the available fields are emitted and the gap is recorded in `build-warnings.json` without aborting the catalog

### Requirement: ESP32 physical pad mapping

The adapter SHALL map joined GPIO records to physical pads using `espressif/kicad-libraries` symbol and footprint pad numbers. Emitted pins SHALL carry pad-number-based physical positions and the source pin names, including multi-function labels such as `GPIO0/BOOT`. Power, reset, boot, and exposed thermal pads SHALL be emitted as distinct pins. A joined record with no matching KiCad pad SHALL be deferred with a reason rather than guessed.

#### Scenario: Multi-function pad label

- **WHEN** an ESP32 QFN48 symbol pad carries both a GPIO name and a boot name
- **THEN** the emitted pin keeps the full label and resolves to the symbol pad number

#### Scenario: Power and reset pads

- **WHEN** a module symbol declares enable and boot pads
- **THEN** those pads are emitted with their reset or boot type and KiCad pad number

#### Scenario: Unmatched pad

- **WHEN** a joined GPIO record has no KiCad pad in its package
- **THEN** that record is deferred to `build-warnings.json` with its source and reason

### Requirement: ESP32 family coverage and shards

Catalog generation SHALL emit entries for all available ESP32 families: `esp32`, `esp32-s2`, `esp32-s3`, `esp32-c2`, `esp32-c3`, `esp32-c6`, `esp32-h2`, `esp32-p4`, and `esp32-s31` from `esp-gpio-tool`, plus `esp32-c5`, `esp32-c61`, and `esp32-h4` from `esp-metadata`. Each named module or MPN SHALL be emitted as its own `index.json` entry and chip shard with its flash size; a bare die SHALL carry `flashKb: null`. Every emitted shard SHALL be parseable and free of `NaN` and `undefined` values.

#### Scenario: All available families emitted

- **WHEN** generation completes with all four sources present
- **THEN** `index.json` contains entries for all twelve available family identifiers with `vendor: 'esp32'`

#### Scenario: Module shard flash size

- **WHEN** a named module has a declared flash capacity
- **THEN** its shard and index entry carry that flash size in kilobytes

#### Scenario: Bare die flash null

- **WHEN** a bare die has no module flash capacity
- **THEN** its shard and index entry carry `flashKb: null` without a fallback number

#### Scenario: Invalid shard value

- **WHEN** an ESP32 shard contains a non-finite number or an `undefined` value
- **THEN** generation fails and identifies the offending shard and value

### Requirement: ESP32 electrical correctness

Emitted ESP32 data SHALL preserve first-party electrical constraints without inferred values, including power domain, pull state, strapping, input-only, flash and PSRAM reserved pins, JTAG restrictions, the ADC2 Wi-Fi conflict, and SoC reserved pins. Facts SHALL appear in pin types, tags, notes, or signal metadata so planning cannot assign an electrically invalid pin.

#### Scenario: Strapping and pull state preserved

- **WHEN** a GPIO is marked strapping with an at-reset pull in `esp-gpio-tool`
- **THEN** the emitted pin carries the strapping note and the recorded pull direction

#### Scenario: Input-only and reserved pins

- **WHEN** ESP32 GPIO34 through GPIO39 are emitted and SoC reserved pins are declared
- **THEN** those pins are marked input-only or unavailable for output according to the source, and no output-capable assignment is implied

#### Scenario: ADC2 Wi-Fi conflict

- **WHEN** an ADC2 channel signal is emitted for a chip with a Wi-Fi conflict declaration
- **THEN** the signal carries the conflict note from the first-party source

#### Scenario: Exposed pad and JTAG restrictions

- **WHEN** a package declares an exposed thermal pad or a JTAG or USB-JTAG limitation
- **THEN** the emitted pin carries the exposed-pad geometry or the recorded restriction note

### Requirement: ESP32 generation gates

Generation SHALL evaluate strict ESP32 gates before writing any artifact. The gates SHALL assert the required C3 and WROOM-E pad geometry and electrical facts, GPIO34-39 input-only, matrix signal counts against the pinned `gpio_sig_map.h`, no `NaN` or `undefined` in shards, and all four source SHAs. A failed assertion SHALL abort generation with a non-zero exit and no partial catalog.

#### Scenario: ESP32 reference gates pass

- **WHEN** the asserted chips and module shards match the required pad numbers, pin counts, electrical facts, signal counts, and source SHAs
- **THEN** generation exits zero and writes the ESP32 entries together with the other vendors

#### Scenario: C3 and WROOM-E reference values

- **WHEN** the ESP32-C3 QFN32 and ESP32-WROOM-E shards are generated
- **THEN** the gate requires 32 physical pads and an exposed pad on C3, GPIO2 at pad 6 with its strapping fact and flash-reserved pins, GPIO0/BOOT at pad 25, and EN at pad 3 on WROOM-E

#### Scenario: Input-only reference pins

- **WHEN** ESP32 GPIO34 through GPIO39 are generated
- **THEN** the gate requires each of those pins to be marked input-only

#### Scenario: Pad or electrical assertion fails

- **WHEN** ESP32-C3 pad 6 loses its strapping fact or ESP32-WROOM-E pad 25 is not GPIO0/BOOT
- **THEN** generation exits non-zero, names the failing assertion, and publishes no partial catalog

#### Scenario: Matrix signal count mismatch

- **WHEN** an emitted matrix signal count disagrees with the pinned `gpio_sig_map.h`
- **THEN** generation exits non-zero and identifies the chip and signal direction

#### Scenario: Missing ESP32 source SHA

- **WHEN** any of the four ESP32 source SHAs is absent from `meta.json`
- **THEN** the provenance check fails generation

### Requirement: ESP32 deferred-data warnings

Any ESP32 part, module, pad, or signal whose first-party evidence is unavailable or ambiguous SHALL be recorded in `build-warnings.json` with its identifier, vendor, source, and reason. Deferred records SHALL NOT fail the catalog, while the strict gates in this capability SHALL remain build-blocking.

#### Scenario: Unavailable module evidence deferred

- **WHEN** a named module lacks flash or pad evidence in the acquired sources
- **THEN** generation continues and the module appears in `build-warnings.json` with vendor `esp32` and an explicit reason

#### Scenario: Deferred part does not block emission

- **WHEN** one ESP32 family has incomplete evidence and the other families are complete
- **THEN** the complete families are emitted and only the incomplete family is deferred

#### Scenario: No ESP32 deferrals

- **WHEN** every acquired ESP32 record maps without ambiguity
- **THEN** `build-warnings.json` contains no ESP32 records while remaining present

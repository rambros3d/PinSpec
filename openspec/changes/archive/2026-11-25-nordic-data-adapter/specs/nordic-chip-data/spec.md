# Spec Delta

## Purpose

Defines the build-time conversion of Nordic SVD, Zephyr device-tree/pinctrl, and KiCad symbol data into provenance-tagged catalog shards with PSEL routing, evidence-backed fixed pins, strict gates, and deferral of parts without complete physical-pin evidence.

## ADDED Requirements

### Requirement: Nordic source acquisition

Catalog generation SHALL acquire the nrf-pacs SVD from the `master` branch, the Zephyr Nordic device tree plus pinctrl binding and header, and the KiCad Nordic symbol into gitignored local caches. Each source SHALL contribute a resolved SHA, URL, and license to provenance metadata, and an unavailable revision SHALL be recorded as `unknown` without crashing.

#### Scenario: Clean Nordic source acquisition

- **WHEN** generation runs with empty Nordic source caches
- **THEN** all three sources are fetched with non-empty SHA, URL, and license records in `meta.json`

#### Scenario: Existing Nordic source cache

- **WHEN** generation runs with the Nordic source caches already present
- **THEN** the existing files are reused and their recorded SHAs are unchanged

#### Scenario: SVD branch recorded

- **WHEN** the nrf-pacs SVD is acquired
- **THEN** the recorded URL names the `master` branch and the recorded SHA identifies the fetched SVD

#### Scenario: Nordic source revision unavailable

- **WHEN** a Nordic source cannot expose a revision
- **THEN** its revision is recorded as `unknown` and generation continues

### Requirement: Nordic SVD and device-tree normalization

The adapter SHALL derive peripheral inventory, interrupt assignments, GPIO counts, and memory sizes from the acquired SVD and device-tree sources only. Physical pin numbers SHALL NOT be inferred from register maps, and absent facts SHALL be deferred rather than estimated.

#### Scenario: Peripheral inventory from SVD

- **WHEN** the acquired SVD declares peripheral instances and interrupts
- **THEN** the emitted chip carries those peripheral names and interrupt identifiers without added entries

#### Scenario: GPIO count from device tree

- **WHEN** a Nordic device-tree node declares `ngpios`
- **THEN** the emitted GPIO count equals that declared value

#### Scenario: Memory size from upstream sources

- **WHEN** an SVD or device-tree source declares a memory size
- **THEN** the emitted memory value comes from that declaration and no fallback size is invented

#### Scenario: No physical pins from registers

- **WHEN** an SVD contains register and address-block elements but no package geometry
- **THEN** no physical pin is emitted from that register data

### Requirement: Nordic physical pin derivation

The adapter SHALL derive physical positions and pin names from KiCad symbol `number` and `name` values, including ball identifiers and multi-function labels. Package pin count SHALL come from those same symbol entries, and an exposed pad SHALL be emitted only when the acquired symbol or footprint declares one.

#### Scenario: Ball identifier as physical position

- **WHEN** a Nordic KiCad symbol entry carries a ball identifier such as `A8` in its number field
- **THEN** that identifier is emitted as the physical position verbatim

#### Scenario: Multi-function label preserved

- **WHEN** a symbol entry carries a name such as `AIN7/P0.31`
- **THEN** the emitted pin keeps the full name and derives its GPIO identity from the `P0.31` segment

#### Scenario: Package pin count from symbol entries

- **WHEN** the Nordic symbol is parsed
- **THEN** the emitted pin count equals the count of physical pin entries derived from that symbol

#### Scenario: Exposed pad requires evidence

- **WHEN** the acquired symbol or footprint does not declare an exposed thermal pad
- **THEN** no exposed-pad pin or exposed-pad flag is emitted

### Requirement: Nordic PSEL routing and mux model

Nordic signals SHALL be emitted with PSEL routing: `funcLabel` taken from Zephyr pinctrl function names, `af` set to null, and eligibility for any GPIO declared by the device tree. The mux model SHALL be `psel`, and allocation SHALL use the existing flexible-routing scarcity ranking without AF numbers.

#### Scenario: PSEL function label

- **WHEN** the pinctrl binding and header name a function such as `UART_TX`
- **THEN** the emitted signal carries `UART_TX` as its `funcLabel`

#### Scenario: Null alternate function

- **WHEN** a Nordic signal is emitted
- **THEN** its `af` value is null and no numbered AF is displayed for it

#### Scenario: Routing across declared GPIOs

- **WHEN** a PSEL signal has no fixed-pin evidence in the acquired sources
- **THEN** every GPIO declared by the device tree is a candidate for that signal

#### Scenario: Flexible-routing allocation

- **WHEN** a PSEL plan is allocated
- **THEN** pins hosting fewer unallocated competing signals are preferred under the shared scarcity ranking

### Requirement: Nordic fixed-pin evidence and deferral

Fixed Nordic pins (SWD, NFC, reset, QSPI) and electrical tags SHALL appear only when the acquired symbol names or device-tree properties declare them. Undeclared fixed pins, strapping state, and input-only behavior SHALL be recorded as unavailable in `build-warnings.json` and MUST NOT be synthesized.

#### Scenario: Fixed pin from symbol name

- **WHEN** a KiCad symbol name declares an SWD or NFC function for a physical pin
- **THEN** that pin carries the corresponding fixed-pin tag derived from the symbol name

#### Scenario: No invented strapping

- **WHEN** no acquired source declares strapping behavior for a Nordic pin
- **THEN** that pin carries no strapping tag and the gap is recorded as unavailable

#### Scenario: Input-only only with evidence

- **WHEN** an acquired source marks a pin as input-only
- **THEN** the pin carries the input-only tag and no output-capable role is implied

#### Scenario: Undeclared QSPI recorded

- **WHEN** QSPI pin assignment cannot be derived from the acquired symbol or device tree
- **THEN** generation continues and the gap appears in `build-warnings.json` with vendor `nordic`

### Requirement: Nordic pilot coverage and warnings

Catalog generation SHALL attempt the declared pilot selectors nRF52840-QIAA, nRF5340, and nRF54L15. A part SHALL be emitted only when its SVD, device-tree, and KiCad symbol evidence yields a complete physical pin set; otherwise it SHALL be deferred with its identifier, vendor, and source-specific reason.

#### Scenario: Reference part emitted

- **WHEN** the nRF52840 pilot selector has complete SVD, device-tree, and KiCad symbol evidence
- **THEN** an `nRF52840-QIAA` entry and shard are emitted with `vendor: 'nordic'` and `muxModel: 'psel'`

#### Scenario: Dual-core part emitted

- **WHEN** both application and network core sources for nRF5340 are present and map to one complete symbol pin set
- **THEN** a single nRF5340 shard is emitted describing both cores

#### Scenario: Incomplete part deferred

- **WHEN** nRF54L15 lacks a complete machine-readable physical pin set
- **THEN** generation continues and nRF54L15 appears in `build-warnings.json` with vendor `nordic` and an explicit reason

#### Scenario: No partial shard

- **WHEN** a pilot selector has a symbol name with no matching device-tree GPIO identity
- **THEN** no shard or index entry is emitted for that part

### Requirement: Nordic generation gates

Generation SHALL evaluate strict Nordic gates before writing any artifact. The gates SHALL assert the nRF52840-QIAA reference part against the KiCad-derived pin set and SVD/device-tree peripheral inventory, at least one PSEL `funcLabel` with a null AF, an emitted part count, and all Nordic source SHAs. A failed assertion SHALL abort generation with a non-zero exit and no partial catalog.

#### Scenario: Nordic reference gates pass

- **WHEN** the reference part matches its derived pin set, peripheral inventory, PSEL label, and source SHAs
- **THEN** generation exits zero and writes the Nordic entries together with the other vendors

#### Scenario: Pin set mismatch blocks release

- **WHEN** the nRF52840-QIAA shard pins disagree with the acquired KiCad symbol entries
- **THEN** generation exits non-zero, names the failing assertion, and publishes no partial catalog

#### Scenario: Missing PSEL label blocks release

- **WHEN** no emitted Nordic signal carries a `funcLabel` with a null `af`
- **THEN** generation exits non-zero and identifies the missing PSEL evidence

#### Scenario: Missing Nordic source SHA

- **WHEN** any Nordic source SHA is absent from `meta.json`
- **THEN** the provenance check fails generation

#### Scenario: Deferred part is not a gate failure

- **WHEN** a pilot part without complete physical-pin evidence is recorded in `build-warnings.json`
- **THEN** generation continues while the strict reference gates remain build-blocking

# Spec Delta

## MODIFIED Requirements

### Requirement: Mux labels are vendor-correct in every pin view
All pin views SHALL present mux labels using the shared mux-label helper and the chip's mux model: `AF<n>` for STM32, `F<n>` or `PIO` for RP, `RM<n>` for CH32, the matrix route display label or signal name for ESP32, and the GPIO mode for plain GPIO. Hardcoded `AFIO`/`AF<n>` fallback text SHALL NOT appear for a non-AF chip.

#### Scenario: CH32 pin popover
- **WHEN** a CH32 assignment with `remapId` 1 is inspected in the pin popover
- **THEN** the signal is labeled `RM1` and no `AFIO` label is shown

#### Scenario: RP canvas tooltip
- **WHEN** an RP pin with FUNCSEL index 6 and no display override is hovered
- **THEN** the tooltip reads `F6` and a PIO-bound pin without FUNCSEL reads `PIO`

#### Scenario: ESP32 matrix tooltip
- **WHEN** an ESP32 pin with a matrix route display label is hovered
- **THEN** the tooltip shows that display label and no `AF` or `F` index fallback

### Requirement: Catalog discovery is vendor aware
Quick search and the MCU switcher SHALL expose vendor filter tabs and vendor-aware family/package filters, and SHALL restrict results and the MCU list to the selected vendor and filters. The vendor set SHALL include `esp32` in addition to the existing three vendors, and the compatible-MCU finder SHALL offer the same vendor filter options.

#### Scenario: Filter to RP parts
- **WHEN** a user selects the RP vendor tab and searches by family or package
- **THEN** only RP chips matching the family/package filters are listed

#### Scenario: Clear vendor filter
- **WHEN** the user clears the vendor tab
- **THEN** chips from all vendors are listed again

#### Scenario: Filter to ESP32 parts
- **WHEN** a user selects the ESP32 vendor tab and searches by family or package
- **THEN** only ESP32 chips matching the family/package filters are listed

#### Scenario: Compatible-MCU vendor options
- **WHEN** the compatible-MCU finder vendor filter is opened
- **THEN** it offers STM32, CH32, RP, and ESP32 and can restrict candidates to ESP32

### Requirement: Export previews and provenance reflect all vendors
The export modal SHALL present tabs that invoke the vendor-aware exporters and show copy/download controls for each format, and the landing footer and workspace copy SHALL describe multi-vendor coverage and credit the STM32, CH32, RP, and ESP32 upstream data sources without STM32-only claims. The Rust tab label SHALL name the crate used by the chip vendor.

#### Scenario: Preview CH32 Rust export
- **WHEN** a CH32 workspace opens the export modal and selects the Rust tab
- **THEN** the preview shows `ch32_hal` output and copy/download target that content

#### Scenario: Footer provenance
- **WHEN** the landing page is viewed with generated metadata available
- **THEN** the footer lists per-vendor chip counts, source revisions, and license credits and contains no STM32-only wording

#### Scenario: Preview ESP32 Rust export
- **WHEN** an ESP32 workspace opens the export modal and selects the Rust tab
- **THEN** the preview shows `esp-hal` output and copy/download target that content

#### Scenario: ESP32 source credits
- **WHEN** the landing footer is rendered with generated metadata
- **THEN** it credits the four ESP32 sources alongside the existing seven sources and lists an ESP32 vendor count

### Requirement: Presets are cross-vendor

Curated presets SHALL include STM32, CH32, RP, and ESP32 parts and SHALL open the
selected generated chip when activated from the start screen or the workspace.
ESP32 entries SHALL be starter chips that resolve to generated module shards,
and no ESP32 board preset or `.ioc` import SHALL be added. No chip preview on the
start screen SHALL fetch a hardcoded snapshot or build a demo state.

#### Scenario: Open an RP preset

- **WHEN** a user selects an RP preset
- **THEN** the workspace loads the generated RP chip data without fetching a hardcoded STM32 snapshot

#### Scenario: Open a CH32 preset

- **WHEN** a user selects a CH32 preset from the start screen
- **THEN** the workspace loads the generated CH32 chip data with its remap data intact

#### Scenario: No hero preview fetches a chip

- **WHEN** the start screen is mounted
- **THEN** no hero demo chip request is made

#### Scenario: Open an ESP32 starter chip

- **WHEN** a user selects an ESP32 starter chip from the start screen
- **THEN** the workspace loads the generated ESP32 module shard without a board preset

#### Scenario: ESP32 import is not offered

- **WHEN** the start screen `.ioc` entry point is used
- **THEN** it resolves STM32 parts only and no ESP32 board preset is listed

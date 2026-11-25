# multi-vendor-workspace Delta

## MODIFIED Requirements

### Requirement: Export previews and provenance reflect all vendors

The export modal SHALL present tabs that invoke the vendor-aware exporters and show copy/download controls for each format. The start screen's compact catalog facts, the About provenance table, and workspace copy SHALL describe multi-vendor coverage and credit the STM32, CH32, RP, ESP32, Microchip SAM, and Nordic upstream data sources without STM32-only claims. The Rust tab label SHALL name the crate used by the chip vendor.

#### Scenario: Preview CH32 Rust export

- **WHEN** a CH32 workspace opens the export modal and selects the Rust tab
- **THEN** the preview shows `ch32_hal` output and copy/download target that content

#### Scenario: Footer provenance

- **WHEN** the start screen and About route are viewed with generated metadata available
- **THEN** the start screen shows per-vendor chip counts and the About table lists source revisions and license credits with no STM32-only wording

#### Scenario: Preview ESP32 Rust export

- **WHEN** an ESP32 workspace opens the export modal and selects the Rust tab
- **THEN** the preview shows `esp-hal` output and copy/download target that content

#### Scenario: ESP32 source credits

- **WHEN** the About provenance table is rendered with generated metadata
- **THEN** it credits the four ESP32 sources alongside the other upstream sources and lists an ESP32 vendor count

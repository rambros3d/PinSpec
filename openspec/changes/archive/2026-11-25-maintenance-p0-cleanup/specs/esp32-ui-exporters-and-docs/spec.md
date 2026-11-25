# esp32-ui-exporters-and-docs Delta

## REMOVED Requirements

### Requirement: Provenance attribution covers eleven sources

**Reason**: The provenance surface now covers thirteen canonical sources and six vendors, and the start screen no longer renders a technical footer.

**Migration**: Read source and license attribution from the About table and repository documentation; no code or data migration is required.

## ADDED Requirements

### Requirement: Provenance attribution covers thirteen sources

The About provenance table, document metadata, and repository documentation SHALL credit the thirteen canonical sources and list all six vendors with live counts and source revisions from generated metadata. No start-screen footer SHALL be rendered or required.

#### Scenario: Footer lists all sources

- **WHEN** generated metadata is available
- **THEN** the About table lists the nine pre-ESP32 sources and the four ESP32 sources with their licenses, revisions, and per-vendor counts

#### Scenario: ESP32 vendor entry

- **WHEN** the provenance vendor summary is rendered
- **THEN** it includes `esp32` alongside STM32, CH32, RP, Microchip SAM, and Nordic and reads its count from the generated metadata

#### Scenario: Documentation and metadata agree

- **WHEN** the repository documentation and document metadata are inspected
- **THEN** they describe six vendors and thirteen sources and contain no STM32-only coverage claim or landing-footer requirement

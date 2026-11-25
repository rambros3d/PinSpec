# Spec Delta

## MODIFIED Requirements

### Requirement: Presets are cross-vendor

Curated presets SHALL include STM32, CH32, RP, and ESP32 parts and SHALL open the
selected generated chip when activated from the start screen or the workspace.
ESP32 entries SHALL be starter chips that resolve to generated module shards,
and no ESP32 board preset or `.ioc` import SHALL be added. No chip preview on the
start screen SHALL fetch a hardcoded snapshot or build a demo state. New
preset sessions SHALL receive a generated project name from chip data.

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

#### Scenario: Preset session receives a generated name

- **WHEN** a preset or starter chip creates a new workspace session for a generated chip
- **THEN** the session's project name uses a lowercase sanitized suffix from that chip's generated family or MCU identifier

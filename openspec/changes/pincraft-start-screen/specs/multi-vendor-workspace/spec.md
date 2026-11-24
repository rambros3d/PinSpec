# Spec Delta

## REMOVED Requirements

### Requirement: Presets and hero are cross-vendor

Reason: The interactive hero preview and its vendor switcher are removed from
the start screen. Cross-vendor curated presets are retained in the replacement
requirement below.

## ADDED Requirements

### Requirement: Presets are cross-vendor

Curated presets SHALL include STM32, CH32, and RP parts and SHALL open the
selected generated chip when activated from the start screen or the workspace.
No chip preview on the start screen SHALL fetch a hardcoded snapshot or build a
demo state.

#### Scenario: Open an RP preset

- **WHEN** a user selects an RP preset
- **THEN** the workspace loads the generated RP chip data without fetching a hardcoded STM32 snapshot

#### Scenario: Open a CH32 preset

- **WHEN** a user selects a CH32 preset from the start screen
- **THEN** the workspace loads the generated CH32 chip data with its remap data intact

#### Scenario: No hero preview fetches a chip

- **WHEN** the start screen is mounted
- **THEN** no hero demo chip request is made

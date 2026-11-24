# gpio-electrical-config Specification

## Purpose

Records GPIO electrical settings in workspace state so they survive undo, share links, and project files, and appear in generated Rust, C, CSV, and JSON output when configured.

## Requirements

### Requirement: Electrical settings are recorded per GPIO
The system SHALL record, for each configured physical pin, an output level of High or Low, a drive of PushPull or OpenDrain, a pull of None, Up, or Down, and a speed of Low, Medium, High, or VeryHigh. The setting collection SHALL be optional and keyed by physical position.

#### Scenario: Configure a pin's electrical settings
- **WHEN** a user sets drive PushPull, pull Up, speed High, and output level High on a pin
- **THEN** all four values are stored for that pin's physical position

#### Scenario: Unconfigured pins have no settings
- **WHEN** a workspace has never had electrical settings edited
- **THEN** the workspace carries no electrical settings and existing behavior is unchanged

### Requirement: Electrical settings survive core operations and persistence
Workspace cloning, equality comparison, undo/redo, share-link encoding, and JSON project serialization SHALL preserve electrical settings. The state version SHALL remain at 2 and payloads without the new field SHALL remain valid; payloads of other versions SHALL still be rejected.

#### Scenario: Undo and redo an electrical change
- **WHEN** a user changes a pin's drive and presses undo, then redo
- **THEN** the previous and restored drive values are reproduced exactly

#### Scenario: Share link round trip
- **WHEN** a workspace with electrical settings is encoded into a share link and decoded
- **THEN** all four settings per configured pin are restored

#### Scenario: JSON project round trip
- **WHEN** a workspace with electrical settings is written to a project file and imported
- **THEN** the imported state contains identical settings and other version-2 fields are unchanged

#### Scenario: Older and newer versions rejected
- **WHEN** a version-1 or version-3 payload is decoded
- **THEN** decoding fails with an unsupported-version error as before

#### Scenario: Version-2 payload without settings
- **WHEN** a version-2 payload that omits electrical settings is decoded
- **THEN** decoding succeeds with no settings configured

### Requirement: Inspector edits electrical settings through history
The workspace summary pane SHALL provide an inspector bound to the selected pin that edits output level, drive, pull, and speed, committing each change through workspace history.

#### Scenario: Edit the selected pin
- **WHEN** a user changes the speed of the selected pin in the inspector
- **THEN** that pin's speed is updated and the change is undoable

### Requirement: Rust and C exports emit settings conditionally
When electrical settings are configured, the Rust export SHALL include corresponding embedded-HAL-style configuration content and the C header SHALL define per-pin `_LEVEL`, `_DRIVE`, `_PULL`, and `_SPEED` macros. When no settings are configured, both exports SHALL match their previous STM32 output exactly.

#### Scenario: Rust export with configured settings
- **WHEN** a pin with configured electrical settings is exported to Rust
- **THEN** the output contains configuration content reflecting those settings

#### Scenario: C header with configured settings
- **WHEN** a pin with drive OpenDrain and pull Down is exported to C
- **THEN** the header defines that pin's `_DRIVE` and `_PULL` macros with matching values

#### Scenario: Default Rust and C output unchanged
- **WHEN** an STM32 workspace with no electrical settings is exported to Rust and C
- **THEN** both outputs are byte-for-byte identical to output produced before this capability

### Requirement: CSV export includes electrical setting columns
The CSV export SHALL add columns for output level, drive, pull, and speed. For pins without configured settings those cells SHALL be empty and all pre-existing columns SHALL retain their values.

#### Scenario: CSV row with configured settings
- **WHEN** a pin with configured electrical settings is exported to CSV
- **THEN** its row reports the four values in the added columns

#### Scenario: CSV row without settings
- **WHEN** a pin without electrical settings is exported to CSV
- **THEN** the added cells are empty and the original columns are unchanged

### Requirement: JSON export inherits settings from state
Project-file export SHALL include configured electrical settings through the serialized workspace state, with deterministically sorted keys.

#### Scenario: JSON export contains settings
- **WHEN** a workspace with configured electrical settings is serialized to a project file
- **THEN** the file contains those settings under the workspace state and keys are sorted

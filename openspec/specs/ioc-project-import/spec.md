# ioc-project-import Specification

## Purpose

Enables users to seed a PinCraft workspace from STM32CubeIDE `.ioc` project files and from official ST board configurations, including ST signal-name mapping and MCU part resolution, without a backend or changes to generated catalog data.

## Requirements

### Requirement: .ioc files are parsed as flat key-value text
The system SHALL parse `.ioc` files as flat `key=value` text and extract the MCU name, package, pin count, IP list, board name, and per-pin signal, mode, GPIO label, and lock state, plus `SH.GPXTI` EXTI entries. Blank lines, comments, and unrecognized keys SHALL be ignored without error.

#### Scenario: Valid .ioc file is parsed
- **WHEN** a valid `.ioc` file is provided
- **THEN** the system extracts `Mcu.Name`, `Mcu.Package`, `Mcu.PinsNb`, `Mcu.IPn`, `board`, and each `<pin>.Signal`, `<pin>.Mode`, `<pin>.GPIO_Label`, `<pin>.Locked` and `SH.GPXTI` entry

#### Scenario: Non-configuration lines are ignored
- **WHEN** the file contains blank lines, comments, or unrecognized keys
- **THEN** the importer ignores them without raising an error

### Requirement: ST signal vocabulary maps to normalized signals
The system SHALL map ST Cube signal and mode names to the normalized peripheral and signal pairs of the workspace schema, including `GPIO_EXTI<n>` to `GPIO` / `EXTI`, `SYS_JTMS-SWDIO` to the SWDIO debug signal, and `GPIO_Output` to `GPIO` / `Output`. Unmapped signals SHALL be reported rather than silently dropped.

#### Scenario: EXTI signal is mapped
- **WHEN** a pin carries `GPIO_EXTI13`
- **THEN** the resulting assignment uses peripheral `GPIO` and signal `EXTI`, with the line recorded for resource derivation

#### Scenario: Debug signal is mapped
- **WHEN** a pin carries `SYS_JTMS-SWDIO`
- **THEN** the resulting assignment uses the normalized SWDIO debug signal name

### Requirement: Part IDs resolve to concrete MCU IDs
The system SHALL expand parenthesized variant groups and temperature wildcards in `Mcu.Name` and canonicalize the result to a concrete chip ID that resolves against the catalog index. When more than one concrete ID remains, the system SHALL require explicit user confirmation before opening a workspace.

#### Scenario: Wildcard part ID is expanded
- **WHEN** `Mcu.Name` is `STM32F411R(C-E)Tx`
- **THEN** the importer expands and canonicalizes it to a concrete MCU ID present in the catalog

#### Scenario: Ambiguous part ID requires selection
- **WHEN** expansion yields multiple candidate MCUs
- **THEN** the system prompts for manual selection instead of silently choosing one

### Requirement: Pin-name quirks and virtual pins are handled
The system SHALL normalize escaped spaces and suffix annotations in `.ioc` pin names when joining signals to physical positions by pin name, and SHALL ignore virtual pins that have no physical position. Because `.ioc` files carry no package coordinates, the join SHALL use pin names only.

#### Scenario: Decorated pin names are normalized
- **WHEN** a pin name is `PH0\ -\ OSC_IN` or `PC14-OSC32_IN`
- **THEN** the importer normalizes it to the base GPIO name used by the chip shard

#### Scenario: Virtual pins are ignored
- **WHEN** a virtual entry such as `VP_SYS_VS_Systick` is present
- **THEN** it is ignored and no assignment is created for it

### Requirement: Import produces a version-2 workspace state
The system SHALL produce a version-2 `WorkspaceState` whose assignments are keyed by physical position and are consistent with the existing share-link and project-file codecs. No legacy version-1 import path SHALL be introduced. A parse failure SHALL be reported without changing the current workspace.

#### Scenario: Imported state round-trips
- **WHEN** an `.ioc` file is imported
- **THEN** the resulting state round-trips through the existing share-link and project-file codecs without loss

#### Scenario: Malformed file is rejected cleanly
- **WHEN** a file cannot be parsed
- **THEN** the system reports a clear error and leaves the current workspace unchanged

### Requirement: Official ST board presets are available
The system SHALL provide a static catalog of board presets keyed by MCU ID, seeded from the official STM32 open pin data board files, and SHALL let the user select a preset to seed a workspace with its pin assignments and labels.

#### Scenario: Preset opens a workspace
- **WHEN** a user selects a board preset whose MCU is in the catalog
- **THEN** a workspace opens with that MCU and the preset's assignments applied

#### Scenario: Preset MCU is unavailable
- **WHEN** the requested preset's MCU is not in the catalog
- **THEN** the system shows a clear message without creating a broken workspace

### Requirement: The start screen owns import and preset entry points

The system SHALL provide `.ioc` import and board preset entry points on the
start screen only. The start screen SHALL offer a `.ioc` file picker and the
existing board selector modal. The workspace SHALL NOT render an `.ioc` file
input, drop target, drag-and-drop handlers, or ambiguous-part dialog. File
parsing and part resolution SHALL use the pure importer in
`src/core/importers/ioc.ts`. Ambiguous part IDs SHALL require selection on the
start screen before a workspace opens.

#### Scenario: Start-screen file opens a workspace

- **WHEN** a user selects a `.ioc` file that resolves to one catalog MCU on the start screen
- **THEN** the system parses it, builds a version-2 state, hands that state to the workspace store, and opens the workspace for the resolved MCU

#### Scenario: Ambiguous start-screen file waits for confirmation

- **WHEN** the selected file resolves to multiple catalog MCUs
- **THEN** the start screen lists the candidates and waits for user selection before opening any workspace

#### Scenario: Workspace has no .ioc entry point

- **WHEN** a workspace is opened
- **THEN** it renders no `.ioc` file input, no drop overlay, and no ambiguous-part dialog

#### Scenario: Board preset opens a workspace

- **WHEN** a user selects a board preset whose MCU is in the catalog from the start screen
- **THEN** a workspace opens with that MCU and the preset assignments applied

#### Scenario: Board preset MCU is unavailable

- **WHEN** the requested preset's MCU is not in the catalog
- **THEN** the start screen shows a clear message without creating a broken workspace

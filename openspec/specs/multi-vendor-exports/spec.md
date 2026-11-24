# multi-vendor-exports Specification

## Purpose

Defines how pinout data is serialized for export, sharing, and persistence across STM32, CH32, and RP parts so that remap groups, FUNCSEL values, and PIO bindings survive a full round trip.

## Requirements

### Requirement: Rust export dispatches by vendor
The system SHALL emit a Rust `BoardPins` struct whose import path and pin bindings match the chip vendor: `embassy_stm32` for STM32, `embassy_rp` for RP, and `ch32_hal` for CH32. Custom labels SHALL be sanitized to unique snake_case field names, and unassigned boards SHALL emit a valid empty struct.

#### Scenario: RP board export
- **WHEN** a pinout for an RP chip with assigned GPIO pins is exported to Rust
- **THEN** the output imports `embassy_rp`, declares `BoardPins`, and its `from_peripherals` initializer takes `embassy_rp::Peripherals`

#### Scenario: CH32 board export
- **WHEN** a pinout for a CH32 chip is exported to Rust
- **THEN** the output imports `ch32_hal` and contains no `embassy_stm32` reference

#### Scenario: STM32 board export
- **WHEN** a pinout for an STM32 chip is exported to Rust
- **THEN** the output imports `embassy_stm32` and preserves the existing `BoardPins` shape

### Requirement: Export mux annotations follow the chip mux model
Exported mux annotations SHALL use `funcLabel` when present, otherwise `F<index>` for RP, `RM<remapId>` for CH32, `AF<index>` for STM32, and the GPIO mode for plain GPIO. Literal `AF<n>` text SHALL NOT be emitted for a non-AF mux model.

#### Scenario: CH32 remapped signal
- **WHEN** a CH32 assignment carries `remapId` 1 and no `funcLabel`
- **THEN** its annotation in Rust, C, and CSV output is `RM1` and not `AF1`

#### Scenario: RP FUNCSEL signal with a display label
- **WHEN** an RP signal declares `funcLabel` "F4" with a numeric FUNCSEL index
- **THEN** all export formats display "F4"

### Requirement: C header dispatches by vendor
The system SHALL emit a guarded C header whose per-pin macros match the chip vendor: STM32 `_GPIO_PORT`/`_PIN`/`_AF`, RP Pico SDK `GPIO_FUNC_*` plus PWM slice and channel macros, and CH32 ch32v003fun macros plus a comment summary of the active remap group.

#### Scenario: RP PWM header
- **WHEN** an RP pin assigned to a PWM signal with a shared PWM slice resource is exported to C
- **THEN** the header defines `GPIO_FUNC_*` and PWM slice/channel macros and contains no `_AF` macro

#### Scenario: CH32 remap header
- **WHEN** a CH32 pinout with an active remap group is exported to C
- **THEN** the header uses ch32v003fun macros and includes a remap-summary comment naming the active remap

### Requirement: CSV uses a vendor-neutral schema
The CSV export SHALL emit exactly the header `Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked`, filling `Mux` from the mux-label rule and `Resource` from the shared-hardware key, with RFC-style escaping of commas and quotes.

#### Scenario: Mixed-vendor rows
- **WHEN** a CH32 row with a remap ID and an STM32 row with an AF index appear in one export
- **THEN** the rows report vendor `ch32`/`stm32` and mux `RM1`/`AF7` respectively under the new header

#### Scenario: Escaped label
- **WHEN** a custom label contains a comma
- **THEN** the CSV cell is quoted with embedded quotes doubled and parses back to the original label

### Requirement: Project files use one schema version
Project-file serialization SHALL use a single schema of the current version that stores `funcLabel`, `remapId`, and `resourceId` on assignments plus top-level `activeRemaps` and `pioAssignments`, with deterministically sorted keys; import SHALL reject any other version and SHALL NOT include a legacy compatibility shim.

#### Scenario: Full round trip
- **WHEN** a state containing a remap selection, a PIO assignment, and a resource ID is exported and re-imported
- **THEN** all three fields are restored with identical values and records are sorted by position

#### Scenario: Rejected legacy project
- **WHEN** a version-1 project file is imported
- **THEN** parsing fails with an unsupported-version error instead of silently converting it

### Requirement: Share links encode only populated multi-vendor state
Share-link encoding SHALL carry `activeRemaps` and `pioAssignments` only when non-empty and SHALL accept payloads of the single current version only; decoding malformed links SHALL return an error that the UI can show in a dismissible banner.

#### Scenario: Share round trip with remap and PIO
- **WHEN** a state with active remaps and PIO bindings is encoded into a link and decoded
- **THEN** the decoded state matches the original MCU, assignments, remaps, and PIO bindings

#### Scenario: Empty fields omitted
- **WHEN** a state with no remaps and no PIO bindings is encoded
- **THEN** the payload contains no remap or PIO keys

#### Scenario: Outdated link
- **WHEN** a link of a previous version is decoded
- **THEN** decoding returns an error and no workspace state is produced

### Requirement: Workspace store preserves multi-vendor fields
The workspace store SHALL hydrate, persist to recent sessions, and undo/redo `activeRemaps` and `pioAssignments` alongside assignments, labels, locks, and modes; clearing all SHALL reset them, and opening a shared payload SHALL restore them.

#### Scenario: Undo a remap selection
- **WHEN** a user changes a peripheral's active remap and then presses undo
- **THEN** the previous remap selection is restored and can be redone

#### Scenario: Shared state handoff
- **WHEN** a shared link containing PIO bindings is opened
- **THEN** the loaded workspace state contains those PIO bindings and a subsequent share link round-trips them

#### Scenario: Recent session persistence
- **WHEN** a session with remaps and PIO bindings is saved to recent sessions and reopened
- **THEN** both field sets are restored unchanged

# Spec Delta

## REMOVED Requirements

### Requirement: Import and preset UI entry points are provided

Reason: The workspace no longer accepts dropped `.ioc` files. Entry points and
ambiguous-part confirmation move to the start screen, with the same pure
importer and board preset flows retained.

## ADDED Requirements

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

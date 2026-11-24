# pinout-visual-diff Specification

## Purpose

Defines how two saved pinouts are compared and presented so a user can review pin-level differences between revisions or between different MCUs on read-only package previews and in a summary table.

## Requirements

### Requirement: Project snapshots are matched by position and pin name
The comparison SHALL match pins between two snapshots using the physical position key first and the display pin name second. Matching by name SHALL allow a meaningful diff when the two snapshots target different MCUs whose packages use different position keys.

#### Scenario: Same-chip comparison
- **WHEN** two snapshots declare the same MCU and share a physical position key
- **THEN** that position is compared directly and is not treated as a removal and an addition

#### Scenario: Cross-chip comparison
- **WHEN** two snapshots declare different MCUs and an assignment exists at the same pin name under different position keys
- **THEN** the assignment is matched by pin name and reported as a move when those keys differ

### Requirement: Pin changes are classified into five kinds
The comparison SHALL report each changed pin as exactly one of `added`, `removed`, `moved`, `relabeled`, or `reassigned`. A change SHALL include the relevant before and after values for assignment, label, position, and pin name.

#### Scenario: Assignment appears or disappears
- **WHEN** a position or pin name exists only in one snapshot
- **THEN** the diff reports `added` for the newer snapshot or `removed` for the older snapshot

#### Scenario: Assignment changes position
- **WHEN** the same assignment and pin name appear at different physical positions
- **THEN** the diff reports `moved` with both the source and target positions

#### Scenario: Label changes
- **WHEN** a matched pin keeps the same assignment but its custom label differs
- **THEN** the diff reports `relabeled` with the previous and current label

#### Scenario: Signal changes
- **WHEN** a matched pin keeps its position but its peripheral, signal, or mux metadata differs
- **THEN** the diff reports `reassigned` with the previous and current assignment

### Requirement: Diff results are deterministic and non-mutating
The comparison SHALL return changes in a stable order derived from position or pin name and change kind. The comparison SHALL NOT modify either input snapshot, its nested records, or the active workspace state.

#### Scenario: Repeated comparison
- **WHEN** the same two snapshots are compared twice
- **THEN** both results contain the same changes in the same order

#### Scenario: Inputs remain unchanged
- **WHEN** a comparison completes
- **THEN** both input snapshots and the currently open workspace state are byte-for-byte unchanged

### Requirement: Invalid project files are rejected without crashing
The diff workflow SHALL validate each selected file with the current project-file schema and SHALL report a readable error for malformed JSON, a missing MCU identifier, or an unsupported version. A failure for one file SHALL NOT clear or corrupt the other file or the workspace.

#### Scenario: Malformed file content
- **WHEN** a selected file contains invalid JSON
- **THEN** the modal shows an error for that file and does not attempt to render a diff

#### Scenario: Unsupported version
- **WHEN** a selected file declares a version other than the current schema version
- **THEN** the modal shows an error naming the unsupported version

### Requirement: The diff modal accepts two project files
The workspace SHALL provide a dedicated modal with two independent file inputs, one per snapshot, and SHALL display per-file load and error states. Both inputs SHALL accept PinCraft version 2 project files. `.ioc` input SHALL be supported only when a compatible importer is registered and SHALL NOT be required for this capability.

#### Scenario: Two valid files selected
- **WHEN** the user selects two valid project files
- **THEN** the modal shows the computed change list and both previews

#### Scenario: IOC importer unavailable
- **WHEN** the user selects an `.ioc` file and no compatible importer is registered
- **THEN** the modal shows an unsupported-format message and keeps the other file loaded

### Requirement: Previews load both chips lazily and remain read-only
The modal SHALL fetch each snapshot's chip shard on demand and SHALL render each package with the appropriate package renderer. Previews SHALL use only diff-provided data and SHALL expose no assignment, lock, remap, or context-menu interaction.

#### Scenario: Both shards available
- **WHEN** both MCU identifiers resolve to generated shards
- **THEN** the modal renders one read-only perimeter or grid preview per snapshot

#### Scenario: Missing shard
- **WHEN** one MCU identifier has no matching generated shard
- **THEN** the modal shows a load error for that snapshot and does not modify the workspace

### Requirement: Change markers overlay without replacing pin status colors
The modal SHALL mark changed pins with a dedicated diff legend drawn as an overlay on the read-only previews. The overlay SHALL leave the existing pin status fill and stroke colors in place and SHALL be accompanied by a text label in the summary table so color is not the only indicator.

#### Scenario: Changed pin rendering
- **WHEN** a preview pin has a change marker
- **THEN** its status fill remains driven by the solver status and a distinct diff marker is drawn on top

#### Scenario: Summary table
- **WHEN** a diff contains changes
- **THEN** the summary table lists each change with its kind, position, pin name, and before and after values

### Requirement: Opening the diff does not alter the workspace
The toolbar entry SHALL open the modal without changing assignments, labels, locks, modes, active remaps, PIO bindings, or history. Closing or canceling the modal SHALL leave the active workspace unchanged.

#### Scenario: Open and cancel
- **WHEN** the user opens the diff modal and then closes it without applying anything
- **THEN** the active workspace state and undo history are unchanged

### Requirement: Visual diff produces no KiCad symbol output
This capability SHALL present a comparison only and SHALL NOT generate or download KiCad `.kicad_sym` files or other symbol-library artifacts.

#### Scenario: No symbol artifact
- **WHEN** the user completes a diff review
- **THEN** no `.kicad_sym` file is created or offered for download

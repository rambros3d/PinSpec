# Spec Delta

## MODIFIED Requirements

### Requirement: Dragging reallocates in real time and preserves locked pins

While a peripheral indicator is dragged, the system SHALL recompute allocation
continuously and update pin assignments in real time to reflect the new angle
and the ring derived from the pointer radius. Intermediate previews SHALL NOT
create undo entries; pointer-up SHALL commit one preference change. Pins that
the user has explicitly locked SHALL NOT be reassigned or cleared by this
reallocation, and their assignments SHALL remain unchanged throughout the drag.

#### Scenario: Live reallocation follows the drag

- **WHEN** the user drags a peripheral indicator to a new angle or radius
- **THEN** the affected peripheral's pin assignments update continuously while the drag is in progress

#### Scenario: Drag commits once on pointer-up

- **WHEN** the user drags an indicator through several intermediate angles and radii and then releases the pointer
- **THEN** intermediate states are previewed without new undo entries and one final preference change is recorded on pointer-up

#### Scenario: Locked pins are untouched

- **WHEN** a peripheral indicator is dragged past pins that the user has locked
- **THEN** the locked pins keep their existing assignments and are never reassigned or cleared

#### Scenario: Matrix drag previews are electrically legal

- **WHEN** the user drags a peripheral indicator on a matrix-mux chip through angles and radii whose highest-affinity candidate pins are electrically illegal
- **THEN** every previewed assignment set is electrically legal and no illegal plan is rendered at any point during the drag

#### Scenario: Matrix drag keeps locks as hard constraints

- **WHEN** the user drags a peripheral indicator on a matrix-mux chip past pins that the user has locked
- **THEN** reallocation treats those locked pins as fixed satisfied signals, excludes them from the candidate set, and never moves or clears them

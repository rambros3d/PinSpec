# Spec Delta

## MODIFIED Requirements

### Requirement: Placement overlay is toggleable on the pin canvas

The workspace SHALL provide a toggleable placement overlay on the pin canvas,
not a permanent overlay or a separate panel. When enabled it SHALL show three
concentric rings (inner highest priority, outer lowest) with a draggable
indicator per enabled peripheral, keyboard and numeric angle input, and labels.
It SHALL NOT include a ring selector. It SHALL reuse the existing pin highlight
set for the selected peripheral's claimed pins.

#### Scenario: Overlay toggles on and off

- **WHEN** the user toggles the placement overlay on and later off
- **THEN** the rings and indicators are shown only while the overlay is on, and the toggle state is persisted

#### Scenario: Selection highlights claimed pins

- **WHEN** the user selects a peripheral indicator in the overlay
- **THEN** the pins claimed by that peripheral are marked through the existing pin highlight set

#### Scenario: Numeric angle input moves the indicator

- **WHEN** the user enters an angle through the keyboard or numeric input
- **THEN** the peripheral indicator moves to that angle and the stored preference angle is updated

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

## ADDED Requirements

### Requirement: Placement toggle is an independent top-centre control

The placement overlay toggle SHALL be an independent top-centre canvas control
stacked with the remap banner, separate from the top-right view HUD. The
top-right view HUD SHALL retain only view controls.

#### Scenario: Toggle is separate from the view HUD

- **WHEN** the user locates the placement toggle on the canvas
- **THEN** the control is positioned at the top centre with the remap banner and the top-right view HUD contains no placement control

### Requirement: Placement indicators require explicit opt-in

Placement affinity SHALL remain opt-in per peripheral. A peripheral SHALL appear
as a draggable ring indicator only after the user explicitly enables it in the
placement panel, including peripherals that already hold assignments. Enabling
an unconfigured peripheral SHALL create a default preference with angle 0, ring
`outer`, and enabled true. When no preference is enabled, default allocation
SHALL follow the existing scarcity-only path.

#### Scenario: Unconfigured peripheral has no indicator

- **WHEN** the placement overlay is visible and a peripheral has no placement preference
- **THEN** that peripheral is listed in the placement selector but no indicator is drawn for it on the rings

#### Scenario: Enabling an unconfigured peripheral creates a default preference

- **WHEN** the user enables a listed peripheral that had no placement preference
- **THEN** a preference with angle 0, ring `outer`, and enabled true is stored and an indicator for that peripheral is drawn on the outer ring

#### Scenario: Default allocation remains unchanged

- **WHEN** no peripheral has an enabled placement preference
- **THEN** allocation uses the existing scarcity-only path and assignments match the behavior before placement affinity existed

### Requirement: Placement selector lists allocatable and assigned system peripherals

The placement selector SHALL list every allocatable peripheral, defined as keys
of `chip.peripherals` that expose assignable signals with GPIO excluded, and
SHALL also include system peripherals that hold at least one assignment. Every
listed peripheral without a preference SHALL offer an explicit enable action.

#### Scenario: Allocatable peripherals are listed

- **WHEN** the placement panel is open for a chip with allocatable peripherals and no assignments
- **THEN** every key of `chip.peripherals` with assignable signals except GPIO appears in the selector

#### Scenario: Assigned system peripherals are listed

- **WHEN** a system peripheral holds an assignment but exposes no assignable signals in the chip data
- **THEN** that system peripheral still appears in the selector

#### Scenario: Unconfigured peripheral can be enabled

- **WHEN** the user selects a listed peripheral that has no placement preference
- **THEN** the panel offers an explicit enable action that creates the default preference

### Requirement: Ring is selected by drop radius with keyboard parity

The ring of an enabled placement preference SHALL be derived from the radius at
which its indicator is dropped by choosing the nearest of the three ring radii.
The keyboard SHALL provide `Shift+ArrowUp` and `Shift+ArrowDown` to move the
selected indicator between adjacent rings.

#### Scenario: Ring follows the drop radius

- **WHEN** the user drops an indicator at a radius closest to one of the three rings
- **THEN** the stored ring becomes that nearest ring and the indicator is drawn on it

#### Scenario: Keyboard changes the ring

- **WHEN** the user presses `Shift+ArrowUp` or `Shift+ArrowDown` while an indicator is selected
- **THEN** the stored ring moves one step inward or outward within the three rings and the indicator is redrawn on the new ring

### Requirement: Overlay rings are closer with a larger outer ring

The overlay SHALL draw the three rings with reduced spacing between adjacent
rings and a larger outer radius than the previous overlay, while preserving
inner, middle, and outer priority order.

#### Scenario: Ring geometry is updated

- **WHEN** the placement overlay is displayed for a package
- **THEN** adjacent rings are closer together than before, the outer ring has a larger radius than before, and the inner ring still denotes the highest priority

### Requirement: Overlay rotation is a persisted display-only setting

The placement overlay SHALL provide a rotate control that changes only how the
overlay is drawn. A `placementOverlayRotation` display setting SHALL round-trip
through undo and redo history, `localStorage` sessions, share URLs, and project
JSON as an additive optional version-2 field without a schema version bump. The
rotation SHALL NOT alter stored preferences, pin geometry, scoring, or
allocations.

#### Scenario: Rotate changes only the overlay view

- **WHEN** the user activates the overlay rotate control
- **THEN** the rings and indicators rotate in the canvas view while stored angles, rings, and pin assignments stay unchanged

#### Scenario: Overlay rotation survives persistence surfaces

- **WHEN** a workspace with a non-zero overlay rotation is exported to a share URL, a project JSON file, and a `localStorage` session and then reloaded from each
- **THEN** the overlay rotation is restored and undo and redo history reproduces and reverts its changes

#### Scenario: Rotation does not affect scoring geometry

- **WHEN** the same workspace is allocated with two different overlay rotation values
- **THEN** the derived pin geometry, placement term, and assignments are identical

### Requirement: Overlay rings do not shield pin interaction

The overlay ring graphics SHALL remain non-interactive so that left-click,
right-click, and hover on package pins keep working while the overlay is shown.

#### Scenario: Pin clicks pass through the overlay

- **WHEN** the placement overlay is visible and the user clicks a package pin that lies under a ring
- **THEN** the normal pin popover or context menu opens instead of the ring capturing the click

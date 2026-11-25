# Spec Delta

## MODIFIED Requirements

### Requirement: Placement overlay is toggleable on the pin canvas

The workspace SHALL provide a toggleable placement overlay on the pin canvas,
not a permanent overlay or a separate panel. When enabled it SHALL show three
concentric rings, a draggable indicator per enabled peripheral, and labels.
Opening the right-drawer Placement tab SHALL activate the overlay. Angle and
ring SHALL be changed by dragging; no numeric angle input or ring selector SHALL
be present. The overlay SHALL reuse the existing pin highlight set for the
selected peripheral's claimed pins.

#### Scenario: Overlay toggles on and off

- **WHEN** the user toggles the placement overlay on and later off
- **THEN** the rings and indicators are shown only while the overlay is on, and the toggle state is persisted in localStorage only

#### Scenario: Overlay opens from the Placement tab

- **WHEN** the user opens the Placement tab in the right drawer or the portrait dock
- **THEN** the overlay becomes visible without using the canvas toggle

#### Scenario: Selection highlights claimed pins

- **WHEN** the user selects a peripheral indicator in the overlay
- **THEN** the pins claimed by that peripheral are marked through the existing pin highlight set

#### Scenario: Numeric angle input moves the indicator

- **WHEN** the user opens the Placement tab to adjust an indicator angle
- **THEN** no numeric angle input is present and the angle is changed only by dragging the indicator on the canvas rings

#### Scenario: Dragging moves the indicator

- **WHEN** the user drags an indicator to a new angle and radius in the overlay
- **THEN** the indicator follows the drag and the stored preference angle and ring are updated

### Requirement: Placement toggle is an independent top-centre control

The placement overlay toggle SHALL be an independent top-left canvas control,
separate from the remap banner and the top-right view HUD. The top-right view
HUD SHALL retain only view controls. Neither the right-drawer Placement tab nor
any left sidebar section SHALL contain a placement ON/OFF toggle. Opening the
Placement tab SHALL activate the overlay without adding a second ON/OFF control.

#### Scenario: Toggle is separate from the view HUD

- **WHEN** the user locates the placement toggle on the canvas
- **THEN** the control is at the top left, the top-right view HUD contains no placement control, and neither the Placement tab nor the left sidebar contains a placement ON/OFF toggle

#### Scenario: Tab activation does not add a toggle

- **WHEN** the user activates the overlay through the Placement tab
- **THEN** the canvas toggle remains the only explicit ON/OFF control and the tab exposes only configured-peripheral bubble toggles

### Requirement: Placement indicators require explicit opt-in

Placement affinity SHALL remain opt-in per peripheral. A peripheral SHALL
appear as a draggable ring indicator only after the user explicitly enables it
in the right-drawer Placement tab, including peripherals that already hold
assignments. Enabling a listed peripheral with no preference SHALL create a
default preference with angle 0, ring low, and enabled true. When no preference
is enabled, default allocation SHALL follow the existing scarcity-only path.

#### Scenario: Unconfigured peripheral has no indicator

- **WHEN** the placement overlay is visible and a peripheral has no assignment and no non-disabled mode
- **THEN** that peripheral is not listed in the Placement tab and no indicator is drawn for it on the rings

#### Scenario: Enabling an unconfigured peripheral creates a default preference

- **WHEN** the user enables a listed peripheral that had no placement preference
- **THEN** a preference with angle 0, ring low, and enabled true is stored and an indicator is drawn on the low ring

#### Scenario: Default allocation remains unchanged

- **WHEN** no peripheral has an enabled placement preference
- **THEN** allocation uses the existing scarcity-only path and assignments match the behavior before placement affinity existed

#### Scenario: Configured peripheral without a preference has no indicator

- **WHEN** the placement overlay is visible and a configured peripheral has no placement preference
- **THEN** that peripheral is listed in the Placement tab but no indicator is drawn for it on the rings

### Requirement: Placement selector lists allocatable and assigned system peripherals

The placement selector in the right-drawer Placement tab SHALL list configured
peripherals, defined as those holding at least one assignment or a selected
mode other than disabled, including system peripherals that hold at least one
assignment. It SHALL NOT list allocatable-only or unconfigured peripherals. The
configured set SHALL be derived from solver status and selected modes. Every
listed peripheral without an enabled preference SHALL offer an explicit enable
action.

#### Scenario: Allocatable peripherals are listed

- **WHEN** the Placement tab is open for a chip with configured peripherals
- **THEN** every configured peripheral appears and allocatable-only peripherals are absent from the selector

#### Scenario: Assigned system peripherals are listed

- **WHEN** a system peripheral holds an assignment but exposes no assignable signals in the chip data
- **THEN** that system peripheral still appears in the selector because it is configured

#### Scenario: Unconfigured peripheral can be enabled

- **WHEN** the user selects a listed peripheral that has no placement preference
- **THEN** the panel offers an explicit enable action that creates the default preference

### Requirement: No floating placement properties panel on the canvas

Rings, indicators, drag handling, keyboard adjustment, and display rotation
SHALL stay on the canvas, while per-peripheral placement properties SHALL be
edited only in the right-drawer Placement tab. No floating placement properties
panel SHALL be rendered on the canvas.

#### Scenario: Properties are edited in the sidebar

- **WHEN** placement mode is enabled and the user edits a bubble preference
- **THEN** the edit is made in the right-drawer Placement tab and no floating properties panel is shown on the canvas

#### Scenario: Overlay interaction stays on the canvas

- **WHEN** the user drags an indicator or changes its angle or ring with the keyboard
- **THEN** the interaction occurs on the canvas overlay and the Placement tab reflects the stored preference

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

#### Scenario: Canvas toggle reveals the panel

- **WHEN** the user activates the canvas Placement toggle while another tab is active
- **THEN** the Placement tab becomes active in the right drawer or portrait dock and the rings are drawn

#### Scenario: Shown rings are visible without enabled bubbles

- **WHEN** the overlay is shown on a workspace with no enabled placement bubbles
- **THEN** the three rings and their labels are visibly drawn rather than appearing empty

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

#### Scenario: Canvas activation does not add a toggle

- **WHEN** the user activates the overlay through the canvas toggle
- **THEN** the Placement panel opens without a second ON/OFF control appearing in the panel or the left sidebar

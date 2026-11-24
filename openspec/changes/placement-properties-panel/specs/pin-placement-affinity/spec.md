# Spec Delta

## MODIFIED Requirements

### Requirement: Ring priority is strict between rings

For peripherals with an enabled placement preference, the system SHALL allocate
in strict ring order: every high-ring peripheral is allocated before any
medium-ring peripheral, and every medium-ring peripheral before any low-ring
peripheral. This ordering SHALL take precedence over scarcity ranking when the
two conflict, while peripherals without a placement preference SHALL keep the
existing scarcity-only allocation behavior.

#### Scenario: Inner ring is allocated before outer ring

- **WHEN** a high-ring peripheral and a low-ring peripheral both have enabled
  placement preferences and compete for the same scarce pin
- **THEN** the high-ring peripheral is allocated first and the low-ring
  peripheral is allocated to the next available pin

### Requirement: Placement overlay is toggleable on the pin canvas

The workspace SHALL provide a toggleable placement overlay on the pin canvas.
It SHALL show three concentric rings (high highest, low lowest) with a draggable
indicator per enabled peripheral, keyboard angle adjustment, numeric angle input
in the sidebar panel, and labels. It SHALL NOT include a ring selector. It SHALL
reuse the existing pin highlight set for the selected peripheral's claimed pins.
Properties SHALL be edited in the sidebar, not a floating canvas panel.

#### Scenario: Overlay toggles on and off

- **WHEN** the user toggles the placement overlay on and later off
- **THEN** the rings and indicators are shown only while the overlay is on, and the toggle state is persisted

#### Scenario: Selection highlights claimed pins

- **WHEN** the user selects a peripheral indicator in the overlay
- **THEN** the pins claimed by that peripheral are marked through the existing pin highlight set

#### Scenario: Numeric angle input moves the indicator

- **WHEN** the user enters an angle through the keyboard or numeric input
- **THEN** the peripheral indicator moves to that angle and the stored preference angle is updated

### Requirement: Placement indicators require explicit opt-in

Placement affinity SHALL remain opt-in per peripheral. A peripheral SHALL appear
as a draggable ring indicator only after the user explicitly enables it in the
placement panel, including peripherals that already hold assignments. Enabling
a peripheral that has no placement preference SHALL create a default preference
with angle 0, ring `low`, and enabled true. When no preference is enabled,
default allocation SHALL follow the existing scarcity-only path.

#### Scenario: Unconfigured peripheral has no indicator

- **WHEN** the placement overlay is visible and a peripheral has no assignment and no non-disabled mode
- **THEN** that peripheral is not listed in the placement panel and no indicator is drawn for it on the rings

#### Scenario: Enabling an unconfigured peripheral creates a default preference

- **WHEN** the user enables a listed peripheral that had no placement preference
- **THEN** a preference with angle 0, ring `low`, and enabled true is stored and an indicator is drawn on the low ring

#### Scenario: Default allocation remains unchanged

- **WHEN** no peripheral has an enabled placement preference
- **THEN** allocation uses the existing scarcity-only path and assignments match the behavior before placement affinity existed

#### Scenario: Configured peripheral without a preference has no indicator

- **WHEN** the placement overlay is visible and a configured peripheral has no placement preference
- **THEN** that peripheral is listed in the placement panel but no indicator is drawn for it on the rings

### Requirement: Placement selector lists allocatable and assigned system peripherals

The placement selector SHALL list configured peripherals, defined as those
holding at least one assignment or a mode other than disabled, including system
peripherals that hold at least one assignment. It SHALL NOT list allocatable-only
or unconfigured peripherals. The configured set SHALL be derived from solver
status and selected modes. Every listed peripheral without an enabled preference
SHALL offer an explicit enable action.

#### Scenario: Allocatable peripherals are listed

- **WHEN** the placement panel is open for a chip with configured peripherals
- **THEN** every configured peripheral appears and allocatable-only peripherals are absent from the selector

#### Scenario: Assigned system peripherals are listed

- **WHEN** a system peripheral holds an assignment but exposes no assignable signals in the chip data
- **THEN** that system peripheral still appears in the selector because it is configured

#### Scenario: Unconfigured peripheral can be enabled

- **WHEN** the user selects a listed peripheral that has no enabled placement preference
- **THEN** the panel offers an explicit enable action that creates the default preference

### Requirement: Overlay rings are closer with a larger outer ring

The overlay SHALL draw the three rings with reduced spacing between adjacent
rings, preserving high, medium, and low priority order. The outer ring SHALL use
the largest radius the canvas permits without overlapping the reserved canvas
controls and workspace buttons, and the ring centre SHALL remain at the package
or stage centre.

#### Scenario: Ring geometry is updated

- **WHEN** the placement overlay is displayed for a package with measured canvas furniture
- **THEN** adjacent rings are closer together than before, the outer ring has the largest radius that clears the reserved rectangles, and the high ring still denotes the highest priority

#### Scenario: Outer ring clears canvas furniture

- **WHEN** the reserved rectangles of the view HUD, remap banner, placement toggle, legend, hint, and workspace canvas buttons are measured
- **THEN** the outer ring does not overlap any reserved rectangle and its centre stays at the stage centre

### Requirement: Placement toggle is an independent top-centre control

The placement overlay toggle SHALL be an independent bottom-centre canvas
control, separate from the top-centre remap banner and the top-right view HUD.
The top-right view HUD SHALL retain only view controls. The sidebar placement
panel SHALL NOT contain a placement ON/OFF toggle.

#### Scenario: Toggle is separate from the view HUD

- **WHEN** the user locates the placement toggle on the canvas
- **THEN** the control is at the bottom centre, the top-right view HUD contains no placement control, and the sidebar panel contains no placement ON/OFF toggle

## ADDED Requirements

### Requirement: Persisted ring values normalize legacy names

Persisted placement ring values SHALL use the identifiers high, medium, and low.
When version-2 share URLs or project JSON contain the legacy ring values inner,
middle, or outer, the system SHALL accept them and normalize them to high,
medium, and low respectively before use, so existing preferences are not
silently dropped.

#### Scenario: Legacy share link ring values normalize

- **WHEN** a version-2 share URL contains a placement preference with ring `inner`
- **THEN** decoding stores that preference with ring `high` and preserved angle and enabled flag

#### Scenario: Legacy project file ring values normalize

- **WHEN** a project JSON file contains placement preferences with rings `middle` and `outer`
- **THEN** parsing stores them with rings `medium` and `low`

#### Scenario: Allocation rank follows normalized ring names

- **WHEN** a legacy preference has been normalized to a new ring name
- **THEN** allocation ranks high first, then medium, then low

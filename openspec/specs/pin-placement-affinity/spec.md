# pin-placement-affinity Specification

## Purpose

Defines opt-in placement preferences that bias peripheral pin allocation by
circular ring priority and angular/radial distance, exposed through a toggleable
canvas overlay with live reallocation that preserves locked pins and persists
across all version-2 state surfaces.

## Requirements

### Requirement: Placement preference is additive persisted workspace data

The system SHALL store, for each peripheral, an opt-in placement preference
made up of an angle, a ring, and an enabled flag as additive optional fields in
the version-2 workspace state. Ring values SHALL be high, medium, and low.
These fields SHALL round-trip through undo/redo history, `localStorage`
sessions, share URLs, and project JSON without a schema version bump. When the
fields are absent, placement SHALL be treated as disabled and existing state
behavior SHALL be unchanged.

#### Scenario: Placement preferences survive every persistence surface

- **WHEN** a workspace with placement preferences is exported to a share URL, a project JSON file, and a `localStorage` session and then reloaded from each
- **THEN** the angle, ring, and enabled flag of every peripheral are restored, and undo/redo history reproduces and reverts their changes

#### Scenario: Absent placement fields mean disabled

- **WHEN** version-2 workspace state without placement fields is loaded
- **THEN** placement is treated as disabled and existing allocation and serialization behavior is unchanged

### Requirement: Ring priority is strict between rings

For peripherals with an enabled placement preference, the system SHALL allocate
in strict ring order: every high-ring peripheral is allocated before any
medium-ring peripheral, and every medium-ring peripheral before any low-ring
peripheral. This ordering SHALL take precedence over scarcity ranking when the
two conflict, while peripherals without a placement preference SHALL keep the
existing scarcity-only allocation behavior.

#### Scenario: Inner ring is allocated before outer ring

- **WHEN** a high-ring peripheral and a low-ring peripheral both have enabled placement preferences and compete for the same scarce pin
- **THEN** the high-ring peripheral is allocated first and the low-ring peripheral is allocated to the next available pin

### Requirement: Angular and radial scoring applies within a ring

Within a single ring, the system SHALL rank candidate pins by a weighted score
that favors smaller angular distance between the pin and the peripheral's
configured angle. For grid and BGA packages the score SHALL also incorporate
radial distance from the package centre such that outer balls are preferred for
connector-facing placement. The weighting SHALL be deterministic for a given
package and placement preference.

#### Scenario: Smaller angular distance is preferred

- **WHEN** two candidate pins in the same ring support a signal and one is angularly closer to the configured angle
- **THEN** the angularly closer pin is selected

#### Scenario: Outer balls are preferred on a grid package

- **WHEN** two candidate pins in the same ring have equal angular score on a BGA package and one is farther from the package centre
- **THEN** the outer ball is selected

### Requirement: Disabled placement leaves allocation byte-identical

The optional placement term SHALL evaluate to zero whenever no placement
preference is enabled, so the output of the shared scarcity scoring hook and the
resulting assignments are unchanged from the behavior without this capability.
This SHALL hold for automatic mode allocation, per-signal toggling, and
one-hop remap fix discovery.

#### Scenario: Default allocations do not change

- **WHEN** a chip is allocated with placement disabled and compared against the same chip allocated before this capability existed
- **THEN** every assigned pin, signal, and score is identical

### Requirement: Geometry is derived from the package without per-MCU hardcoding

The system SHALL derive each pin's angular position and radial distance from the
package centre using the package's side counts and ordered pin positions. It
SHALL support perimeter, grid, and two-sided packages without per-MCU
hardcoding, and SHALL fall back gracefully for two-sided packages whose side
counts leave no top or bottom pins.

#### Scenario: Perimeter and grid pin geometry

- **WHEN** geometry is derived for a four-sided perimeter package and for a grid package
- **THEN** each pin receives an angle and a radius measured from the package centre

#### Scenario: Two-sided package fallback

- **WHEN** geometry is derived for a two-sided package with no top or bottom pins
- **THEN** a finite angle and radius are produced for every pin without error

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
rings, preserving high, medium, and low priority order. The outer ring SHALL
use the largest radius the canvas permits without overlapping the reserved
rectangles of the view HUD, remap banner, bottom-centre placement toggle,
legend, hint, and workspace canvas buttons. The ring centre SHALL remain at the
package or stage centre.

#### Scenario: Ring geometry is updated

- **WHEN** the placement overlay is displayed for a package with measured canvas furniture
- **THEN** adjacent rings are closer together than before, the outer ring has the largest radius that clears the reserved rectangles, and the high ring still denotes the highest priority

#### Scenario: Outer ring clears canvas furniture

- **WHEN** the reserved rectangles of the view HUD, remap banner, placement toggle, legend, hint, and workspace canvas buttons are measured
- **THEN** the outer ring does not overlap any reserved rectangle and its centre stays at the stage centre

#### Scenario: Pure radius helper is host-testable

- **WHEN** the radius helper is called with plain numbers in a host-side unit test
- **THEN** it returns a finite radius without importing Svelte or browser APIs

#### Scenario: Transient overlays do not shrink the ring

- **WHEN** a tooltip, popover, or context menu is visible
- **THEN** the outer ring radius is unchanged because transient overlays are not reserved rectangles

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

### Requirement: Persisted ring values normalize legacy names

Persisted placement ring values SHALL use the identifiers high, medium, and
low, with display labels High, Medium, and Low. When version-2 share URLs or
project JSON contain the legacy ring values inner, middle, or outer, the system
SHALL accept them and normalize them to high, medium, and low respectively
before use, so existing preferences are not silently dropped.

#### Scenario: Legacy share link ring values normalize

- **WHEN** a version-2 share URL contains a placement preference with ring `inner`
- **THEN** decoding stores that preference with ring `high` and preserved angle and enabled flag

#### Scenario: Legacy project file ring values normalize

- **WHEN** a project JSON file contains placement preferences with rings `middle` and `outer`
- **THEN** parsing stores them with rings `medium` and `low`

#### Scenario: Allocation rank follows normalized ring names

- **WHEN** a legacy preference has been normalized to a new ring name
- **THEN** allocation ranks high first, then medium, then low

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

### Requirement: Outer radius comes from a pure measured helper

The maximum safe outer-ring radius SHALL be computed by a pure helper that
takes the stage centre, stage bounds, and measured reserved rectangles as plain
numbers. Transient overlays SHALL NOT be included in the measurement, and a
finite fallback SHALL be used for degenerate or missing measurements.

#### Scenario: Radius helper uses plain numbers

- **WHEN** the radius helper is called with plain numbers in a host-side unit test
- **THEN** it returns a finite radius without importing Svelte or browser APIs

#### Scenario: Transient overlays are excluded from measurement

- **WHEN** a tooltip, popover, or context menu is visible
- **THEN** the outer ring radius is unchanged because those overlays are not reserved rectangles

#### Scenario: Degenerate measurements use a finite fallback

- **WHEN** stage bounds or reserved rectangles are missing or degenerate
- **THEN** the helper returns a finite fallback radius and keeps the stage centre

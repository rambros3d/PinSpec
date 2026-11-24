# pin-placement-affinity Specification

## Purpose

Defines opt-in placement preferences that bias peripheral pin allocation by
circular ring priority and angular/radial distance, exposed through a toggleable
canvas overlay with live reallocation that preserves locked pins and persists
across all version-2 state surfaces.

## Requirements

### Requirement: Placement preference is additive persisted workspace data

The system SHALL store, for each peripheral, an opt-in placement preference made
up of an angle, a ring, and an enabled flag as additive optional fields in the
version-2 workspace state. These fields SHALL round-trip through undo/redo
history, `localStorage` sessions, share URLs, and project JSON without a schema
version bump. When the fields are absent, placement SHALL be treated as disabled
and existing state behavior SHALL be unchanged.

#### Scenario: Placement preferences survive every persistence surface

- **WHEN** a workspace with placement preferences is exported to a share URL, a
  project JSON file, and a `localStorage` session and then reloaded from each
- **THEN** the angle, ring, and enabled flag of every peripheral are restored,
  and undo/redo history reproduces and reverts their changes

#### Scenario: Absent placement fields mean disabled

- **WHEN** version-2 workspace state without placement fields is loaded
- **THEN** placement is treated as disabled and existing allocation and
  serialization behavior is unchanged

### Requirement: Ring priority is strict between rings

For peripherals with an enabled placement preference, the system SHALL allocate
in strict ring order: every inner-ring peripheral is allocated before any
middle-ring peripheral, and every middle-ring peripheral before any outer-ring
peripheral. This ordering SHALL take precedence over scarcity ranking when the
two conflict, while peripherals without a placement preference SHALL keep the
existing scarcity-only allocation behavior.

#### Scenario: Inner ring is allocated before outer ring

- **WHEN** an inner-ring peripheral and an outer-ring peripheral both have
  enabled placement preferences and compete for the same scarce pin
- **THEN** the inner-ring peripheral is allocated first and the outer-ring
  peripheral is allocated to the next available pin

### Requirement: Angular and radial scoring applies within a ring

Within a single ring, the system SHALL rank candidate pins by a weighted score
that favors smaller angular distance between the pin and the peripheral's
configured angle. For grid and BGA packages the score SHALL also incorporate
radial distance from the package centre such that outer balls are preferred for
connector-facing placement. The weighting SHALL be deterministic for a given
package and placement preference.

#### Scenario: Smaller angular distance is preferred

- **WHEN** two candidate pins in the same ring support a signal and one is
  angularly closer to the configured angle
- **THEN** the angularly closer pin is selected

#### Scenario: Outer balls are preferred on a grid package

- **WHEN** two candidate pins in the same ring have equal angular score on a
  BGA package and one is farther from the package centre
- **THEN** the outer ball is selected

### Requirement: Disabled placement leaves allocation byte-identical

The optional placement term SHALL evaluate to zero whenever no placement
preference is enabled, so the output of the shared scarcity scoring hook and the
resulting assignments are unchanged from the behavior without this capability.
This SHALL hold for automatic mode allocation, per-signal toggling, and
one-hop remap fix discovery.

#### Scenario: Default allocations do not change

- **WHEN** a chip is allocated with placement disabled and compared against the
  same chip allocated before this capability existed
- **THEN** every assigned pin, signal, and score is identical

### Requirement: Geometry is derived from the package without per-MCU hardcoding

The system SHALL derive each pin's angular position and radial distance from the
package centre using the package's side counts and ordered pin positions. It
SHALL support perimeter, grid, and two-sided packages without per-MCU
hardcoding, and SHALL fall back gracefully for two-sided packages whose side
counts leave no top or bottom pins.

#### Scenario: Perimeter and grid pin geometry

- **WHEN** geometry is derived for a four-sided perimeter package and for a
  grid package
- **THEN** each pin receives an angle and a radius measured from the package
  centre

#### Scenario: Two-sided package fallback

- **WHEN** geometry is derived for a two-sided package with no top or bottom
  pins
- **THEN** a finite angle and radius are produced for every pin without error

### Requirement: Placement overlay is toggleable on the pin canvas

The workspace SHALL provide a toggleable placement overlay on the pin canvas,
not a permanent overlay or a separate panel. When enabled it SHALL show three
concentric rings (inner highest priority, outer lowest) with a draggable
indicator per enabled peripheral, a ring selector, keyboard and numeric angle
input, and labels. It SHALL reuse the existing pin highlight set for the
selected peripheral's claimed pins.

#### Scenario: Overlay toggles on and off

- **WHEN** the user toggles the placement overlay on and later off
- **THEN** the rings and indicators are shown only while the overlay is on, and
  the toggle state is persisted

#### Scenario: Selection highlights claimed pins

- **WHEN** the user selects a peripheral indicator in the overlay
- **THEN** the pins claimed by that peripheral are marked through the existing
  pin highlight set

#### Scenario: Numeric angle input moves the indicator

- **WHEN** the user enters an angle through the keyboard or numeric input
- **THEN** the peripheral indicator moves to that angle and the stored
  preference angle is updated

### Requirement: Dragging reallocates in real time and preserves locked pins

While a peripheral indicator is dragged, the system SHALL recompute allocation
continuously and update pin assignments in real time to reflect the new angle
and ring. Pins that the user has explicitly locked SHALL NOT be reassigned or
cleared by this reallocation, and their assignments SHALL remain unchanged
throughout the drag.

#### Scenario: Live reallocation follows the drag

- **WHEN** the user drags a peripheral indicator to a new angle or ring
- **THEN** the affected peripheral's pin assignments update continuously while
  the drag is in progress

#### Scenario: Locked pins are untouched

- **WHEN** a peripheral indicator is dragged past pins that the user has locked
- **THEN** the locked pins keep their existing assignments and are never
  reassigned or cleared

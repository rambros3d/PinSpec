# placement-ring-stability Specification

## Purpose

Defines fixed body-relative placement ring radii and a single enable-time zoom
fit, so the rings keep their order during pan and zoom and oversized rings clip
at the stage viewport without resizing the IC body reference.

## Requirements

### Requirement: Automatic zoom is limited to overlay enable

Automatic zoom-out SHALL run only when the placement overlay becomes visible.
It SHALL use the low radius factor and the stage half-extent for that one fit.
Chip changes, rotation, resize, pan, wheel, and pinch SHALL NOT trigger
automatic zoom.

#### Scenario: Enable fits once

- **WHEN** the overlay is enabled while the package is too large for the stage
- **THEN** zoom is reduced once around the body centre so the low ring fits the stage half-extent

#### Scenario: Manual view stays manual

- **WHEN** the user zooms or pans after the overlay is enabled
- **THEN** rings scale with the body and no further automatic zoom occurs

### Requirement: Oversized rings clip naturally

When scaled rings extend past the canvas, they SHALL be clipped by the stage
viewport with no clamp, opacity change, warning, or furniture-based resizing.
Pointer ring selection and keyboard changes SHALL keep using the same radii.

#### Scenario: Rings leave the viewport

- **WHEN** the low ring is larger than the visible stage
- **THEN** the visible portion continues to use the same radius for drawing and hit testing

#### Scenario: Interaction remains consistent

- **WHEN** an indicator is dragged near a ring
- **THEN** the nearest ring is chosen from the same radii used to draw it

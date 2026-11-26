# Spec Delta

## ADDED Requirements

### Requirement: Ring radius comes from the farthest pin bounds

The placement ring reference radius SHALL be the maximum distance from the IC
body centre to any corner of a measured pin bounds rectangle. Perimeter packages
SHALL mark pad rectangles; grid packages SHALL mark the ball circle together
with its visible text extent. If no bounds are measurable, the body
half-diagonal SHALL be the fallback.

#### Scenario: Pad defines the radius

- **WHEN** pad rectangles are measured around the body centre
- **THEN** the farthest pad corner, not its centre, determines the reference radius

#### Scenario: Grid ball text is included

- **WHEN** a grid package renders ball labels at a visible zoom level
- **THEN** the outermost ball circle and its text extent contribute to the reference radius

### Requirement: Ring styling is dotted and thin

All three placement rings SHALL render with `stroke-dasharray="2 3"` and
`stroke-width="1"`. The low ring SHALL NOT keep a separate dash pattern.
Draggable indicator handles SHALL keep their existing appearance.

#### Scenario: Uniform dotted rings

- **WHEN** the placement overlay renders high, medium, and low rings
- **THEN** each uses the same fine dotted stroke at half the former thickness

#### Scenario: Handles are unchanged

- **WHEN** a placement indicator is selected or focused
- **THEN** its handle circles still use their existing stroke and focus styling

### Requirement: Ring behavior stays locked to the IC

The reference radius SHALL feed the existing `1.4 / 1.55 / 1.7` factors. The
body centre remains the ring centre, zoom stays locked to the IC, auto-fit stays
enable-only, and oversized rings clip naturally at the canvas edge.

#### Scenario: Ring order is stable

- **WHEN** the reference radius changes at any zoom
- **THEN** high remains 1.4×, medium 1.55×, and low 1.7× of that radius

#### Scenario: No new fit behavior

- **WHEN** the user pans, wheels, pinches, or changes chip, rotation, or viewport size
- **THEN** no automatic zoom is added beyond the existing overlay-enable fit

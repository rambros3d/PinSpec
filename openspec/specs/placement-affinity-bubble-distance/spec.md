# placement-affinity-bubble-distance Specification

## Purpose

Make placement affinity follow the visible bubble by ranking pins on Euclidean distance from the bubble point to each pad centre in shared package-space geometry. Keep ring priority dominant, disabled preferences neutral, and allocation and matrix candidate limits unchanged.

## Requirements

### Requirement: Pin geometry includes a pad centre

`PinGeometry` SHALL expose Cartesian `x`/`y` coordinates derived from the same
pure package geometry that produces `angle` and `radius`. Perimeter and grid
packages SHALL both provide finite coordinates. No DOM measurement SHALL enter
`src/core/`.

#### Scenario: Perimeter pad centre

- **WHEN** pin geometry is built for a perimeter package
- **THEN** each pin has finite `x`/`y` matching its side and index within that side

#### Scenario: Grid pad centre

- **WHEN** pin geometry is built from rows and columns
- **THEN** each pin has finite `x`/`y` matching its row and column position

### Requirement: Affinity uses bubble-to-pad distance

When a placement preference is enabled, affinity SHALL be the ring rank times
10000 plus a penalty based on the Euclidean distance from the bubble point to
the pin pad centre, normalized into `0–60`. The bubble point SHALL be derived
from the stored angle and ring factor in the same coordinate system. Disabled
preferences SHALL still return zero.

#### Scenario: Closer pad wins

- **WHEN** two pins share a ring and one pad centre is closer to the bubble
- **THEN** the closer pin receives the lower affinity penalty

#### Scenario: Ring rank dominates

- **WHEN** a high-ring bubble is far from a pin and a low-ring bubble is near it
- **THEN** the high-ring preference still receives the lower total score

#### Scenario: Disabled preference is neutral

- **WHEN** a preference has `enabled: false`
- **THEN** affinity is exactly zero and allocation is unchanged

### Requirement: Scoring integrators stay unchanged

Allocation and matrix alternate ranking SHALL continue to add affinity to
existing scarcity and electrical terms, using the same shared geometry cache
and the same candidate limits. No share or project schema field SHALL change.

#### Scenario: Existing constraints still apply

- **WHEN** matrix alternates are ranked with an enabled placement preference
- **THEN** electrical penalty, affinity, and position still determine the same bounded list

#### Scenario: Share schema is unchanged

- **WHEN** a workspace with placement preferences is shared or exported
- **THEN** the payload still contains only angle, ring, and enabled fields

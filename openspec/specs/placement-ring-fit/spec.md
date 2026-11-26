# placement-ring-fit Specification

## Purpose

Keeps placement rings centred on the rendered IC body with radii derived from
its measured half-diagonal and the furniture-safe outer radius, so pan, zoom,
and rotation preserve the inner-ring clearance.

## Requirements

### Requirement: Placement rings follow the rendered IC body

The placement overlay SHALL center its rings on the measured body of the
rendered MCU package, not on the stage centre. Both package renderers SHALL
mark the main body for measurement. Panning, zooming, and rotation SHALL move
and resize the ring geometry with the body.

#### Scenario: Body-centred rings

- **WHEN** the placement overlay is visible after the package is panned
- **THEN** the ring centre matches the rendered IC body centre

#### Scenario: Rotation and zoom are measured

- **WHEN** the package is rotated or zoomed
- **THEN** ring geometry is derived from the transformed body rectangle without duplicating renderer layout math

### Requirement: The inner ring clears the IC body

The high ring radius SHALL equal the body half-diagonal multiplied by 1.1.
The low ring SHALL stay within the existing furniture-safe outer radius, and
the medium ring SHALL lie between them. Drawing, pointer ring selection, and
keyboard ring changes SHALL use the same radii.

#### Scenario: Comfortable inner clearance

- **WHEN** ring radii are computed for a body half-diagonal of 100
- **THEN** the high radius is 110 and the body fits inside it with ten percent clearance

#### Scenario: Outer ring stays safe

- **WHEN** the required high radius exceeds the safe outer radius
- **THEN** the view is zoomed out rather than allowing the low ring to cover HUD furniture

### Requirement: Oversized packages zoom out

When the current zoom cannot satisfy the inner-ring clearance within the safe
outer radius, the canvas SHALL reduce zoom around the body centre. Auto zoom
SHALL run on overlay enable, chip or rotation change, and resize, with an
epsilon guard against repeated adjustments. Pointer movement SHALL NOT trigger
auto zoom.

#### Scenario: Zoom limit is respected

- **WHEN** the computed zoom limit is below the current zoom
- **THEN** zoom is reduced to the limit around the body centre and the body remains centred under that point

#### Scenario: No zoom feedback loop

- **WHEN** the overlay is visible and static
- **THEN** repeated measurement effects do not further change zoom once the limit is satisfied

### Requirement: Ring geometry is pure and testable

Ring radii and the zoom limit SHALL be computed by pure TypeScript helpers with
no Svelte or DOM import. DOM measurement stays in the canvas component, and
the furniture-safe radius helper keeps its existing contract.

#### Scenario: Host-side geometry tests

- **WHEN** the solver-free core helpers are imported in Vitest
- **THEN** clearance, clamping, and zoom-limit cases run without a browser

#### Scenario: Existing placement behavior remains

- **WHEN** a peripheral preference is dragged or changed with the keyboard
- **THEN** the same allocation path and persistence rules apply as before the geometry change

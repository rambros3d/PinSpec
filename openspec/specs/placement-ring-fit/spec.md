# placement-ring-fit Specification

## Purpose

Keeps placement rings centred on the rendered IC body with radii derived from
its measured half-diagonal, so pan, zoom, and rotation preserve the ring
placement reference.

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

### Requirement: Ring geometry is pure and testable

Ring radii and the enable-time zoom limit SHALL be computed by pure TypeScript
helpers with no Svelte or DOM import. DOM measurement of the body stays in the
canvas component, and the helpers take plain numbers.

#### Scenario: Host-side geometry tests

- **WHEN** the solver-free core helpers are imported in Vitest
- **THEN** fixed-ratio, stable-order, and enable-fit cases run without a browser

#### Scenario: Existing placement behavior remains

- **WHEN** a peripheral preference is dragged or changed with the keyboard
- **THEN** the same allocation path and persistence rules apply as before the geometry change

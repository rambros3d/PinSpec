# Proposal: Placement Pin Ring Refinement

## Why

Placement rings currently derive their radius from the IC body half-diagonal,
which does not account for the outermost pads. Pads can visually reach or cross
the high ring. The ring strokes are also heavier than needed and the low ring
uses a different dash pattern from the others.

## What Changes

- Derive the ring reference radius from the farthest visible pin pad/ball
  extent rather than the IC body half-diagonal. Perimeter packages use pad
  rectangles; grid packages use the outermost ball circle plus its visible
  text extent.
- Keep the IC body centre as the ring centre, and keep the `1.4 / 1.55 / 1.7`
  radius factors with enable-only zoom fit and natural clipping.
- Render all three placement rings with a dotted `2 3` dash pattern and a
  `stroke-width` of `1` (half the current `2`).
- Keep draggable indicator handles unchanged.
- Update pure geometry helpers and tests, renderer markers, and static
  placement assertions.

## Capabilities

- `placement-pin-ring-refinement`
- `placement-ring-stability`

## Out of scope

No persistence, solver, allocation, generated data, exporter, dialog, or shell
change. No new dependency or user preference.

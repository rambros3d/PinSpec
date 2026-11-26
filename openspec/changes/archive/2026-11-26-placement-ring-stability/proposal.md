# Proposal: Placement Ring Stability

## Why

The current ring geometry clamps the low ring to a furniture-safe radius while
the high ring scales with the measured body. When the user zooms in, the safe
radius stays fixed and the ring order inverts, so the innermost circle can cut
through the IC. The rings must scale only with the package body and keep a
stable order at every zoom.

## What Changes

- Set fixed radius factors from the body half-diagonal: high `1.4`, medium
  `1.55`, low `1.7`.
- Remove the furniture-safe clamp and furniture measurement from placement
  geometry; rings may extend past the canvas and are clipped naturally.
- Keep automatic zoom-out only on the overlay-enable transition, using the low
  factor and the stage half-extent. Do not auto-fit on chip, rotation, resize,
  pan, or wheel.
- Keep drawing, pointer ring selection, and keyboard changes on the same
  radii, and keep the measured body centre following pan and zoom.
- Update the pure geometry tests and static placement tests.

## Capabilities

- `placement-ring-stability`
- `placement-ring-fit`

## Out of scope

No persistence, solver, allocation, generated data, exporter, dialog, or shell
change. No new dependency, preference, or user control.

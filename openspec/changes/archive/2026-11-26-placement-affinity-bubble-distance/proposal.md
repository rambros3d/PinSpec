# Proposal: Placement Affinity Bubble Distance

## Why

Placement affinity currently ranks pins by angular difference and normalized
radius from the package centre. The visible bubble, however, sits at an angle
and ring radius derived from measured pin bounds, so the solver and the canvas
use only loosely aligned geometry. Dragging a bubble near a pin cluster can
still select a pin on the opposite side at a similar radius.

## What Changes

- Extend pure pin geometry with Cartesian pad-centre coordinates derived from
  the same package `sides` or `rows/cols` data.
- Compute the bubble point from the stored angle and ring factor in the same
  package-space coordinate system.
- Rank pins by normalized Euclidean distance from bubble point to pad centre,
  keeping ring rank as the primary term and the zero-when-disabled rule.
- Keep the preference schema, allocation order, scarcity weighting, and
  matrix-alternate cap unchanged.
- Update pure affinity tests and placement source contracts.

## Capabilities

- `placement-affinity-bubble-distance`
- `pin-placement-affinity`

## Out of scope

No persistence, generated data, exporter, dialog, shell, or ring-geometry
change. No new dependency or preference.

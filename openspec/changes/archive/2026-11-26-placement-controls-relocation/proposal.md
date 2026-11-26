# Proposal: Placement Controls Relocation

## Why

The canvas still carries a floating placement card with an overlay toggle and a
Rings button. The overlay toggle duplicates the Placement tab, the Rings button
is hidden away from the placement controls, and the find bar occupies the
top-right area next to zoom controls. Placement controls belong in the Placement
tab, and the freed top-left canvas area is a better home for pin search.

## What Changes

- Remove the floating placement card and both its buttons from the canvas,
  including its `data-placement-furniture` marker and overlay toggle callback.
- Show placement rings whenever at least one peripheral has an enabled bubble;
  hide them when the last bubble is disabled.
- Retire the localStorage `placementOverlayVisible` preference and its tests.
  No share or project schema field changes.
- Add a "Rotate placements" button to the Placement tab header. It rotates only
  the bubble overlay relative to the IC by 90° per click and is disabled when no
  bubble is enabled. The canvas rotate button continues to rotate the IC.
- Move the pin/signal find bar from `top-14 right-3` to `top-14 left-3` on the
  canvas, keeping `Ctrl+F` focus behavior intact.
- Update specs and static tests for the removed toggle, new rotation control,
  visibility rule, and find-bar position.

## Capabilities

- `placement-controls-relocation`
- `pin-placement-affinity`
- `placement-toggle-and-accent-icons`
- `placement-right-panel`

## Out of scope

No persistence share field, generated data, solver, allocation, exporter,
dialog, or global shell change. No new dependency.

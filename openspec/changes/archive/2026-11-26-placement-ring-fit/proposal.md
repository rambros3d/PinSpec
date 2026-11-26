# Proposal: Placement Ring Fit

## Why

The placement overlay centers its rings on the stage, while the MCU body is
rendered in a separately translated and scaled SVG layer. After pan or zoom the
body can drift outside or overlap the high ring, so the inner circle no longer
represents a usable placement region. The ring geometry needs to be derived
from the rendered package body itself.

## What Changes

- Mark the main IC body in both package renderers with `data-ic-body` and
  measure it in stage coordinates alongside the existing furniture rectangles.
- Center placement rings on the measured body centre and derive the high ring
  radius from the body half-diagonal plus 10% clearance.
- Add pure helpers for ring radii and the maximum zoom that keeps the body
  comfortably inside the high ring, with the low ring clamped to the existing
  furniture-safe outer radius.
- Zoom out around the body centre when the overlay is enabled or the chip,
  rotation, or viewport changes and the current zoom exceeds the limit.
- Use the same computed radii for drawing, pointer ring selection, and keyboard
  ring changes.
- Update placement specs and tests for dynamic radii and the measured body.

## Capabilities

- `placement-ring-fit`
- `pin-placement-affinity`

## Out of scope

No change to persistence, solver scoring, allocation order, generated data,
exporters, dialogs, or the global shell. No new dependency and no new user
preference.

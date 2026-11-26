# Design: Placement Ring Stability

1. **One scaling source.** `placementRingRadii(halfDiagonal)` returns
   `{ high: 1.4 × d, medium: 1.55 × d, low: 1.7 × d }`. No stage or furniture
   value participates, so `high < medium < low` always holds.

2. **Measured body stays.** `PackageCanvas.svelte` keeps measuring
   `data-ic-body` for centre and diagonal. Pan and zoom continue to re-measure
   the body so the rings stay locked to the package.

3. **Enable-only fit.** `placementZoomLimit()` uses the low factor and the
   stage half-extent to choose a zoom when the overlay is first enabled. After
   that, manual zoom, pan, wheel, chip changes, rotation, and resize never
   trigger automatic zoom.

4. **Remove dead measurement.** The canvas stops computing a placement
   furniture-safe radius. `data-placement-furniture` markers are removed from
   HUD elements unless another feature still needs them; otherwise they remain
   inert.

5. **Clipping is intentional.** Rings outside the canvas are clipped by the
   stage viewport. No opacity, warning, or clamp is added.

6. **Tests.** Pure-helper tests pin the new ratios, stable ordering, and
   enable-fit zoom limit. Static tests remove low-clamp assertions while
   preserving drag, keyboard, allocation, and persistence coverage.

## Risks / Trade-offs

- At high zoom the outer rings may not be fully visible. The user explicitly
  accepted this; the IC and inner ring remain the placement reference.
- Removing furniture clearance means rings can cross HUD controls visually.
  The overlay already ignores pointer events outside indicators.

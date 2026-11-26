# Design: Placement Pin Ring Refinement

1. **Pin-based radius.** Mark each perimeter pad rectangle with
   `data-pin-bounds`. In grid renderers, wrap the ball circle and its visible
   text in a group with `data-pin-bounds`. `PackageCanvas.svelte` measures those
   rectangles in stage coordinates and computes the maximum distance from the
   body centre to any rectangle corner. That value becomes `pinRadius`.

2. **Fallback.** Before a successful measurement or when no pin bounds exist,
   use the body half-diagonal. The fallback keeps the overlay renderable during
   the first frame or if a renderer omits the marker.

3. **Unchanged ring behavior.** `placementRingRadii(pinRadius)` keeps the
   1.4 / 1.55 / 1.7 factors. The body centre remains the centre, zoom is locked
   to the IC, auto-fit remains enable-only, and rings clip naturally at the
   canvas edge.

4. **Ring stroke style.** `PlacementOverlay.svelte` renders all three rings
   with `stroke-dasharray="2 3"` and `stroke-width="1"`. The previous low-ring
   `5 4` exception is removed. Indicator handle circles keep their current
   appearance.

5. **Tests.** Add a pure farthest-corner helper with host tests; update ring
   tests for the new input, static renderer-marker assertions, and stroke
   strings. Preserve ring-selection, allocation, persistence, rotation, and
   furniture-independent coverage.

## Risks / Trade-offs

- Grid text visibility changes with zoom, so the measured ball extent can
   change at the 1.05 and 1.75 zoom thresholds. The fallback and continuous
   re-measure keep this stable.
- Using corner distance makes the inner ring conservative; large rectangular
   pads get extra clearance, which is intentional.

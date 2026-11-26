# Design: Canvas View Extraction

1. **Pure view math lives in `src/core/canvas-view.ts`.** `fitViewTransform`
   accepts declared SVG extents, a parsed viewBox, stage size, and rotation and
   returns `{ zoom, panX, panY }`. `zoomAtPoint` applies a factor around a
   client-space point; `wheelZoomFactor` keeps the mouse-wheel and trackpad
   branches; `pinchTransform` applies a pointer-distance ratio around the pinch
   midpoint. All functions are deterministic and import nothing from Svelte or
   DOM APIs.

2. **The component keeps DOM orchestration.** `PackageCanvas.svelte` still
   reads SVG attributes, measures the stage, owns pointer state, registers
   listeners, and exposes `fitView()` for the workspace. It applies the pure
   results to its runes and keeps every `data-placement-furniture` marker and
   listener string intact.

3. **Tests follow the new seam.** Unit tests cover clamps, quarter-turn
   extents, cursor-centered zoom, wheel deltas, and pinch ratios. Static
   assertions that previously matched inline arithmetic now check the helper
   definitions and call sites.

## Risks / Trade-offs

- The formula is split between attribute reading (component) and arithmetic
  (core), so the two must stay in sync. The unit tests pin the numeric
  behavior, and the component keeps the `rotation === 90 || rotation === 270`
  extent selection visible at the call site.

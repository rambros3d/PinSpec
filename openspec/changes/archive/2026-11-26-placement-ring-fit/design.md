# Design: Placement Ring Fit

1. **Measure the rendered body.** Add `data-ic-body` to the main body rectangle
   in `PerimeterPackage.svelte` and `GridPackage.svelte`. `PackageCanvas.svelte`
   reads its `getBoundingClientRect()` in stage-local coordinates. That rect
   already includes package rotation, zoom, and pan, so renderer layout math is
   not duplicated.

2. **Pure geometry.** A new `src/core/` helper takes the body half-diagonal and
   the furniture-safe outer radius and returns high/medium/low radii:
   `high = halfDiagonal × 1.1`, `low <= safeOuterRadius`, medium between them.
   A second helper returns the maximum zoom satisfying that rule so an
   oversized package can be zoomed out.

3. **Auto zoom without feedback loops.** Re-measure on overlay enable, chip or
   rotation change, and resize. If current zoom exceeds the limit, apply
   `zoomAtPoint()` anchored at the body centre. An epsilon guard prevents a
   measure → zoom → measure cycle; pointer movement does not trigger auto zoom.

4. **One radius source.** `PlacementOverlay.svelte` uses the computed radii for
   circle drawing, labels, and `ringFromEvent()`, so drag, keyboard, and visual
   feedback agree. Fixed `RING_FACTORS` are removed from the component.

5. **Verification.** Host tests cover clearance, clamping, and zoom limits.
   Static tests verify the body marker and measurement wiring; existing
   placement behavior and persistence tests must remain green.

## Risks / Trade-offs

- Measuring a transformed SVG rect is layout-dependent; the existing
  `queueMicrotask` measurement pattern and resize observer already handle this.
- Auto zoom-out changes the user's zoom only when the inner-circle contract
  would otherwise be violated; it does not re-fit on every pointer move.

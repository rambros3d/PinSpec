# Proposal: Canvas View Extraction

## Why

`PackageCanvas.svelte` mixes Svelte DOM orchestration with the arithmetic for
fit, pointer-centered zoom, wheel steps, and pinch scaling. Those formulas are
pure but can only be tested through source-text assertions, and the 903-line
component makes the view model hard to find.

## What Changes

- Add `src/core/canvas-view.ts` with pure fit, zoom-at-point, wheel-step, and
  pinch-transform helpers, including the existing zoom clamps and rounding.
- Wire `PackageCanvas.svelte` to call those helpers while keeping its exported
  `fitView()` instance method, pointer listeners, and all markup unchanged.
- Add unit tests for the pure formulas and update the static view assertions
  that previously searched for inline arithmetic.

## Capabilities

- `canvas-view-model`

## Out of scope

No change to pointer capture rules, overlay clamping, renderer selection,
HUD layout, persistence, or generated data. No new dependency and no new
component mount.

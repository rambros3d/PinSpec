# Proposal

## Why

Touch users cannot zoom the package canvas with a pinch gesture. The canvas wheel handler is the only zoom input, and touch and Safari gesture events stay passive, so the browser zooms the page instead of the package. Package rotation is also session-only, limited to four clockwise states, and applied as a CSS rotation to the whole SVG, which turns pin labels sideways in two of those states.

## What Changes

- Handle wheel input with a non-passive listener on the canvas stage. Use the existing stepped zoom factor for plain wheel input and a fine-grained factor for ctrl/meta wheel input (trackpad pinch).
- Add two-pointer touch pinch and Safari gesture handling. Feed a pointer-distance ratio into the existing cursor-centred `zoomBy()` around the pinch midpoint. Set `touch-action: none` on the stage so touch input does not scroll or zoom the document.
- Replace the four-state clockwise rotation (`0 | 90 | 180 | 270`) with a two-state toggle between `0` and `-90` degrees (counter-clockwise) in the workspace store, toolbar, and canvas HUD.
- Move rotation from a CSS wrapper on the SVG into the SVG renderers. Rotate package geometry around the viewBox centre with an SVG `transform`, and counter-rotate each pin name, position, tag, and header text around its own anchor so labels stay upright in both states.
- Persist rotation as additive optional `packageRotation?: 0 | -90` in workspace state, history clone and equality, recent-session `localStorage`, the compact share-link payload, and the version-2 project file. An absent value normalizes to `0`, so stored states without rotation stay unchanged.
- Update the static source-contract tests that inspect the canvas and package renderers, and add unit tests for rotation normalization and persistence round trips.

No upstream catalog data, exporters other than the JSON project file, or npm dependencies change.

## Capabilities

### New Capabilities

- `canvas-gesture-and-rotation`: Canvas zoom input from wheel, trackpad, and two-pointer pinch through the existing cursor-centred zoom path, plus a persisted two-state package rotation that keeps labels upright.

### Modified Capabilities

None. Existing capabilities constrain layout, multi-vendor rendering, and theme tokens; their requirements stay as they are and are treated as regression checks for this work.

## Impact

- `src/components/workspace/PackageCanvas.svelte`: native non-passive wheel and gesture listeners, pinch tracking, removal of the CSS rotation wrapper, rotation prop passed to both renderers, updated HUD label.
- `src/components/workspace/PerimeterPackage.svelte` and `src/components/workspace/GridPackage.svelte`: new optional `rotation` prop, SVG geometry rotation, anchor-local counter-rotation of text and tag groups.
- `src/state/workspace.svelte.ts`: rotation derived from persisted state, two-state toggle through history, no session-only rotation field.
- `src/core/types.ts`, `src/core/history.ts`, `src/core/url-state.ts`, `src/core/exporters/json.ts`: additive `packageRotation` field, normalizer, clone/equality, compact key, project-file field.
- `src/components/workspace/TopToolbar.svelte`, `src/pages/WorkspacePage.svelte`: rotation prop type and callback naming.
- `src/app.css`: `touch-action: none` scoped to the canvas stage, using existing theme tokens only.
- `tests/viewport-layout.test.ts`, `tests/pin-placement-affinity.test.ts`, `tests/theme-tokens.test.ts`, `tests/ui-multi-vendor.test.ts`, plus new persistence tests.

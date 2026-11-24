# Proposal

## Why

Package rotation is limited to a two-state counter-clockwise toggle (0 and -90 degrees). Pad labels on top and bottom edges are counter-rotated from the pin's original side, so they render upside down at -90 degrees. The placement-rings rotate control shares the package rotate icon and an ambiguous label, so the two actions are easy to confuse.

## What Changes

- Replace the two-state `0 | -90` rotation model with four clockwise orientations `0 | 90 | 180 | 270`. A single activation of the package rotate control advances one step clockwise and wraps from 270 to 0. No reverse control is added. **BREAKING**: the persisted value domain changes, with a shim that normalizes legacy `-90` to `270` so existing states keep their visual orientation.
- Rotate package geometry with a generic `rotate(<degrees> cx cy)` transform and derive every label angle from the pin's displayed side after rotation. Left and right edges use 0-degree horizontal text; top and bottom edges use -90-degree vertical text reading upward and rightward. Text is never upside down.
- Distinguish the placement-rings rotate control from package rotation with a different icon and a label or tooltip containing Rings. The rings control continues to rotate only the placement overlay.
- Swap SVG `width` and `height` for 90 and 270 degrees with correct viewBox handling, and keep fit-view compensation for rotated extents, so rectangular packages are not clipped under manual zoom and pan.
- Widen the additive version-2 `packageRotation` field, compact URL key `z`, history clone and equality, and project-file field to the four-value domain. Normalize legacy `-90` to `270` at every decode boundary. Keep an absent field byte-identical as the default 0 orientation.
- Update the deliberately affected unit tests. Preserve all other layout, theme, multi-vendor rendering, bonding, and interaction contracts.

## Capabilities

### New Capabilities

- `four-orientation-package-rotation`: Four clockwise package orientations, text orientation derived from displayed pin side, a visually distinct placement-rings control, rotated-extent SVG sizing, and the legacy rotation normalization shim.

### Modified Capabilities

- `canvas-gesture-and-rotation`: Replace its two-state counter-clockwise rotation requirements with four clockwise orientations, including upright labels, version-2 persistence, and persistence-path survival.

## Impact

- Core types and codecs: `src/core/types.ts`, `src/core/history.ts`, `src/core/url-state.ts`, `src/core/exporters/json.ts`, and `src/data-url.ts` consumers.
- Workspace state: `src/state/workspace.svelte.ts` derived rotation and clockwise cycle, plus recent-session persistence.
- Renderers: `src/components/workspace/PerimeterPackage.svelte` and `GridPackage.svelte` geometry transform, text angles, and SVG extents.
- Canvas controls: `src/components/workspace/PackageCanvas.svelte` fit view and placement-rings control, and `src/components/workspace/TopToolbar.svelte` package rotate control.
- Tests: `tests/package-rotation.test.ts`, `tests/viewport-layout.test.ts`, `tests/ui-multi-vendor.test.ts`, `tests/pin-placement-affinity.test.ts`, and `tests/theme-tokens.test.ts`.
- No new dependency. No data pipeline change. No change to `openspec/specs/viewport-locked-workspace`, which contains no rotation strings, or to `openspec/specs/pin-placement-affinity`, which specifies overlay rotation without a conflicting limit.

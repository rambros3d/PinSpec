# Proposal

## Why

The placement overlay edits per-peripheral preferences in a floating canvas panel that is unavailable in the portrait dock and duplicates the right-hand detail surface. The persisted ring values use spatial names that do not match the priority they express, and the outer ring uses a fixed fraction of the canvas rather than the space that remains after canvas controls are placed.

## What Changes

- Move the floating placement properties markup into a new compact Place tab hosted by the right-hand summary drawer in landscape and by the portrait dock.
- Keep the placement ON/OFF toggle as a bottom-centre canvas-only control. Do not add a toggle to the sidebar. The sidebar Place tab becomes active once placement is enabled on the canvas.
- List only configured peripherals in the panel, defined as those holding an assignment or a non-disabled mode. Give each listed peripheral an enable or disable control for its placement bubble; disabling falls back to scarcity-only allocation.
- Keep bubble dragging and keyboard angle adjustment on the canvas, and reuse the existing preview and commit path so moving a bubble between priority circles reallocates pins in real time with one undo entry on release.
- Rename persisted ring values from inner, middle, outer to high, medium, low. Accept the legacy values on share URL and project JSON import and normalize them so existing version-2 state does not silently drop preferences.
- Compute the largest safe outer-ring radius from measured canvas furniture (view HUD, remap banner, placement toggle, legend, hint, and workspace canvas buttons), keeping the ring centre at the package or stage centre, with a pure helper in `src/core/placement.ts`.
- Update the affected unit tests and specs for the new tab, ring names, canvas-only toggle, panel tokens, and safe-radius helper.

## Capabilities

### New Capabilities

- `placement-properties-panel`: The right-hand properties surface for placement, covering the Place tab in both layouts, the configured-peripheral bubble controls, the canvas-only toggle boundary, and safe priority-ring geometry.

### Modified Capabilities

- `pin-placement-affinity`: Ring values become high, medium, low with legacy normalization; overlay rings stay on canvas while the properties panel moves to the sidebar; the panel lists configured peripherals; the toggle is a bottom-centre canvas-only control; the outer ring uses a safe maximum radius.
- `viewport-locked-workspace`: The portrait dock tab set and its localStorage-only persistence gain the Place tab.

## Impact

- `src/components/workspace/PlacementOverlay.svelte` (floating panel markup removed), new `src/components/workspace/PlacementPanel.svelte`.
- `src/core/placement.ts`, `src/core/types.ts`, `src/core/solver.ts`, `src/core/url-state.ts`, `src/core/exporters/json.ts`, with `partitionPeripherals` reused from `src/core/vendor-view.ts`.
- `src/components/workspace/PackageCanvas.svelte`, `src/components/workspace/SummaryDrawer.svelte`, `src/pages/WorkspacePage.svelte`, `src/app.css`.
- `src/state/workspace.svelte.ts`, `src/state/workspace-preferences.svelte.ts` for view-only selection state.
- Tests: `tests/pin-placement-affinity.test.ts`, `tests/workspace-qol.test.ts`, `tests/viewport-layout.test.ts`, `tests/ui-multi-vendor.test.ts`, `tests/theme-tokens.test.ts`.
- No new dependency, no backend, and no change to generated catalog data or STM32 pin-assignment behavior.

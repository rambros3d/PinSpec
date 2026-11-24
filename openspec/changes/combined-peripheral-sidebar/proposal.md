# Proposal

## Why

Peripheral configuration currently lives in the right-hand drawer while tree
navigation lives in the left pane, so selecting a peripheral and editing its
mode, signals, and remap requires crossing the canvas. Placement properties live
in a floating canvas panel that is absent from the portrait dock, and persisted
ring values use spatial names that do not express their priority.

## What Changes

- Build an adjacent combined sidebar in the left pane: a narrow peripheral tree
  beside a detail column that hosts `PeripheralDetail`. Default tree width is
  160px clamped to 120-240px; the detail column minimum is 260-320px. At narrow
  landscape widths force the minimum combined width instead of auto-collapsing,
  even if the canvas shrinks.
- Simplify tree rows to a status circle and the peripheral name. Hue encodes
  solver status (neutral, success, warning, error); filled versus hollow
  encodes mode present versus disabled or absent. No placement or selection
  markers appear in the tree; selection remains a row highlight, and placement
  state stays on the canvas and in the Place section. The exact state is exposed
  through `title` and `aria-label`.
- Move `PeripheralDetail` out of the right `SummaryDrawer` Configuration tab
  into the combined sidebar detail column. Remove the Configuration tab from
  `SummaryDrawer` and from the portrait dock. The drawer keeps Pins,
  Diagnostics, DMA, GPIO, and Audit, together with the RP PIO panel.
- Portrait always presents the tree and detail column side by side inside the
  dock Peripherals tab, never stacked. Update the portrait dock CSS and tab set
  accordingly; Place is a section of the combined sidebar, not a dock tab.
- Add a Place section and tab beside the tree in the combined sidebar. When
  placement mode is enabled it lists configured peripherals only, each with a
  toggle for its placement bubble. Moving a bubble between priority circles
  reallocates pins in real time through the existing preview and commit path.
  The placement ON/OFF toggle remains a bottom-centre, canvas-only control.
- Rename persisted ring values from `inner`, `middle`, `outer` to `high`,
  `medium`, `low`, with display labels High, Medium, and Low. Accept legacy
  values on version-2 share URL and project JSON import and normalize them so
  existing preferences are not silently dropped.
- Size the outer priority circle as large as the canvas permits without
  overlapping floating canvas buttons, keep the ring centre at the package or
  stage centre, and compute the radius with a pure measured-safe-radius helper
  in `src/core/placement.ts`.
- Keep pin configuration shareable in URL and JSON state. Keep selection,
  filter, category expansion, section state, and tab choice in localStorage
  only.

## Capabilities

### New Capabilities

- `combined-peripheral-sidebar`: The adjacent left-pane surface that combines
  the narrow peripheral tree, the peripheral detail column, and the Place
  section, including width behavior, row encoding, placement bubble controls,
  and the canvas-only toggle boundary.

### Modified Capabilities

- `peripheral-tree-detail-panel`: Detail editing moves from the right drawer to
  the combined sidebar; rows lose inline mode labels and extra markers; view
  preferences gain the sidebar section state.
- `viewport-locked-workspace`: Landscape gains the combined sidebar, the
  portrait dock hosts it side by side, and the Configuration tab is removed
  from the drawer and dock tab sets.
- `pin-placement-affinity`: Ring values become `high`, `medium`, `low` with
  legacy normalization; properties move to the sidebar Place section; the
  toggle is bottom-centre and canvas-only; the configured-only bubble list and
  safe outer-radius rule replace the previous selector and fixed geometry.

## Impact

- Components: `PeripheralTree.svelte`, `PeripheralDetail.svelte`,
  `SummaryDrawer.svelte`, `PlacementOverlay.svelte`, `PackageCanvas.svelte`,
  `WorkspacePage.svelte`, a new combined sidebar component, and a new placement
  properties component.
- Core: `src/core/types.ts` (tab sets, ring constants, ring rank),
  `src/core/placement.ts` (legacy normalization, configured-peripheral
  derivation, safe-radius helper), `src/core/vendor-view.ts` (reused
  partition), `src/core/solver.ts` (ring ranks), `src/core/url-state.ts` and
  `src/core/exporters/json.ts` (version-2 persistence).
- State and CSS: `src/state/workspace-preferences.svelte.ts` for localStorage
  section state, `src/app.css` for the landscape grid and portrait dock.
- Tests: `tests/peripheral-detail-panel.test.ts`,
  `tests/pin-placement-affinity.test.ts`, `tests/viewport-layout.test.ts`,
  `tests/workspace-qol.test.ts`, `tests/ui-multi-vendor.test.ts`, and
  `tests/theme-tokens.test.ts`.
- No new dependency, no backend, no generated catalog data changes, and no
  change to STM32 pin-assignment behavior.

# Proposal

## Why

Placement bubble controls currently live in the left combined sidebar's
Detail/Place switcher, away from the pin table and diagnostics they affect. The
switcher also duplicates presentation state that belongs with the other drawer
and dock tabs. Moving placement into the right drawer keeps the controls next to
the assigned pins and removes the left-sidebar mode switch entirely.

## What Changes

- Add a `Placement` tab to the right summary drawer and to the portrait dock.
- Remove the left sidebar's Detail/Place switcher and Place section. The left
  sidebar keeps only the peripheral tree and the peripheral detail column.
- Opening the Placement tab, in either orientation, sets `placementOverlayVisible`
  automatically. The canvas top-left toggle stays available for quick access.
- Replace the panel's peripheral selector, numeric angle input, ring selector,
  and claimed-pin summary with a simple list of configured peripherals and one
  enable/disable toggle per row.
- Keep angle and ring adjustment on the canvas rings by dragging the bubble.
  Dragging continues through `previewPlacement` / `commitPlacement` to
  `reallocatePeripheralPlacement`; locked pins stay untouched and legality
  checks stay unchanged.
- Persist bubble enable/disable in `WorkspaceState.placement` as shareable pin
  configuration. Persist tab selection and overlay visibility only in
  `localStorage`.
- Remove the obsolete sidebar-section preference and update the static source
  contract tests that reference it.

## Capabilities

### New Capabilities

- `placement-right-panel`: Right-drawer Placement tab, automatic overlay
  activation, configured-only bubble toggles, visual ring adjustment, and the
  persistence split for placement controls.

### Modified Capabilities

- `pin-placement-affinity`: Overlay activation path and canvas toggle location,
  panel location for opt-in and selection, removal of numeric angle input, and
  localStorage-only overlay visibility.
- `combined-peripheral-sidebar`: Remove the Place section and sidebar-section
  switcher; the detail column hosts detail only and placement is referenced from
  the right drawer.
- `viewport-locked-workspace`: Add the Placement tab to the portrait dock tab
  set and its persisted tab preference.

## Impact

- Components: `CombinedSidebar.svelte`, `PlacementPanel.svelte`,
  `SummaryDrawer.svelte`, `WorkspacePage.svelte`, `PackageCanvas.svelte`,
  `PlacementOverlay.svelte`, and portrait dock selectors in `app.css`.
- State and core: `workspace-preferences.svelte.ts` (overlay visibility,
  sidebar-section removal), `workspace.svelte.ts` (tab-driven activation),
  `types.ts` (`SUMMARY_TABS`, `DOCK_TABS`, overlay visibility boundary), and the
  URL, JSON, and history codecs for overlay visibility.
- Tests: `pin-placement-affinity`, `viewport-layout`, `workspace-qol`,
  `ui-multi-vendor`, `theme-tokens`, `peripheral-detail-panel`, and
  `view-preferences`.
- No new dependency. `src/core/` stays pure TypeScript. Generated chip data and
  the release gates are unchanged.

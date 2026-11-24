# Tasks

## 1. Ring values, persistence, and view-state constants

- [ ] 1.1 Rename `PLACEMENT_RINGS` and `PLACEMENT_RING_RANK` in `src/core/types.ts` to `high`, `medium`, `low` with ranks 0, 1, 2, update comments, and use the display labels High, Medium, and Low in the UI; verify a unit test asserts high-first rank order and that the default bubble ring is `low`.
- [ ] 1.2 Normalize legacy `inner`, `middle`, `outer` to `high`, `medium`, `low` in `parsePinPlacementPreference`, `canonicalPinPlacementPreference`, and `normalizePlacement` in `src/core/placement.ts`; verify host tests show legacy preferences kept with angle and enabled flag intact.
- [ ] 1.3 Update `src/core/url-state.ts` and `src/core/exporters/json.ts` to emit only the new ring names and accept legacy names on decode and parse without a schema version bump; verify share URL and project JSON round-trip tests preserve angle and enabled flag and normalize the ring.
- [ ] 1.4 Update placement scoring and reallocation in `src/core/solver.ts` to use the renamed ranks; verify `tests/pin-placement-affinity.test.ts` passes with high, medium, low preferences.
- [ ] 1.5 Remove `configuration` from `DOCK_TABS`, `SUMMARY_TABS`, and the dock label map in `src/pages/WorkspacePage.svelte`, and add a documented `sidebarSection` localStorage preference to `src/state/workspace-preferences.svelte.ts`; verify `tests/viewport-layout.test.ts` passes for the new tab sets and default preferences.

## 2. Pure helpers and safe ring geometry

- [ ] 2.1 Move the `PlacementIndicator` interface from `src/components/workspace/PlacementOverlay.svelte` into `src/core/placement.ts` and update importers; verify `npm run check` passes with no DOM or Svelte import in `src/core/`.
- [ ] 2.2 Add a pure configured-peripheral derivation helper in `src/core/placement.ts` that reuses `partitionPeripherals` from `src/core/vendor-view.ts`; verify unit tests separate configured from unconfigured names for STM32, CH32, and RP fixtures.
- [ ] 2.3 Add a pure measured-safe-radius helper in `src/core/placement.ts`, following the measure-in-DOM/arithmetic-in-core pattern of `src/core/overlay-position.ts`, that takes the stage centre, stage bounds, and reserved rectangles and returns the largest finite radius that clears them; verify unit tests assert no rectangle overlap, unchanged centre, and a finite fallback for degenerate input.
- [ ] 2.4 Update `src/components/workspace/PackageCanvas.svelte` to measure the view HUD, remap banner, bottom-centre placement toggle, legend, hint, and `WorkspacePage` canvas buttons and use the safe-radius helper, while keeping rings, indicators, drag, keyboard adjustment, and display rotation on canvas; verify static token tests and a manual check at several zooms show the outer ring clear of those controls.
- [ ] 2.5 Update `tests/pin-placement-affinity.test.ts` for high, medium, low, the moved indicator interface, ring factors, configured-only derivation, safe-radius helper, and canvas-only toggle; verify `npm test` passes.

## 3. Combined sidebar layout and tree row encoding

- [ ] 3.1 Add a combined sidebar component in `src/components/workspace/` that hosts the narrow tree and detail column side by side; default the tree to 160px clamped to 120-240px, keep a 260-320px detail minimum, and force the combined minimum at narrow landscape widths without auto-collapsing; verify `tests/viewport-layout.test.ts` passes for the grid areas and width tokens.
- [ ] 3.2 Move `PeripheralDetail` into the sidebar Detail section and remove the Configuration tab body and tab control from `SummaryDrawer.svelte`; verify `tests/peripheral-detail-panel.test.ts` is updated for the relocation and asserts one detail mount only.
- [ ] 3.3 Rewrite tree rows in `PeripheralTree.svelte` to show only a status circle and name, with hue for solver status, filled versus hollow for mode presence, exact state in `title` and `aria-label`, and selection as a row highlight only; remove `inlineModeLabel` and all placement or selection markers; verify `tests/peripheral-detail-panel.test.ts` and `tests/theme-tokens.test.ts` pass with no raw color literals added.
- [ ] 3.4 Update `src/pages/WorkspacePage.svelte` selection wiring to activate the sidebar Detail section and the left resizer to control the combined sidebar width; verify tests confirm one tree, one detail column, one canvas, and one drawer are mounted and the selected peripheral survives reload.
- [ ] 3.5 Update `src/app.css` landscape grid and portrait dock rules for the side-by-side combined sidebar, remove the `configuration` dock visibility selectors, and keep independent internal scrolling; verify `tests/viewport-layout.test.ts` passes for portrait side-by-side behavior and the reduced dock tab set.

## 4. Place section and canvas-only toggle

- [ ] 4.1 Create `src/components/workspace/PlacementPanel.svelte` with a configured-peripheral list, a per-peripheral bubble enable or disable control, numeric angle input, and claimed-pin display, calling the workspace set, preview, and commit methods directly and exposing no overlay ON/OFF toggle; verify `tests/pin-placement-affinity.test.ts` passes for panel tokens and no floating canvas panel.
- [ ] 4.2 Host the Place section beside the tree in the combined sidebar detail column, drive it from the `sidebarSection` localStorage preference, and show guidance until placement is enabled on the canvas; verify tests confirm the value survives reload and that no sidebar section field appears in share URLs or project JSON.
- [ ] 4.3 Remove the floating properties panel markup from `PlacementOverlay.svelte` while keeping rings, indicators, drag handling, keyboard angle and ring changes, and display rotation on the canvas; verify `tests/workspace-qol.test.ts` still finds the Escape and focus tokens on the canvas indicator group.
- [ ] 4.4 Keep the placement ON/OFF toggle at bottom centre in `PackageCanvas.svelte` with no sidebar counterpart; verify `tests/pin-placement-affinity.test.ts` confirms the canvas toggle token and the absence of a sidebar toggle in the Place section.
- [ ] 4.5 Update `tests/ui-multi-vendor.test.ts` for remap tokens now living in the detail component and `tests/workspace-qol.test.ts` for the reduced dock labels and contrast bans; verify `npm test` passes.

## 5. Persistence and view-state contract

- [ ] 5.1 Verify share URL and project JSON round-trip pin configuration including placement preferences with normalized high, medium, low rings, angle, and enabled flag; verify `tests/pin-placement-affinity.test.ts` passes with no dropped preference.
- [ ] 5.2 Verify selected peripheral, filter text, category expansion, sidebar section, summary tab, and dock tab stay only in localStorage and are absent from share URLs and project JSON; verify `tests/viewport-layout.test.ts` and `tests/peripheral-detail-panel.test.ts` pass.
- [ ] 5.3 Confirm runtime fetches still use `import.meta.env.BASE_URL`, no hardcoded theme colors were added, STM32 output remains stable, and no generated directory is staged; verify `git status --short` lists only source, test, and spec files.

## 6. Integration verification

- [ ] 6.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify all three succeed with zero warnings.
- [ ] 6.2 Smoke-test the combined sidebar at a narrow landscape width, the portrait side-by-side dock, the outer ring clearing canvas buttons at several zooms, and a share URL round trip; verify the observed behavior matches the delta specs.

## Workflow follow-up

- Run `openspec validate combined-peripheral-sidebar --strict` and confirm it reports the change as valid.
- After verification, the implementation agent runs `openspec archive combined-peripheral-sidebar -y` and includes the archived spec files in the change commit.
- Commit and push only after archive, using the commit format required by `AGENTS.md`.

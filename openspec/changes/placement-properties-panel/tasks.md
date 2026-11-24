# Tasks

## 1. Ring values and persistence

- [ ] 1.1 Rename `PLACEMENT_RINGS` and `PLACEMENT_RING_RANK` in `src/core/types.ts` to `high`, `medium`, `low` with ranks 0, 1, 2 and add the legacy-value mapping used by the decode shim; verify a unit test asserts high-first rank order and that the default bubble ring is `low`.
- [ ] 1.2 Normalize legacy `inner`, `middle`, `outer` to `high`, `medium`, `low` in `parsePinPlacementPreference`, `canonicalPinPlacementPreference`, and `normalizePlacement` in `src/core/placement.ts`; verify host tests show legacy preferences kept with angle and enabled flag intact.
- [ ] 1.3 Update `src/core/url-state.ts` and `src/core/exporters/json.ts` to emit only the new ring names and accept legacy names on decode and parse without a schema version bump; verify share URL and project JSON round-trip tests preserve angle and enabled flag and normalize the ring.
- [ ] 1.4 Update placement scoring and reallocation in `src/core/solver.ts` to use the renamed ranks; verify `tests/pin-placement-affinity.test.ts` passes with high, medium, low preferences.

## 2. Pure helpers and safe ring geometry

- [ ] 2.1 Move the `PlacementIndicator` interface from `src/components/workspace/PlacementOverlay.svelte` into `src/core/placement.ts` and update its importers; verify `npm run check` passes with no DOM or Svelte import in `src/core/`.
- [ ] 2.2 Add a pure configured-peripheral derivation helper in `src/core/placement.ts` that reuses `partitionPeripherals` from `src/core/vendor-view.ts`; verify unit tests separate configured from unconfigured names for STM32, CH32, and RP fixtures.
- [ ] 2.3 Add a pure safe-radius helper in `src/core/placement.ts`, following the measure-in-DOM/arithmetic-in-core pattern of `src/core/overlay-position.ts`, that takes the stage centre, stage bounds, and reserved rectangles and returns the largest finite radius centred on the stage that clears them; verify unit tests assert no rectangle overlap, unchanged centre, and a finite fallback for degenerate input.
- [ ] 2.4 Update `src/components/workspace/PackageCanvas.svelte` to measure the view HUD, remap banner, bottom-centre placement toggle, legend, hint, and `WorkspacePage` canvas buttons and use the safe-radius helper, while keeping rings, indicators, drag, keyboard, and display rotation on canvas; verify static token tests and a manual check at several zooms show the outer ring clear of those controls.

## 3. Place tab and properties panel

- [ ] 3.1 Add the `placement` tab with label `Place` to `SUMMARY_TABS`, `DOCK_TABS`, `DOCK_TAB_LABELS`, and the `data-dock-tab` selector in `src/app.css`, and make the `SummaryDrawer` tab strip horizontally scrollable; verify `tests/viewport-layout.test.ts` passes for dock tabs and single-mount contracts.
- [ ] 3.2 Create `src/components/workspace/PlacementPanel.svelte` with a configured-peripheral list, an enable or disable control per placement bubble, numeric angle input, and claimed-pin display, calling `workspaceStore` set, preview, and commit methods directly and containing no overlay ON/OFF toggle; verify `tests/pin-placement-affinity.test.ts` passes for panel tokens and the absence of a floating canvas panel.
- [ ] 3.3 Host `PlacementPanel` behind the `placement` tab in `SummaryDrawer.svelte` and in the portrait dock through the existing single `SummaryDrawer` instance; verify tests confirm one tree, one canvas, and one drawer are mounted and only the selected tab body is visible.
- [ ] 3.4 Remove the floating properties panel markup from `PlacementOverlay.svelte` while keeping rings, indicators, drag handling, keyboard angle and ring changes, and display rotation on the canvas; verify `tests/workspace-qol.test.ts` still finds the Escape and focus tokens on the canvas indicator group.
- [ ] 3.5 Store panel selection state only in `src/state/workspace-preferences.svelte.ts` localStorage state with a documented default; verify tests confirm no panel selection field appears in share URLs or project JSON and that the value survives reload.
- [ ] 3.6 Keep the placement toggle at bottom centre in `PackageCanvas.svelte` with no sidebar counterpart, and show guidance in the Place tab until placement is enabled; verify tests confirm the canvas toggle token and that the sidebar panel exposes no ON/OFF toggle.

## 4. Test and contract updates

- [ ] 4.1 Update `tests/pin-placement-affinity.test.ts` for `high`, `medium`, `low`, the moved indicator interface, panel tokens, the bottom-centre canvas toggle, configured-only derivation, preview and commit on bubble movement, and the safe-radius helper; verify `npm test` passes.
- [ ] 4.2 Update `tests/workspace-qol.test.ts`, `tests/viewport-layout.test.ts`, `tests/ui-multi-vendor.test.ts`, and `tests/theme-tokens.test.ts` for canvas-ring Escape and focus tokens, the Place dock label, `formatMuxLabel` call sites, and no raw color literals outside `src/themes/daisyui.css`; verify `npm test` passes.
- [ ] 4.3 Preserve share URL and project JSON pin-configuration round-trip tests using normalized ring values; verify `npm test` passes with no dropped placement preference.

## 5. Integration verification

- [ ] 5.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify all three succeed with zero warnings.
- [ ] 5.2 Confirm runtime fetches still use `import.meta.env.BASE_URL`, no hardcoded theme colors were added, STM32 output remains stable, and no generated directory is staged; verify `git status --short` lists only source, test, and spec files.

## Workflow follow-up

- Run `openspec validate placement-properties-panel --strict` and confirm it reports the change as valid.
- After verification, the implementation agent runs `openspec archive placement-properties-panel -y` and includes the archived spec files in the change commit.
- Commit and push only after archive, using the commit format required by `AGENTS.md`.

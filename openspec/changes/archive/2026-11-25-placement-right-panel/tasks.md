# Tasks

## 1. Tab registration and state boundary

- [x] 1.1 Add `placement` to `SUMMARY_TABS` and `DOCK_TABS` in `src/core/types.ts` with the documented normalization defaults (`pins` and `peripherals`); verify the tab normalization assertions in `tests/viewport-layout.test.ts` and core I/O tests pass after updating them.
- [x] 1.2 Move placement overlay visibility into `src/state/workspace-preferences.svelte.ts`: add a localStorage-backed `placementOverlayVisible` preference with normalization and remove the obsolete `sidebarSection` section; verify `tests/view-preferences.test.ts` is updated and passes.
- [x] 1.3 Remove `placementOverlayVisible` from the shareable state surface in `src/core/types.ts`, `src/core/history.ts`, `src/core/url-state.ts`, and `src/core/exporters/json.ts`, ignoring a legacy `w` flag on decode; verify the codec and history assertions in `tests/pin-placement-affinity.test.ts` are updated deliberately and pass.

## 2. Left sidebar simplification

- [x] 2.1 Remove the Detail/Place switcher, `SIDEBAR_SECTIONS` use, and `PlacementPanel` mount from `src/components/workspace/CombinedSidebar.svelte` so the detail column always shows `PeripheralDetail`; verify `tests/peripheral-detail-panel.test.ts` and `tests/viewport-layout.test.ts` source contracts are updated and pass with `npm run check`.

## 3. Right-drawer Placement list

- [x] 3.1 Reduce `src/components/workspace/PlacementPanel.svelte` to a configured-only list from `configuredPeripheralNames`, with one enable/disable toggle per row calling `workspaceStore.setPlacement` and no angle input, ring selector, claimed-pin text, or rotate control; verify `tests/pin-placement-affinity.test.ts` and `tests/workspace-qol.test.ts` source contracts are updated and pass.
- [x] 3.2 Mount the simplified panel as the `placement` tab body in `src/components/workspace/SummaryDrawer.svelte` using the existing bindable `activeTab` and drawer props; verify the tab body renders only when active and `npm run check` passes.

## 4. Activation and allocation behavior

- [x] 4.1 Set `viewPreferences.placementOverlayVisible` to true when the Placement drawer or dock tab is selected in `src/pages/WorkspacePage.svelte`, and keep the canvas top-left toggle in `src/components/workspace/PackageCanvas.svelte` using the same preference setter; verify the activation and toggle source contracts in `tests/pin-placement-affinity.test.ts` pass.
- [x] 4.2 Keep `previewPlacement`, `commitPlacement`, `reallocatePeripheralPlacement`, and `reallocateMatrixPlacement` unchanged, preserving locked pins and legality during drag; verify the existing allocation, drag, and matrix tests in `tests/pin-placement-affinity.test.ts` pass without behavioral edits.

## 5. Portrait and theme parity

- [x] 5.1 Add the Placement label and body to the portrait dock in `src/pages/WorkspacePage.svelte` and extend the portrait dock selectors in `src/app.css`; verify `tests/viewport-layout.test.ts`, `tests/theme-tokens.test.ts`, and `tests/ui-multi-vendor.test.ts` pass with no raw color literals or emojis introduced.

## 6. Integration verification

- [x] 6.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; verify all three succeed with zero warnings, no broken subpath requests, and unchanged STM32 allocation and export output.
- [x] 6.2 Compare the four delta specs against the implemented behavior and run `openspec validate placement-right-panel --strict`; verify strict validation reports no errors.

## Workflow follow-up

- Archive the change after all tracked tasks pass: `openspec archive placement-right-panel -y`.
- Include the synced files under `openspec/specs/` and `openspec/changes/archive/` in the implementation commit; commit and push only after archive.

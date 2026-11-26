# Tasks

## 1. Persist the display-only overlay rotation

- [x] 1.1 Add optional `placementOverlayRotation?: number` to `WorkspaceState` in `src/core/types.ts` with a doc comment naming it as an overlay display setting. Verify with `npm run check` that strict TypeScript passes and that no schema version constant changes.
- [x] 1.2 Copy and compare the rotation field in `cloneWorkspaceState` and `statesEqual` in `src/core/history.ts`, treating absent and zero as equal through `normalizeAngle`. Verify with a unit test that cloning preserves the value, zero and absent compare equal, and different values compare unequal.
- [x] 1.3 Add `setPlacementOverlayRotation(rotation: number)` to `src/state/workspace.svelte.ts` so one change creates one undoable history entry. Verify with a unit test that set, undo, and redo restore the expected rotation values.
- [x] 1.4 Add a compact non-zero rotation key to `src/core/url-state.ts` and an optional field to `src/core/exporters/json.ts`, decoding both through `normalizeAngle`. Verify with round-trip tests that non-zero values survive both codecs, zero and absent stay omitted, and version validation is unchanged at 2.
- [x] 1.5 Add a persistence test that covers share URL, project JSON, `localStorage` recent sessions, and undo/redo history for the rotation field in `tests/pin-placement-affinity.test.ts`. Verify with `npm test` that the new case passes alongside the existing placement persistence cases.

## 2. Rework the placement overlay controls

- [x] 2.1 Change `RING_FACTORS` in `src/components/workspace/PlacementOverlay.svelte` from `0.34 / 0.66 / 0.96` to `0.50 / 0.72 / 0.98`. Verify with a static assertion in `tests/pin-placement-affinity.test.ts` that the new factors are present and the old ones absent, and by inspecting the overlay at several zoom levels in both themes.
- [x] 2.2 Remove the ring `<select>`, `handleRingChange`, and the `onRing` prop; compute the nearest ring from the pointer radius during move and send angle plus ring through the preview callback, then commit once on pointer-up. Verify that the wiring test no longer expects `onRing` and that dragging a preview produces one undo entry.
- [x] 2.3 Add `Shift+ArrowUp` and `Shift+ArrowDown` ring stepping to the existing indicator keydown handler, keeping `ArrowLeft` and `ArrowRight` angle steps, and clamp ring changes at the ends. Verify with a component-level or static assertion that both modifiers are handled and that out-of-range ring changes are clamped.
- [x] 2.4 Add a rotate button in the overlay panel header that cycles the overlay rotation in 90-degree steps and apply the rotation as a display offset in `pointFor` and `angleFromEvent` only. Verify with a unit test that changing rotation leaves stored preference angles, `buildPinGeometryMap`, `placementAffinityForPin`, and assignments unchanged.
- [x] 2.5 Build selector options from `chip.peripherals` keys with non-empty assignable signals excluding `GPIO`, plus system peripherals that hold assignments, and show an enable action that creates `{ angle: 0, ring: 'outer', enabled: true }` for unconfigured selections. Verify with tests that allocatable and assigned system peripherals appear and that enabling creates the default preference.

## 3. Rewire the canvas indicator set and toggle

- [x] 3.1 Derive `placementIndicators` in `src/components/workspace/PackageCanvas.svelte` from enabled preferences only, keeping `claimed` from assignments and the `set.add(pos)` highlight path. Verify with a test that an assigned but unconfigured peripheral has no indicator and that enabling it from the selector adds one.
- [x] 3.2 Move the placement toggle from the top-right view HUD to an independent top-centre control stacked with the remap banner, preserving `setPlacementOverlayVisible`, `aria-pressed`, and selection clearing on close. Verify with updated static tokens in `tests/pin-placement-affinity.test.ts` and by inspecting the canvas that the HUD contains only view controls.
- [x] 3.3 Keep ring circles and labels in the non-interactive SVG layer and verify that left-click, right-click, and hover on pins under a ring still open the popover, context menu, and tooltip. Verify with a static assertion on the pointer-events layer plus a manual check of all three interactions with the overlay visible.

## 4. Integration verification

- [x] 4.1 Update the static overlay wiring test in `tests/pin-placement-affinity.test.ts` so it asserts the removed `onRing` token is gone while retaining `PLACEMENT_RINGS`, `setPointerCapture`, `type="number"`, `indicator.name`, `PlacementOverlay`, `setPlacementOverlayVisible`, `previewPlacement`, `commitPlacement`, and `set.add(pos)`. Verify with `npm test`.
- [x] 4.2 Confirm the golden allocation fixture and placement scoring tests are unchanged, including the zero placement term when disabled and byte-identical default assignments. Verify with `npm test` that no regression appears in `tests/fixtures/stm32-golden.json` comparisons or scoring cases.
- [x] 4.3 Run the full project verification sequence `npm test && npm run check && BASE_PATH="/pinspec/" npm run build` and confirm all three commands pass with zero warnings and no broken subpath references.

## Workflow follow-up

- Archive the change with `openspec archive placement-overlay-interaction-refresh -y` after all tracked tasks pass, and include the archived specs in the implementation commit.
- Confirm the main spec at `openspec/specs/pin-placement-affinity/spec.md` contains the synced modified and added requirements after archive.

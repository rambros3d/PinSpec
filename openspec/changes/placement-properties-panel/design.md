# Design

## Context

See `proposal.md` for motivation. The relevant current state is:

- `src/components/workspace/PlacementOverlay.svelte`: exports `PlacementIndicator` (lines 10-15), props (17-47), `RING_FACTORS` (49-54), drag and keyboard handlers (106-179), canvas rings and indicators (182-242), and the floating properties panel (245-315).
- `src/components/workspace/PackageCanvas.svelte`: derives placement options, indicators, default preference, preview and commit handlers, and selected peripheral (99-187). The outer radius is `Math.max(40, Math.min(stageWidth, stageHeight) * 0.36)` (155-157).
- `src/state/workspace.svelte.ts`: `setPlacement`, `previewPlacement`, `commitPlacement`, `cancelPlacementPreview`, `setPlacementOverlayRotation`, `setPlacementOverlayVisible` (397-462).
- `src/state/workspace-preferences.svelte.ts`: localStorage-only view preferences, including `summaryTab` and `dockTab`.
- `src/core/types.ts`: `PLACEMENT_RINGS` and `PLACEMENT_RING_RANK` (324-333), `PinPlacementPreference` (339-343), `SUMMARY_TABS` (294-303), `DOCK_TABS` (272-281).
- `src/core/placement.ts`: preference parsing, normalization, geometry, and ordering; `src/core/overlay-position.ts`: pure DOM-measure/pure-arithmetic split; `src/core/vendor-view.ts`: `partitionPeripherals`.
- `src/core/solver.ts`: placement term in scoring (365-366) and `reallocatePeripheralPlacement` / `reallocatePlacementOrdered` (1034-1149).
- `src/core/url-state.ts` (165-176, 286-308) and `src/core/exporters/json.ts` (141-152, 274-292): version-2 persistence of placement.
- Canvas furniture that constrains the rings: `PackageCanvas.svelte` placement toggle (556-572), remap banner (574-589), view HUD (591-630), legend (632-658), hint (660-667), and `src/pages/WorkspacePage.svelte` panel, import, and board buttons (430-470).
- Constraints: pure `src/core/` with no Svelte or DOM imports, strict TypeScript, no new dependency, no hardcoded colors outside `src/themes/daisyui.css`, no UI preferences in share URLs or project JSON, stable STM32 behavior.

## Goals / Non-Goals

**Goals:**

- Give placement properties a single home in the right-hand detail surface, present in both landscape and the portrait dock.
- Keep the overlay mode switch, rings, indicators, drag, keyboard angle adjustment, and display rotation on the canvas.
- Show bubble controls only for configured peripherals and keep scarcity-only allocation as the disabled fallback.
- Use `high`, `medium`, `low` as persisted ring values while accepting legacy values without losing preferences.
- Size the outer ring to the largest radius that clears measured canvas furniture, centred on the stage.

**Non-Goals:**

- Changing ring priority semantics, angular/radial scoring, or locked-pin preservation beyond renaming values.
- Adding a placement toggle to the sidebar or moving ring interaction off the canvas.
- Adding dependencies, a backend, or generated-data changes.
- Making transient overlays (tooltip, popover, context menu) constrain the ring radius.
- Changing STM32 pin assignment output or any other vendor's generated data.

## Decisions

1. **Toggle stays on the canvas; properties move to the sidebar.** The toggle is a canvas mode switch that controls overlay visibility and belongs next to the canvas it affects; it is not per-peripheral configuration. The per-peripheral bubble list is configuration data, which the workspace already edits in the right-hand drawer. A floating canvas panel duplicates that surface and is absent from the portrait dock. Moving the toggle into the sidebar was considered and rejected: it would detach the mode switch from the canvas and place a non-shareable UI control beside shareable pin configuration. Only the markup at `PlacementOverlay.svelte:245-315` moves; rings, drag, keyboard, and rotation remain at 182-242 and 106-179.

2. **One panel component, one instance per layout.** A new `src/components/workspace/PlacementPanel.svelte` holds the compact properties markup and calls `workspaceStore` directly, as `SummaryDrawer` already does for GPIO settings. `SummaryDrawer.svelte` hosts it behind the new `placement` tab in landscape; the portrait dock uses the same `SummaryDrawer` instance through its bound `activeTab`, so no second panel is mounted.

3. **Ring indicator type moves to the core.** `PlacementIndicator` moves from `PlacementOverlay.svelte` to `src/core/placement.ts` as a plain interface. `PackageCanvas.svelte` keeps deriving indicators, claimed pins, selection, and the preview/commit handlers; the overlay component keeps only canvas drawing and pointer/keyboard interaction.

4. **Pure helpers in `src/core/placement.ts`.** Add: configured-peripheral derivation by reusing `partitionPeripherals` from `src/core/vendor-view.ts`; ring label and value normalization including the legacy-name shim; and safe-radius geometry following the DOM-measure/pure-arithmetic pattern of `src/core/overlay-position.ts`. Components measure rectangles and pass plain numbers; the helper performs the arithmetic and is unit-testable on the host.

5. **Ring rename with a decode shim.** `PLACEMENT_RINGS` becomes `high`, `medium`, `low` and `PLACEMENT_RING_RANK` maps them to 0, 1, 2. `parsePinPlacementPreference` normalizes legacy `inner`, `middle`, `outer` to the new names before validation; `canonicalPinPlacementPreference` emits only new names. Both `url-state.ts` and `exporters/json.ts` already route decode and parse through these helpers, so no persistence format version bump is needed. The default bubble preference uses ring `low`.

6. **Safe radius is computed from reserved rectangles.** The view HUD, remap banner, bottom-centre placement toggle, legend, hint, and `WorkspacePage` canvas buttons are measured and passed as rectangles. The helper returns the largest finite radius centred on the stage centre that does not intersect any rectangle, with a floored fallback for missing or degenerate measurements. Transient overlays are excluded from the input.

7. **Selection stays a UI preference.** The selected bubble or expanded row in the panel is stored only in `src/state/workspace-preferences.svelte.ts` localStorage state; it is not added to `WorkspaceState`, share URLs, or project JSON.

8. **Tab registration is shared.** Add `placement` to `SUMMARY_TABS` and `DOCK_TABS` with label `Place`, extend `DOCK_TAB_LABELS`, add the `data-dock-tab='placement'` selector in `src/app.css`, make the `SummaryDrawer` tab strip horizontally scrollable, and include the new value in `workspace-preferences` validation, default, and persistence.

## Risks / Trade-offs

- **Legacy ring values could be silently dropped.** Mitigation: normalize in `parsePinPlacementPreference`, which both codecs already call, and add host tests that decode legacy share URLs and project files and assert the normalized ring with angle and enabled flag preserved.
- **MODIFIED delta requirements must retain every original scenario name.** Mitigation: keep full original requirement blocks and only edit their text; validate with `openspec validate --strict` before implementation.
- **Measured rectangles change with zoom, resize, and orientation.** Mitigation: re-measure on layout changes, keep the arithmetic pure with a finite floor fallback, and never let a transient overlay shrink the ring.
- **More tabs narrow the drawer tab strip.** Mitigation: keep the strip horizontally scrollable inside the drawer and dock without widening the document, consistent with the viewport-locked layout.
- **Configured-only list could orphan a preference on an unconfigured peripheral.** Mitigation: the bubble controls only operate on configured peripherals; any stored preference remains valid and keeps applying, and disabling produces the documented scarcity-only fallback.
- **Strict typing and pure-core rules could be violated by the new helpers.** Mitigation: no DOM or Svelte imports in `src/core/`, and run `npm run check`, `npm test`, and the production build after each implementation group.

## Migration Plan

Existing version-2 state is accepted unchanged: placement fields are additive and the schema version stays at 2. Old ring values are normalized on decode or parse and new writes use `high`, `medium`, `low`. Absent or unknown Place tab values fall back to the current tab defaults. No generated data or catalog artifacts change. Rollback is a revert of this change; the old codec still understands the legacy names, and any newly written names are additive fields that older builds can ignore without affecting pin assignments.

## Open Questions

None. The user decisions recorded in the proposal are authoritative for the panel location, toggle location, configured-only list, ring rename, and safe-radius rule.

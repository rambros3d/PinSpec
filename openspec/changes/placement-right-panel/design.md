# Design

## Context

The current workspace mounts `PlacementPanel.svelte` inside the detail column
of `CombinedSidebar.svelte`, behind a Detail/Place switcher stored in
`viewPreferences.sidebarSection`. `SummaryDrawer.svelte` owns the right-hand tab
strip and renders only Pin Table, Diagnostics, DMA, PIO, GPIO, and Audit.
`WorkspacePage.svelte` renders the portrait dock from `DOCK_TABS` and binds the
drawer to `viewPreferences.summaryTab`. `PackageCanvas.svelte` derives
placement indicators and settings, mounts `PlacementOverlay`, owns the canvas
toggle, and calls `workspaceStore.setPlacementOverlayVisible`,
`previewPlacement`, and `commitPlacement`. Bubble state lives in
`WorkspaceState.placement`; overlay visibility currently also lives in that
shareable state and is written to share URLs, project JSON, and history.
Peripheral detail, tree rows, and portrait layout behavior are covered by
static source-contract tests. See `proposal.md` for motivation and the delta
specs for the behavior contract.

Constraints: no new runtime dependency, `src/core/` stays pure TypeScript, no
handwritten chip data, daisyUI theme tokens only, zero emojis, and STM32
behavior and generated output must remain stable.

## Goals / Non-Goals

**Goals:**

- One placement control surface in the right drawer and portrait dock.
- Tab activation as the primary way to show the placement overlay.
- Configured-only bubble list with one toggle per row.
- Angle and ring changed only by canvas drag, through the existing preview and
  commit path.
- Correct persistence category for every new or moved field.

**Non-Goals:**

- Changing allocation scoring, remap discovery, solver invariants, or exporters.
- Changing generated catalog data, source acquisition, or release gates.
- Adding keyboard numeric entry, a ring dropdown, or a floating canvas panel.
- Adding a version-1 import path or changing the version-2 schema number.

## Decisions

1. **Host placement in the right drawer, not the left sidebar.**
   Extend the bindable `SummaryTab` and the `SUMMARY_TABS` constant with
   `placement`, render a Placement tab in `SummaryDrawer.svelte`, and mount the
   simplified placement list there. Remove `SIDEBAR_SECTIONS`, the switcher
   markup, and the `PlacementPanel` import from `CombinedSidebar.svelte`, so the
   detail column always shows peripheral detail. The portrait dock gains the
   same tab through `DOCK_TABS` and the existing `selectDockTab` handoff, so a
   single panel instance serves both orientations.
   Alternative considered: keep the sidebar switcher and add a duplicate drawer
   tab. Rejected because it duplicates state and leaves the controls away from
   the pin table they affect.

2. **Selecting the tab activates the overlay; visibility is a local UI
   preference.** Selecting Placement from the drawer or dock sets placement
   overlay visibility to true. The value moves out of shareable
   `WorkspaceState` into `viewPreferences` in
   `workspace-preferences.svelte.ts`, persisted under the existing namespaced
   localStorage key. The canvas top-left toggle continues to call the same
   visibility setter and remains the only explicit ON/OFF control; switching
   away from the tab does not hide the overlay.
   Alternative considered: keep visibility in shareable state and set it on tab
   selection. Rejected by the persistence rule in `AGENTS.md`: presentation
   state does not belong in share URLs or project JSON.

3. **Configured-only list with one toggle per row.** Reuse
   `configuredPeripheralNames` from `src/core/placement.ts` with solver status,
   selected modes, and assignments to build the list. Each row uses the existing
   `workspaceStore.setPlacement(name, preference | null)` call: enabling writes
   `{ angle: 0, ring: 'low', enabled: true }`, disabling removes the preference.
   No numeric angle input, ring selector, claimed-pin text, or rotate control is
   rendered in the panel.
   Alternative considered: preserve the existing selector and property inputs
   in the drawer. Rejected because the user decision makes canvas drag the only
   angle and ring control surface.

4. **Keep the existing reallocation path unchanged.** Canvas drag continues to
   feed `previewPlacement` and `commitPlacement`, which call
   `applyPlacementChange` and then `reallocatePeripheralPlacement` or
   `reallocateMatrixPlacement`. Locked-pin preservation, one-hop legality, and
   the single undo entry on pointer-up are inherited without solver edits.
   Alternative considered: reimplement allocation in the panel. Rejected
   because it would duplicate the core engine and risk STM32 regressions.

5. **Persist bubble settings only as pin configuration.** `WorkspaceState.placement`
   stays in undo/redo history, localStorage sessions, share URLs, and project
   JSON with no schema bump. `placementOverlayVisible` is removed from
   `types.ts`, `history.ts` cloning and equality, `url-state.ts` (the `w` flag),
   and `exporters/json.ts`; decoding tolerates the old `w` flag by ignoring it.
   Drawer and dock tab selection and overlay visibility stay in the localStorage
   view-preferences record; `sidebarSection` is removed from that record because
   no sidebar sections remain.
   Alternative considered: leave dead fields in the codecs. Rejected because a
   field with two sources of truth would reappear on shared links.

6. **Theme and code constraints.** New tab and list markup uses existing
   daisyUI tokens and `lucide-svelte` icons only. No raw color literal, no emoji,
   no new dependency, and no Svelte or DOM import under `src/core/`.

## Test Contract Mapping

| Contract | Verification |
|---|---|
| Right-drawer Placement tab, no left Place section | `peripheral-detail-panel.test.ts` (source tokens), `viewport-layout.test.ts` |
| Tab opens overlay; canvas toggle remains | `pin-placement-affinity.test.ts` (store and canvas source contracts) |
| Configured-only rows with toggles, no angle or ring controls | `pin-placement-affinity.test.ts`, `workspace-qol.test.ts` |
| Drag preview and commit keep locks and legality | existing allocation and preview/commit tests in `pin-placement-affinity.test.ts` |
| Persistence split | `pin-placement-affinity.test.ts` (codec output), `view-preferences.test.ts` |
| Portrait dock parity and persisted tab | `viewport-layout.test.ts`, `core-io.test.ts` tab normalization |
| Theme tokens, no raw colors | `theme-tokens.test.ts`, `ui-multi-vendor.test.ts` |
| Full verification | `npm test`, `npm run check`, `BASE_PATH="/pincraft/" npm run build` |

Static source-contract tests that assert `sidebarSection`, the Detail/Place
switcher, or `doc.placementOverlayVisible` must be updated deliberately rather
than deleted wholesale; allocation, history, and matrix tests remain unchanged.

## Risks / Trade-offs

- [Source-contract tests assert old markup] Update each named test to the new
  control location and persistence boundary; keep behavioral assertions intact.
- [Existing share links carry the old overlay flag] Decoders ignore unknown
  fields, so such links still load their pin configuration and fall back to the
  local overlay preference.
- [Two tab preferences can drift] `summaryTab` and `dockTab` remain separate
  localStorage values, as before; selecting Placement in either writes only the
  active one, matching the existing layout behavior.
- [Concurrent workspace UI changes] Re-read the named source files before
  editing because another change may have shifted structure; keep edits scoped
  to placement controls and tab registration.
- [In-flight implementation state] This planning change assumes the
  authoritative decisions in the task brief. If source has already moved part
  of this behavior, keep the spec contract and avoid duplicate implementations.

## Migration Plan

No chip data or generated artifact changes. Remove the section-switcher markup
and preference, register the new tab constants, move the overlay flag to local
view preferences, update the codecs and tests, then run the full verification
sequence. Rollback is a git revert of the implementation commit; no stored data
migration is required because the removed fields are optional and legacy values
are ignored.

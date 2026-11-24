# Design

## Context

See `proposal.md` for motivation. The current implementation is:

- `src/components/workspace/PeripheralTree.svelte`: compact rows with
  `inlineModeLabel` (68-71), `statusColor` (42-53), grouping (102-127), and an
  empty state (96-100).
- `src/components/workspace/PeripheralDetail.svelte`: all mode, signal, and
  remap editing controls; selected through `viewPreferences.selectedPeripheral`.
- `src/components/workspace/SummaryDrawer.svelte:195-205,434-446`: mounts the
  Configuration tab and `PeripheralDetail`; other tabs are Pins, Diagnostics,
  DMA, PIO, GPIO, and Audit.
- `src/pages/WorkspacePage.svelte:49,125-144`: `leftWidth` 280, `rightWidth`
  330, resize state; 76-85 selection wiring opens Configuration; 554-573 the
  portrait dock strip.
- `src/app.css:101-115,171-223`: landscape grid areas and portrait dock rules,
  including `[data-dock-tab='configuration']` visibility selectors.
- `src/state/workspace-preferences.svelte.ts`: localStorage-only view state
  with `selectedPeripheral`, `filterText`, category expansion, `summaryTab`,
  and `dockTab`.
- `src/core/types.ts`: `DOCK_TABS`, `SUMMARY_TABS`, `PLACEMENT_RINGS`, and
  `PLACEMENT_RING_RANK` (inner/middle/outer).
- `src/core/placement.ts`: preference parsing, normalization, geometry, and
  ordering; `src/core/vendor-view.ts`: `partitionPeripherals`;
  `src/core/overlay-position.ts`: DOM-measure/pure-arithmetic split;
  `src/core/solver.ts`: placement scoring and reallocation;
  `src/core/url-state.ts` and `src/core/exporters/json.ts`: version-2
  persistence.

Width math at 1024px: a 384-504px left pane leaves about 250px of canvas next
to a 330px right pane. The user accepts forcing the minimum combined width at
narrow landscape widths instead of auto-collapsing tree or detail.

Constraints: `src/core/` stays pure TypeScript with no Svelte or DOM imports,
strict TypeScript, no new dependency, no raw color literals outside the
vendored theme, all runtime fetches through `import.meta.env.BASE_URL`, no
generated output committed, and no STM32 behavior regression.

## Goals / Non-Goals

**Goals:**

- Keep peripheral navigation, detail editing, and placement properties in one
  adjacent left-pane surface in landscape and in the portrait dock.
- Move `PeripheralDetail` out of the right drawer and remove the Configuration
  tab from both tab strips.
- Make tree rows scannable with a single status-and-mode circle and complete
  accessible state.
- List only configured peripherals in the Place section and keep bubble
  movement on the existing preview and commit path.
- Persist rings as high, medium, and low while accepting legacy names.
- Keep overlay interaction and the ON/OFF toggle on the canvas, and size the
  outer ring from measured canvas furniture.
- Keep UI view state in localStorage and pin configuration in version-2 URL
  and JSON state.

**Non-Goals:**

- Changing ring priority semantics, angular/radial scoring, locked-pin
  preservation, or the placement schema version.
- Moving rings, indicators, drag, keyboard adjustment, or rotation off the
  canvas.
- Removing the RP PIO panel, adding dependencies, a backend, or generated data
  changes.
- Changing STM32 assignment output or any vendor's catalog data.
- Making transient overlays constrain the ring radius.

## Decisions

1. **Adjacent sidebar with a forced minimum width.** A combined sidebar
   component hosts a narrow tree column and a detail column in the left pane.
   The tree defaults to 160px and clamps to 120-240px; the detail column keeps a
   260-320px minimum. The left resizer changes the combined width while the
   tree clamp and detail minimum bound the internal split. At narrow landscape
   widths the combined minimum wins and the canvas shrinks. Alternative
   considered: auto-collapse the tree or detail column; rejected because it
   hides the controls this change is meant to keep adjacent. The canvas already
   supports pan and zoom, so a narrower canvas remains usable.

2. **One circle per tree row.** Replace the inline mode label and the trailing
   status dot with one circle: hue carries solver status (neutral, success,
   warning, error) and fill carries mode presence (filled for selected,
   hollow for disabled or absent). Exact status and mode text move to `title`
   and `aria-label`. Selection is expressed only as a row highlight, and no
   placement marker is added. Alternative considered: keep the inline mode
   label; rejected because it crowds a 160px column and duplicates the detail
   column.

3. **Detail and Place share the sidebar detail column.** The detail column
   exposes a compact section switcher with Detail (`PeripheralDetail`) and
   Place (placement properties). The active section is a new
   `sidebarSection` localStorage preference defaulting to Detail. The right
   drawer keeps Pins, Diagnostics, DMA, PIO, GPIO, and Audit; the dock keeps
   Peripherals, Pins, Diagnostics, DMA, PIO, and Audit. Selecting a tree row
   activates Detail. Alternative considered: a third sidebar column for Place;
   rejected because it would exceed the width budget and shrink the canvas
   further.

4. **Portrait reuses the same combined sidebar side by side.** The Peripherals
   dock tab mounts the combined sidebar with tree and detail columns beside
   each other; they are never stacked. The dock CSS gives the dock area two
   columns with independent internal scrolling, keeps the 43dvh dock height,
   and removes the old `configuration` visibility selectors. The other dock
   tabs continue to drive the same right drawer instance. No second tree or
   detail instance is mounted.

5. **Placement properties come from the configured partition.** The Place
   section derives its list with `partitionPeripherals` so only peripherals
   with an assignment or a non-disabled mode appear. Each row has a bubble
   enable or disable control, numeric angle input, and claimed-pin display.
   Movement between rings calls the existing preview and commit methods so
   assignments update live and release produces one undo entry. Before the
   canvas toggle is enabled the section shows guidance instead of controls.
   The floating panel markup is removed from `PlacementOverlay.svelte`.

6. **Ring rename with a decode shim.** `PLACEMENT_RINGS` becomes `high`,
   `medium`, `low` and `PLACEMENT_RING_RANK` maps them to 0, 1, 2.
   `parsePinPlacementPreference` maps legacy `inner`, `middle`, `outer` before
   validation, and `canonicalPinPlacementPreference` emits only new names.
   Both codecs already call these helpers, so no version bump is needed. UI
   labels use High, Medium, and Low. The default bubble uses `low`. Solver
   ranks change only through the renamed constants.

7. **Safe radius is computed from reserved rectangles.** Components measure
   the view HUD, remap banner, bottom-centre toggle, legend, hint, and
   workspace canvas buttons as plain rectangles. A pure helper in
   `src/core/placement.ts` returns the largest finite radius centred on the
   stage that clears them, with a finite fallback for degenerate input.
   Measurement repeats on resize, zoom, and orientation changes. Transient
   overlays are excluded. This follows the pattern in `overlay-position.ts`.

8. **Persistence categories stay separate.** Pin configuration, including
   placement preferences and rotation, continues to round-trip through version-2
   share URLs and project JSON. Selection, filter text, category expansion,
   sidebar section, summary tab, and dock tab stay in localStorage. No new
   view preference is added to shareable state.

9. **Tests are updated in place, not bypassed.** Static token tests are the
   contract for component structure. Update them deliberately for the new
   layout, ring names, circle encoding, relocated tokens, tab sets, and pure
   helper, then run the full verification sequence.

## Risks / Trade-offs

- [Narrow landscape leaves little canvas] -> force the documented minimum
  combined width as requested; rely on existing pan and zoom.
- [Legacy ring names silently dropped] -> normalize in the shared parser used
  by both codecs and assert with host tests for legacy URL and JSON input.
- [Portrait dock too short for side-by-side columns] -> keep tree and detail
  scrolling independently inside the dock and preserve the detail minimum
  width.
- [Removing Configuration breaks existing wiring] -> tree selection activates
  the sidebar Detail section, and the dock Peripherals tab exposes it in
  portrait; update the static tests that assert the old tab.
- [Measured rectangles change with zoom and resize] -> re-measure on layout
  changes and keep a finite arithmetic fallback.
- [Core purity violations] -> pass plain numbers to the helper, never import
  Svelte or DOM APIs in `src/core/`, and run `npm run check`.
- [PIO panel regression] -> retain PIO in the drawer and dock tab sets because
  the multi-vendor workspace spec requires it.

## Migration Plan

The schema stays at version 2. Placement fields remain additive, and legacy
ring names are normalized on decode or parse. A persisted dock tab value of
`configuration` is unknown under the new dock set and falls back to
`peripherals`; pin configuration is unaffected. An absent `sidebarSection`
value defaults to Detail. No generated catalog data changes. Rollback is a
revert of this change; old builds ignore the new localStorage section field.

## Open Questions

None. The user decisions recorded in the proposal are authoritative for layout,
row encoding, tab removal, portrait behavior, the Place section, ring names,
safe radius, and persistence categories.

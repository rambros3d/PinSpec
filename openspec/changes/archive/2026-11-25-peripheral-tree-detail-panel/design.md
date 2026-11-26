# Design

## Context

See `proposal.md` for motivation and
`specs/peripheral-tree-detail-panel/spec.md` plus the
`specs/viewport-locked-workspace/spec.md` delta for the behavior contract.

The affected code is Svelte 5 runes components in `src/components/workspace/`
and `src/pages/`, runes stores in `src/state/`, pure helpers in `src/core/`, and
one global stylesheet `src/app.css`. Current constraints that shape this change:

- `src/core/` is pure TypeScript with no Svelte or DOM imports. Host-side Vitest
  cases must import core helpers directly.
- `tests/viewport-layout.test.ts` requires exactly one mount each of
  `PeripheralTree`, `PackageCanvas`, and `SummaryDrawer`, one
  `data-dock-tab=` binding, the named workspace cells, exactly one
  `@media (orientation: portrait)` block, exactly two `grid-template-areas`
  declarations, `43dvh`, and `min-h-0` plus `overflow-y-auto` in the tree and
  drawer sources.
- `tests/theme-tokens.test.ts` confines raw colors to
  `src/themes/daisyui.css`, enforces 28 declared tokens, and rejects emoji in
  delivered source. `tests/workspace-qol.test.ts` forbids a specific
  `font-mono-tabular text-[11px] text-base-content/40` string in
  `PeripheralTree.svelte`.
- `AGENTS.md` requires pin configuration to be shareable and UI preferences to
  be `localStorage`-only. The current `WorkspaceState.dockTab` field, the URL
  `d` field, the project JSON `dockTab` key, history comparison, and recent
  sessions all violate that rule and are corrected here.
- No new npm dependency is permitted. Existing daisyUI classes and
  `lucide-svelte` icons cover the new surface.

## Goals / Non-Goals

**Goals:**

- Separate tree navigation from peripheral editing with one detail surface that
  works in both orientations.
- Reduce tree row height so more peripherals are visible without scrolling.
- Keep configured work discoverable and the "Other" bucket out of the way.
- Move all view preferences to `localStorage` without changing shared pin
  configuration.
- Move static test contracts to the components that own the behavior.

**Non-Goals:**

- Changing solver rules, diagnostics, AF/remap/FUNCSEL data, data adapters,
  generated shards, routing, or exporter output.
- Adding a second layout path, a split left pane, a floating detail panel, a
  new theme token, a new npm dependency, or a DOM test environment.
- Changing the version-2 state schema number or breaking older version-2
  share links and project files.

## Decisions

### Right drawer over a split left pane or a floating panel

Reuse the right `SummaryDrawer` by adding a `configuration` entry to its
`SummaryDrawerTab` union, tab bar, and render blocks. Render a new
`PeripheralDetail.svelte` in that tab and pass it the selected peripheral name
plus the existing callbacks from `WorkspacePage.svelte`.

Rationale: the right pane already owns detail and diagnostic surfaces (pin
table, diagnostics, DMA, PIO, GPIO, audit), so the detail surface belongs with
those tabs. The viewport contract requires one tree, one canvas, and one drawer
in both orientations, and the dock reuses those same instances for portrait.
Splitting the left pane would require a second detail component with duplicated
selection state and would break the single-mount and grid-area contracts. A
floating panel would conflict with the viewport-lock and overlay-clamping
requirements.

`WorkspacePage.svelte` holds the single wiring path: a tree row click sets the
selected peripheral in the preferences store, sets the summary tab to
`configuration`, and, in portrait, sets the dock tab to `configuration` so the
detail becomes visible. Landscape changes only the right drawer tab.

### Detail component owns the editing controls

Move the mode selector, coupled remap selector with `registerNote` and
`summarizeRemapSignals`, tag pills via `PinTagPills`, and per-signal toggles with
assigned pin badges and locate-pin buttons out of the expanded tree body and
into `PeripheralDetail.svelte`. Pass the same `onModeChange`, `onRemapChange`,
`onToggleSignal`, and `onFocusPin` callbacks through `SummaryDrawer` so commits,
history, and diagnostics stay identical. Show a short prompt when no peripheral
is selected instead of an empty detail body.

Rationale: pin configuration behavior is unchanged; only its host surface
moves. Keeping one callback path avoids a second source of truth.

Rejected: leaving the controls in the tree and mirroring them in the drawer,
which would duplicate event wiring and reintroduce tall rows.

### Compact rows, configured-first order, and empty state

Render each tree row as name, status dot, and inline mode label. Remove the
peripheral expansion toggle and its inline detail body. Keep the filter input
and the category accordion. Within each category, sort configured names before
unconfigured names. Rename the `other` category label to "Other peripherals"
with its count and keep it collapsed by default. When no peripheral is
configured, render a short line above the categories explaining that selecting
a peripheral opens its configuration; never render an empty pane.

Rationale: the fresh workspace starts with every peripheral unconfigured, so a
status-only view would otherwise look empty while the configured work is
buried below 21 to 30 unconfigured rows.

Rejected: removing the "Other" category entirely or promoting every peripheral
to one flat list. Both lose the existing category browsing contract.

### Pure configured/unconfigured partition

Add a DOM-free helper to `src/core/vendor-view.ts` that takes
`peripheralStatus` and `peripheralModes` and returns configured and
unconfigured name lists. A name is configured when its status is `active`,
`partial`, or `error`, or when its mode is present and not `disabled`;
everything else, including status `none`, is unconfigured. The tree consumes
the result for sorting and the empty-state condition. Add Vitest cases covering
STM32G431CBU6, STM32F103C8T6, CH32V203C8T6, RP2040, and RP2350B using generated
chip data.

Rationale: ordering and the empty state are deterministic functions of
workspace data and must stay unit-testable on the host.

Rejected: deriving order inside the Svelte component with ad hoc conditionals,
which would be untestable without a DOM and drift across vendors.

### localStorage-only view preferences

Add one typed preferences helper under `src/state/` that reads and writes a
namespaced `localStorage` key guarded by availability checks and schema
validation. It owns selected peripheral, filter text, category expansion, the
active summary tab, and the active dock tab; `normalizeDockTab` in
`src/core/types.ts` stays as the validator for the stored dock value and gains
`configuration` through `DOCK_TABS`.

Remove `dockTab` from `WorkspaceState`, `cloneWorkspaceState`,
`statesEqual`, `createWorkspaceHistory`, the URL codec `d` field, the project
JSON exporter and parser, and recent-session state. `setDockTab` and the
`dockTab` getter move to the preferences helper or the page-level store surface
that reads it; selecting a dock tab no longer creates a history entry. Parsers
ignore legacy dock values without rejecting the rest of the state. The state
version remains 2.

Rationale: `AGENTS.md` classifies dock tab, selection, filters, and expansion as
presentation state that must never appear in share URLs or project files.
Decoding older links that still carry `d` or `dockTab` must remain tolerant so
pin configuration is preserved.

Rejected: keeping dock tab in workspace state but omitting it only from export
surfaces; that would still let a UI preference affect history comparisons and
would leave two persistence paths for the same value.

### Portrait Configuration dock tab

Add `configuration` to `DOCK_TABS`, to `DOCK_TAB_LABELS`, and to the summary
tab union. Add `[data-dock-tab='configuration']` to the existing
`.workspace-summary` selector group in `src/app.css` so the shared drawer shows
the detail surface. Do not add a media query, a grid-area declaration, or a
second tab strip. Keep `min-h-11`, `role="tablist"`, `role="tab"`,
`aria-selected`, and the single `data-dock-tab` binding.

Rationale: the Configuration tab must be reachable in portrait through the one
dock, and the static layout contract limits changes inside the existing CSS
blocks.

### Test contract moves

Update affected tests in the group that owns each behavior:

- `tests/ui-multi-vendor.test.ts`: retarget the remap source assertions
  (`pInfo.remaps && pInfo.remaps.length > 1`, `registerNote`,
  `summarizeRemapSignals`, `onRemapChange`, `PinTagPills`) from
  `PeripheralTree.svelte` to `PeripheralDetail.svelte`. Retarget
  `kinds: ['pwm', 'pio']` to the shared pure category table that the tree and
  detail both import, so no detail contract is asserted against the tree. Keep
  the `summarizeRemapSignals` and generated-chip assertions.
- `tests/viewport-layout.test.ts`: keep the single-mount and grid assertions;
  add the Configuration label and `[data-dock-tab='configuration']` selector;
  rewrite the dock-tab persistence group to assert localStorage survival,
  absence from URL and project JSON, defaulting, and unchanged pin state.
- `tests/hardware-audit.test.ts`: remove `dockTab` from the expected project
  JSON key list and from workspace-state, history, URL, and JSON assertions;
  keep `audit` in `DOCK_TABS` and move its dock-selection check to
  localStorage.
- `tests/workspace-qol.test.ts`: retarget or remove the retired
  `text-base-content/40` string now that the tree no longer owns that markup,
  and add Configuration to the dock label assertions.
- `tests/theme-tokens.test.ts`: no rule change; new files must keep the token
  audit, raw-color confinement, and emoji exclusion green.
- New core helper tests cover the five required chips and DOM-free import.

Rationale: each test group should assert the file that owns the behavior,
so the suite continues to catch regressions at the right boundary.

## Risks / Trade-offs

- [Static contract drift] -> Keep the exact strings asserted by the viewport,
  QoL, theme, hardware-audit, and multi-vendor tests; run `npm test` after each
  task group rather than only at the end.
- [Legacy dock values in saved data] -> Decode and ignore `d` and `dockTab`
  instead of rejecting state, and pin the default to Peripherals in scenarios.
- [Lost pin configuration during persistence refactor] -> Keep all
  pin-configuration fields in the URL and JSON round-trip tests unchanged and
  add explicit assertions that no view-preference key is serialized.
- [Portrait detail not visible] -> Set both the summary tab and the dock tab
  when a tree row is selected, and cover the Configuration dock selector in
  the viewport tests.
- [Detail controls regress] -> Move the existing callbacks unchanged and keep
  the remap, tag-pill, and signal-toggle assertions in the detail test group.
- [Theme or emoji audit failure] -> Use only existing theme tokens and
  daisyUI classes, with no raw color literal outside `src/themes/daisyui.css`
  and no emoji in any delivered source or artifact.
- [Concurrent file edits] -> Keep edits scoped to the files named here and
  re-run the full suite before closeout.

## Migration Plan

This is a static client-only change with no data migration step. The state
version remains 2. Older share links and project files that carry a dock value
continue to load because parsers ignore unknown UI-preference fields. Apply the
edits in the task order, run `npm test`, `npm run check`, and
`BASE_PATH="/pinspec/" npm run build`, then run
`openspec validate peripheral-tree-detail-panel --strict` and archive the
change. Rollback is a normal revert of the implementation commit; no stored
pin configuration needs conversion.

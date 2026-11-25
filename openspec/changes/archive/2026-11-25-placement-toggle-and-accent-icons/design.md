# Design

## Context

See `proposal.md` for motivation. Current code state:

- `PackageCanvas.svelte` derives `placementSettings` as an object wrapping
  `viewPreferences.placementOverlayVisible` and the shareable placement
  preferences from `normalizePlacement(workspaceStore.state)`. The mount guard
  near line 594 reads `placementSettings.overlayVisible`. The top-left toggle
  near lines 618-631 calls `workspaceStore.setPlacementOverlayVisible(next)`.
- `workspace.svelte.ts` writes `viewPreferences.placementOverlayVisible` in
  `setPlacementOverlayVisible`. That store is a localStorage-backed runes class
  in `workspace-preferences.svelte.ts` and is presentation state only.
- `PlacementOverlay.svelte` draws the rings with
  `fill-none stroke-current text-info opacity-40` and their labels with
  `fill-current text-info text-[10px]`. Indicators are drawn only for
  explicitly opted-in peripherals.
- `WorkspacePage.svelte` owns a local `$state` `summaryTab` initialized from
  `viewPreferences.summaryTab`, binds it to `SummaryDrawer.activeTab`, and
  syncs it one-way to the view-preference store in an effect. The dock tab is
  written through `workspaceStore.setDockTab`. `rightCollapsed` is local view
  state.
- `GlobalSidebar.svelte` colors each whole link or button with
  `sectionClass()`, which applies `text-base-content/70` and, for the active
  route, `text-info`. Icons inherit that color and are hard to see in the
  3rem rail.

Root cause of the reported "clicking shows nothing": the reactive path is
intact, so the click does flip the overlay flag, but on a fresh workspace the
only drawn feedback is three 40%-opacity informational rings with no
indicators, which is visually easy to miss. At the same time the toggle touches
no tab state, so no Placement panel appears to confirm the action or to let the
user enable a bubble. The two gaps together read as a dead control.

## Goals / Non-Goals

**Goals:**

- Make the canvas toggle produce unmistakable visible feedback and open the
  Placement panel in the same action, in both orientations.
- Make collapsed sidebar icons legible with the `accent` token while leaving
  labels and active-route highlighting unchanged.
- Keep the single overlay ON/OFF control, the one-mount shell contracts, and
  the existing persistence split intact.

**Non-Goals:**

- No new shareable field, project-file field, URL codec change, or schema
  version bump.
- No change to placement geometry, scoring, solver, exporters, or generated
  catalog data.
- No new runtime dependency, no raw color literal outside the vendored theme
  file, and no emoji.
- No new sidebar entry, second Placement panel, or second global top bar.

## Decisions

**D1: Couple the toggle through a page-owned callback.**
`PackageCanvas.svelte` keeps reading `viewPreferences.placementOverlayVisible`
and keeps calling `workspaceStore.setPlacementOverlayVisible(next)` for the
overlay flag. It gains an optional `onPlacementToggle` prop. `WorkspacePage.svelte`
supplies the handler: when the toggle turns on, it sets its local `summaryTab`
to `placement`, calls `workspaceStore.setDockTab('placement')` for portrait,
and sets `rightCollapsed = false` so the drawer is actually visible; when the
toggle turns off, it changes no tab and no bubble preference. The existing
effect continues to persist `summaryTab` to localStorage.

Alternative considered: write `viewPreferences.summaryTab` directly from the
canvas. Rejected because the page's local `$state` copy would not observe that
write and its sync effect could write the old value back, so the panel would
not open reliably. A new "reveal request" preference field was also rejected:
it would add state, normalization, and a persistence category for no benefit.

**D2: Keep the info hue but remove the faint ring opacity.**
`PlacementOverlay.svelte` keeps the semantic `text-info` hue for rings and
labels, but replaces `opacity-40` with a clearly visible opacity so the rings
register at default zoom. Ring geometry, spacing, centre, rotation, and
pointer-event passthrough stay unchanged.

Alternative considered: recolor rings to `accent`. Rejected because `info`
already denotes placement and remap emphasis, and `accent` is reserved here
for navigation icons.

**D3: Color icons only, at the icon component.**
Add `text-accent` to each section icon component in `GlobalSidebar.svelte`,
including the Hotkeys and expand/collapse icons. For the active section the
icon keeps `text-info`. Do not add `text-accent` to the parent link or button:
labels keep the inherited `sectionClass()` foreground. Solar bold duotone
icons accept `class` and paint through `currentColor`, and the duotone
secondary layer remains derived from `--color-base-content` in `app.css`.

Alternative considered: setting `text-accent` on the whole link. Rejected
because it would recolor labels and flatten the active-route `info` signal.

**D4: Declare persistence explicitly.**
Only existing localStorage-only UI fields are used: `placementOverlayVisible`,
`summaryTab`, `dockTab`, and local `rightCollapsed`. No pin-configuration field
is added or changed. Bubble preferences and overlay rotation remain shareable
workspace data and are untouched. This satisfies the project rule that every
new state field declare a category: this change adds none.

**D5: Update static contracts deliberately.**
Update `tests/pin-placement-affinity.test.ts`, `tests/workspace-qol.test.ts`,
`tests/global-app-shell.test.ts`, `tests/theme-tokens.test.ts`, and
`tests/viewport-layout.test.ts` to assert the callback coupling, the removed
faint ring class, and the icon-only accent classes. Keep unrelated assertions
that already hold: core purity, no new shareable fields, one mount, URL and
project-file field absence, and the single icon package.

## Risks / Trade-offs

- [Toggle-off undone by tab effect] -> The handler changes no tab when turning
  off, so the previous-tab effect does not re-enable the overlay. Cover with a
  static test on the handler's branch conditions.
- [Solar class passthrough] -> Verify the installed icon component forwards
  `class` to its `svg`; assert `text-accent` on icon markup and that no raw
  color appears.
- [More prominent rings add visual noise] -> Raise opacity only, keep stroke
  geometry and non-interactive pointer behavior unchanged, and leave reserved
  furniture clearance untouched.
- [Orientation divergence] -> The handler writes both `summaryTab` and
  `dockTab`, so the same panel is reachable in landscape and portrait without
  mounting a second instance.
- [Brittle static tests] -> Preserve assertions that remain valid and narrow
  only the clauses that describe the superseded behavior.

## Migration Plan

No data migration is required because no persisted schema changes. After all
tasks and verification pass, the implementation agent runs
`openspec archive placement-toggle-and-accent-icons -y` and includes the
synced specs and archived change files in the implementation commit. No
rollback beyond reverting the change is needed.

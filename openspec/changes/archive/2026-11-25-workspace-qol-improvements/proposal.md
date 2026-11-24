# Proposal: Workspace QoL Improvements

## Why

A review of the landing and workspace surfaces found several small gaps that
affect everyday use: a failed catalog fetch is presented as an empty result
list, the pin table shows the same empty state for an unassigned board and a
filtered board, the toast can cover the portrait dock, copy and download
actions fail silently, native dialogs open without a focused control, and
keyboard focus is difficult to see. These are independent of solver, data, and
export behavior, and can be addressed without new settings or dependencies.

## What Changes

- Render a catalog load failure in the quick-search dropdown as an error row
  with the failure message and a retry action, instead of an empty result set.
  Add a store retry path that clears the cached failed load.
- Split the pin table empty state into "no assignments" and "no matches for the
  current filter; clear filter". Expose the active sort column and direction on
  sortable table headers with `aria-sort`.
- Give the workspace toast a dedicated `.workspace-toast` class, move it above
  the portrait dock with `bottom: calc(43dvh + 0.75rem)` in portrait, and add a
  dismiss button. Keep the existing toast tones and timeout behavior.
- Surface clipboard and download failures through `workspaceStore.showToast()`
  on both the landing export preview and the workspace export dialog. Defer
  `URL.revokeObjectURL()` until after the download has started.
- Focus a control when the export dialog opens and restore focus to the
  invoking control when any of the six native dialogs closes. Verify the same
  focus behavior across all six dialogs.
- Make the workspace `Ctrl+F` shortcut select the existing search text as the
  landing `Ctrl+K` behavior does, and keep it covered by a regression check.
  Existing undo/redo input guards are unchanged.
- Add a visible global `:focus-visible` ring based on existing theme tokens,
  extend reduced-motion handling beyond `.animate-pin-pulse`, and raise small
  body copy from `text-base-content/40` to `text-base-content/60` while leaving
  decorative icon tint unchanged.
- Handle `Escape` in the placement overlay by ending an active drag and
  returning focus to a visible control. Add a focus-visible ring to the
  keyboard-operable SVG indicator group without changing its arrow-key angle
  controls.
- Increase portrait dock tab touch targets to `min-h-11` and add tablist, tab,
  and selection semantics without adding a second layout path or new state.
- Add a scroll affordance to the horizontally scrollable toolbar that keeps the
  existing `overflow-x-auto` behavior and the existing static-check strings.
- Show a first-time hint in the landing presets area when no recent sessions
  exist, derived from existing persisted sessions rather than a new setting.
- Add a `?` shortcut-help dialog listing the existing keyboard shortcuts, using
  the same native-dialog focus and dismissal behavior.
- Explicitly out of scope: keyboard pin navigation, a touch remap gesture, and
  any change to solver, data adapters, generated shards, exporters' output,
  routing, or persisted workspace state. These canvas interactions are deferred
  to a dedicated canvas interaction change.

No new npm dependency, no new persisted setting, no new raw color literal
outside `src/themes/daisyui.css`, and no emoji are introduced.

## Capabilities

### New Capabilities

- `workspace-qol`: Error and empty states, action-failure feedback, dialog and
  keyboard focus handling, visible focus and reduced-motion treatment, toast
  placement, and touch and scroll affordances across the landing and workspace
  surfaces.

### Modified Capabilities

None. The existing viewport, theme, multi-vendor workspace, and export
capabilities keep their current requirements. This change adds behavior around
those surfaces without changing solver, data, or export contracts.

## Impact

Affected code: `src/components/landing/QuickSearchBar.svelte`,
`src/components/landing/PresetGrid.svelte`, `src/pages/LandingPage.svelte`,
`src/pages/WorkspacePage.svelte`, `src/components/workspace/SummaryDrawer.svelte`,
`src/components/workspace/TopToolbar.svelte`,
`src/components/workspace/ExportModal.svelte`,
`src/components/workspace/PlacementOverlay.svelte`, the other four workspace
native dialogs, `src/state/catalog.svelte.ts`, `src/app.css`, and `tests/`.

Existing static contracts in `tests/viewport-layout.test.ts`,
`tests/ui-multi-vendor.test.ts`, `tests/theme-tokens.test.ts`, and
`tests/hardware-audit.test.ts` are preserved, including the single portrait
media query, `43dvh` dock height, toolbar `overflow-x-auto`, vendor export
labels and function names, token confinement, and emoji exclusion. Required
verification is `npm test`, `npm run check`, and
`BASE_PATH="/pincraft/" npm run build` with zero warnings.

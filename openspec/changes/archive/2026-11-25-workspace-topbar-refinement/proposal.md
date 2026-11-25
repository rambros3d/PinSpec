# Proposal

## Why

On workspace and shared routes the global top bar repeats the chip id at the left
edge even though the MCU switcher pill already shows it. The editable project
name sits in the action cluster, and the pin/signal find input consumes the
center of the bar and pushes the action buttons away from the right edge. This
change assigns each control a single, consistent position without changing pin
configuration, persistence, or keyboard behavior.

## What Changes

- On workspace and shared routes, replace the chip-id `routeTitle` at the left
  edge with the project name from `workspaceStore.state.projectName`, falling
  back to `Unnamed project` or the chip id. Keep the chip-id MCU switcher pill in
  the workspace action cluster so switching MCUs remains available.
- Move the existing editable project-name pill from the action cluster to the
  left-edge title position. Click enters edit mode, Enter or blur commits through
  `workspaceStore.renameProject()`, and Escape cancels. Edit mode stays transient
  view state.
- Remove the pin/signal find input from the global top bar and render it in the
  package canvas HUD. Ctrl+F still focuses the moved input and selects its
  query, and matching pins remain highlighted by the same workspace search
  behavior.
- Add an auto margin before Undo so the workspace actions rendered in the bar
  end at the right edge through the Theme control. Theme joins this group on
  workspace and shared routes and keeps its current position on all other
  routes.
- Keep the single global bar, hash routing, `dataUrl()` fetches,
  localStorage-only UI preferences, version-2 pin configuration and project-name
  persistence, native dialog focus contracts, and vendor-filtered MCU switcher
  unchanged.
- Update the static shell, viewport, workspace QOL, multi-vendor UI, theme-token,
  and project-naming tests to assert the new placement while preserving
  persistence and dialog contracts. Add no dependency, no raw color literal, and
  no generated-data change.

## Capabilities

### New Capabilities

- `workspace-topbar-refinement`: Placement and interaction contract for the
  workspace and shared left-edge project title, the retained MCU switcher pill,
  the editable title, the canvas HUD find input, and the right-aligned action
  cluster.

### Modified Capabilities

- `global-top-bar`: The workspace and shared left-edge title becomes the
  editable project name instead of the chip id; the find input leaves the bar;
  the bar actions including Theme right-align; the chip pill and all
  non-workspace routes stay unchanged.
- `workspace-qol`: Ctrl+F still focuses the find input and selects its query, but
  the input now lives in the package canvas HUD. The keyboard and dialog
  contracts remain unchanged.
- `multi-vendor-workspace`: The vendor-filtered MCU switcher chip pill remains in
  the workspace action cluster after the top-bar refinement.

## Impact

- Components: `src/components/shell/GlobalTopBar.svelte` for the title, chip
  pill, and action cluster; `src/components/workspace/PackageCanvas.svelte` for
  the HUD find input and its focus callback.
- State: `src/state/top-bar-ui.svelte.ts` comment only, because `focusSearch`
  registration moves to the canvas. `src/state/workspace.svelte.ts` is reused
  unchanged for `projectName`, `renameProject()`, `globalSearch`, and
  `searchMatchingPins`.
- Tests: `tests/global-app-shell.test.ts`, `tests/viewport-layout.test.ts`,
  `tests/workspace-qol.test.ts`, `tests/ui-multi-vendor.test.ts`,
  `tests/theme-tokens.test.ts`, and `tests/project-naming.test.ts` receive
  deliberate placement assertions and keep their persistence and dialog checks.
- No new route, dependency, backend, share or project schema version, data
  generator change, or STM32 behavior change.

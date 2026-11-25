# Proposal: Workspace button fixes

## Why

Runtime inspection of the built workspace showed that every control rendered as
a DOM child of the package canvas is inert. The canvas starts a pan gesture and
calls `setPointerCapture()` on the stage for every primary pointer-down that is
not on a pin. Pointer capture retargets the matching pointer-up and click to the
stage, so the click handler on the originally pressed button never runs. This
affects the placement toggle, the placement ring rotation control, the zoom HUD,
Fit, Rotate, the find-input clear control, the remap banner cancel control, and
every action in the pin popover and pin context menu. The summary-drawer
collapse control is also unreachable because the canvas find HUD occupies the
same `top-14 right-3` position and paints later.

Three adjacent workspace chrome issues are included: generated project names
currently append the MCU family suffix although the vocabulary already supplies
two words, the workspace top-bar title lacks the app icon, and the sidebar
repeats the app brand in a dedicated header block above navigation.

## What Changes

- Scope canvas pan pointer capture to the stage background and the transformed
  SVG package surface only. Pins, HUD cards, popovers, context menus, the
  placement overlay, and the remap banner keep their own click behavior.
- Move the summary-drawer collapse control out of the find HUD's position and
  the remap banner below both HUD rows so both controls are clickable in
  landscape layouts.
- Generate project names from two curated vocabulary words only. The generator
  stops reading the chip family or id, while normalization keeps the existing
  character and length bounds. Saved names, share links, and project files are
  not rewritten.
- Render the RadioKit app icon from `import.meta.env.BASE_URL` before the
  editable project-name control on workspace and shared routes. Non-workspace
  routes keep their existing wordmark and layout.
- Remove the sidebar's separate logo and PinCraft header block so the section
  navigation begins at the top of the panel.

## Capabilities

### New Capabilities

- `workspace-control-interaction`: Canvas overlay controls reach their actions
  without being retargeted by pan gesture capture, and the summary drawer
  toggle is reachable in landscape layouts.

### Modified Capabilities

- `project-naming`: Generated names consist of exactly two curated words and
  existing saved names are reused unchanged.
- `global-top-bar`: Workspace and shared routes show the app icon before the
  editable project name.
- `global-app-shell`: The sidebar no longer renders a separate brand header.

## Impact

Affected code: `src/components/workspace/PackageCanvas.svelte`,
`src/pages/WorkspacePage.svelte`, `src/components/shell/GlobalTopBar.svelte`,
`src/components/shell/GlobalSidebar.svelte`, `src/core/project-name.ts`,
`README.md`, and static tests under `tests/`. No generated data, solver,
exporter, routing, theme token, or persistence schema change is made. No new
dependency, raw color literal, or emoji is introduced. Verification is
`npm test`, `npm run check`, and
`BASE_PATH="/pincraft/" npm run build` with zero warnings, followed by strict
OpenSpec validation and archive.

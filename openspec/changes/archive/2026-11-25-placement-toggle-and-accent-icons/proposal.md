# Proposal

## Why

The canvas Placement toggle updates the overlay flag but gives no usable feedback on a fresh workspace: the only drawn result is three low-opacity informational rings, and no Placement controls become visible. Users read the control as non-functional. The collapsed sidebar icons inherit a muted foreground and are hard to distinguish in the 3rem rail.

## What Changes

- Make the canvas Placement toggle produce visible feedback: the priority rings and labels are legible when the overlay is shown, and showing the overlay also activates the right-drawer Placement tab (or the portrait dock Placement tab).
- Keep the toggle as the single explicit ON/OFF control; turning it off hides the rings and does not change bubble preferences.
- Reuse the existing localStorage-only fields (`placementOverlayVisible`, `summaryTab`, `dockTab`) for the coupled action; add no shareable or project-file field and no new state category.
- Apply the daisyUI `accent` token to sidebar navigation icons only. Labels keep their current foreground treatment; icons on the active route may keep `info` highlighting.
- Update the static contract tests that describe the old toggle and icon behavior.
- No new runtime dependency, no raw color literals outside the vendored theme file, no emoji, strict TypeScript, and no changes to core, solver, exporters, or generated catalog data.

## Capabilities

### New Capabilities

- `placement-toggle-and-accent-icons`: Reliable, discoverable placement toggle feedback with panel activation and accent-colored sidebar navigation icons.

### Modified Capabilities

- `pin-placement-affinity`: The canvas toggle now activates the Placement tab and must produce visible ring feedback; the toggle remains the only explicit ON/OFF control.
- `placement-right-panel`: The canvas toggle, like the tab, activates the Placement surface; the old "toggle does not change the active tab" statement no longer holds.
- `global-app-shell`: Sidebar icons use the `accent` token while labels keep their inherited foreground treatment.
- `theme-token-integration`: Sidebar icons become a real `accent` token consumer; duotone secondary layers still derive from theme tokens.

## Impact

- `src/components/workspace/PackageCanvas.svelte`: toggle callback and overlay readability.
- `src/components/workspace/PlacementOverlay.svelte`: ring and label contrast.
- `src/pages/WorkspacePage.svelte`: reveal handler for the Placement tab, portrait dock, and a collapsed right drawer.
- `src/components/shell/GlobalSidebar.svelte`: icon-only color classes.
- Static tests in `tests/pin-placement-affinity.test.ts`, `tests/workspace-qol.test.ts`, `tests/global-app-shell.test.ts`, `tests/theme-tokens.test.ts`, and `tests/viewport-layout.test.ts` are updated deliberately.
- No change to `src/core/`, persistence schemas, generated data, or the single global shell mount.

# Tasks

## 1. Placement toggle feedback and panel activation

- [ ] 1.1 Add an optional `onPlacementToggle` prop to `PackageCanvas.svelte` and call it from the existing top-left toggle handler, keeping `setPlacementOverlayVisible(next)` and the `viewPreferences.placementOverlayVisible` read intact; verify `tests/pin-placement-affinity.test.ts` passes with an added assertion that the toggle invokes the callback.
- [ ] 1.2 Add the page-owned handler in `WorkspacePage.svelte` that, when the toggle turns on, sets `summaryTab` to `placement`, calls `workspaceStore.setDockTab('placement')`, and clears `rightCollapsed`, while the off branch changes no tab and no bubble preference; verify `tests/pin-placement-affinity.test.ts` and `tests/viewport-layout.test.ts` pass with assertions covering both branches.
- [ ] 1.3 Replace the faint `opacity-40` on the placement rings in `PlacementOverlay.svelte` with a legible opacity, keep `text-info` and the labels readable, and preserve `pointer-events-none` passthrough; verify `tests/pin-placement-affinity.test.ts` and `tests/workspace-qol.test.ts` pass with updated ring-class assertions.
- [ ] 1.4 Update the static placement contracts in `tests/pin-placement-affinity.test.ts` and `tests/workspace-qol.test.ts` for the callback coupling and ring classes, keeping the one-ON-OFF-control, one-mount, no-shareable-field, and pointer-passthrough assertions; verify both test files pass.
- [ ] 1.5 Smoke-check the coupled behavior in the running app: toggling on from a hidden overlay draws visible rings and opens the Placement panel in landscape and in the portrait dock, and toggling off hides rings without changing the tab or any bubble; verify the persistence assertions still show no tab or overlay field in share URLs or project JSON.

## 2. Accent-colored sidebar icons

- [ ] 2.1 Add `text-accent` only to the section icon components in `GlobalSidebar.svelte`, including the Hotkeys and expand or collapse icons, keep `text-info` for the active section icon, and do not apply the accent class to the parent link or button; verify `tests/global-app-shell.test.ts` passes with assertions that icon markup carries the accent class and section labels keep their inherited foreground.
- [ ] 2.2 Confirm the duotone secondary layer still derives from `--color-base-content` in `src/app.css` and that icon markup uses no literal color; verify `tests/theme-tokens.test.ts` passes with an added accent-icon consumer assertion.
- [ ] 2.3 Update the icon and theme-token static contracts in `tests/global-app-shell.test.ts` and `tests/theme-tokens.test.ts` for the accent classes while preserving the single bold duotone package, no-raw-color, no-emoji, and route-label assertions; verify both test files pass.

## 3. Integration verification

- [ ] 3.1 Run `npm test` and verify the full Vitest suite passes with no failures.
- [ ] 3.2 Run `npm run check` and verify strict TypeScript reports no errors.
- [ ] 3.3 Run `BASE_PATH="/pincraft/" npm run build` and verify a clean production build with zero Svelte warnings and subpath-relative asset resolution.
- [ ] 3.4 Confirm the change scope introduces no `src/core/` edits, no share URL or project JSON schema change, and no new dependency; verify the diff contains only the workspace components, the sidebar component, and the named test files.

## Workflow follow-up

- After all tasks and verification pass, the implementation agent runs `openspec archive placement-toggle-and-accent-icons -y` and includes the synced specs and archived change files in the implementation commit.
- Verify the archive moved the change into `openspec/changes/archive/` and that `openspec/specs/` contains the updated capability specs before committing.
- Commit and push only after the archive step, following the commit format in `AGENTS.md`.

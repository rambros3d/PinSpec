# Tasks

## 1. Global bar title and right-aligned action cluster

- [x] 1.1 In `src/components/shell/GlobalTopBar.svelte`, replace the workspace and shared `routeTitle` chip-id span with the project-name title from `workspaceStore.state.projectName` and an `Unnamed project` fallback, with a chip-id secondary fallback inside the same title control. Verify: the bar source no longer renders `workspaceStore.chip?.id` through `routeTitle`, the title control reads `workspaceStore.state.projectName`, and the chip-id switcher button with `title="Switch MCU"` remains between the title and Undo.
- [x] 1.2 Move the inline edit behavior into the left-edge title slot, keeping `beginNameEdit()`, `commitName()`, `cancelNameEdit()`, `renameProject()`, `aria-label="Project name"`, `aria-label="Rename project"`, `onblur={commitName}`, Enter commit, and Escape cancel with `e.stopPropagation()`. Verify: source inspection shows all named hooks and no new persisted editing field; `workspaceStore.state.projectName` remains the only name source.
- [x] 1.3 Add an auto margin before Undo so the actions rendered in the bar end at the right edge, and move `ThemePicker` into that group for workspace and shared routes while leaving the non-workspace Theme and Hotkeys group unchanged. Verify: the action group starts at Undo and ends with Theme on workspace routes, no Rotate button is introduced into the bar, and the non-workspace branch still renders `topBarUI.shortcutHelpOpen = true` with the wordmark and section links.
- [x] 1.4 Update `tests/global-app-shell.test.ts` and `tests/viewport-layout.test.ts` for the left-edge title, retained chip pill, action order, and Theme placement, preserving the single-bar, wordmark, section-link, h-12, and overflow assertions. Verify: `npm test -- tests/global-app-shell.test.ts tests/viewport-layout.test.ts` exits zero.
- [x] 1.5 Update `tests/project-naming.test.ts` so rename history, share URL, project JSON, and recent-session assertions stay intact while the title control placement changes. Verify: `npm test -- tests/project-naming.test.ts` exits zero and the committed name still reaches version-2 payloads.
- [x] 1.6 Update `tests/theme-tokens.test.ts` if its bar assertions reference the old placement. Verify: `npm test -- tests/theme-tokens.test.ts` exits zero and a scan of touched sources finds no raw color literal outside `src/themes/daisyui.css`.

## 2. Find input in the package canvas HUD

- [x] 2.1 Remove the pin and signal find input and its `searchInputRef` focus registration from `GlobalTopBar.svelte`, and update the `focusSearch` documentation in `src/state/top-bar-ui.svelte.ts` to name the canvas as owner. Verify: the bar source contains no `globalSearch` binding, no `searchInputRef`, and no `topBarUI.focusSearch` assignment, while `src/state/top-bar-ui.svelte.ts` still declares the callback and keeps its transient-state contract.
- [x] 2.2 Add the find input to the `PackageCanvas.svelte` HUD using daisyUI input classes, the `Find pin or signal` label, a `data-placement-furniture` marker, `workspaceStore.globalSearch`, a clear control, and an `onMount` registration of `topBarUI.focusSearch` that focuses and selects the query and clears on unmount. Verify: canvas source contains `topBarUI.focusSearch = () =>`, `searchInputRef?.select()`, `aria-label="Find pin or signal"`, `workspaceStore.globalSearch`, and `data-placement-furniture`, and query-based highlights still come from `workspaceStore.searchMatchingPins`.
- [x] 2.3 Update `tests/workspace-qol.test.ts` so the Ctrl+F handler assertion stays in `WorkspacePage.svelte` while the focus-and-select assertion moves to the canvas, and update `tests/ui-multi-vendor.test.ts` so the retained chip pill is asserted after the left-edge title. Verify: `npm test -- tests/workspace-qol.test.ts tests/ui-multi-vendor.test.ts` exits zero and the native dialog focus assertions remain unchanged.

## 3. Integration verification

- [x] 3.1 Run the full unit suite. Verify: `npm test` exits zero with no failures.
- [x] 3.2 Run the strict type check. Verify: `npm run check` exits zero with no diagnostics.
- [x] 3.3 Run the production subpath build. Verify: `BASE_PATH="/pincraft/" npm run build` exits zero with no warnings and no root-absolute `/data/` or `/assets/` request in the built output.
- [x] 3.4 Audit scope boundaries across changed files. Verify: no new dependency, no new route, no change to `src/core/`, no schema version change, no generated-data change, no raw color literal, no emoji or non-ASCII character, and no STM32 behavior regression.
- [x] 3.5 Re-run strict change validation. Verify: `openspec validate workspace-topbar-refinement --strict` exits zero.

## Workflow follow-up

- After all tasks pass and all verification is green, run `openspec archive workspace-topbar-refinement -y` and include the archived spec files in the implementation commit.
- Commit and push only after the archive succeeds. Report validation, test, build, and archive output as evidence.

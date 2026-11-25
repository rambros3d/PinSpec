# Tasks

## 1. Persist discovery filters in browser-local storage

- [x] 1.1 Add `src/state/discovery-preferences.svelte.ts` with key `pincraft:discovery_preferences_v1`, independent `catalog` and `quickSearch` groups, default query/family/package strings and `all` vendor, normalization of malformed values, and guarded localStorage reads and writes; verify with a new `tests/discovery-preferences.test.ts` that checks defaults, reload restoration, storage failure tolerance, and that no filter field appears in `encodeWorkspaceState()` or `exportPinoutJson()` output.
- [x] 1.2 Bind the four `CatalogPage.svelte` filters to the `catalog` preference group and make its reset action clear the same group; verify that `tests/global-app-shell.test.ts` and `tests/ui-multi-vendor.test.ts` still pass with added assertions for the four persisted field names and that the existing catalog filter and thumbnail assertions remain intact.
- [x] 1.3 Bind the four `QuickSearchBar.svelte` filters to the `quickSearch` preference group and keep its reset action local to that group; verify that `tests/start-screen.test.ts` and `tests/ui-multi-vendor.test.ts` pass with added persistence assertions and that all existing test-locked quick-search strings are unchanged.
- [x] 1.4 Update the README shell paragraph to state that catalog and quick-search discovery filters are localStorage-only preferences and are absent from share URLs and project files; verify the paragraph contains the storage key and no shareable-field claim.

## 2. Add the sidebar Workspace entry

- [x] 2.1 Add a Workspace entry to `GlobalSidebar.svelte` in the top navigation group immediately after Home, resolving its target from `workspaceStore.chip?.id` and then `workspaceStore.recentSessions[0]?.mcuId` and navigating through `router.navigateMcu()`; verify with `tests/global-app-shell.test.ts` that chip and recent-session targets are asserted and that the existing section-entry assertions still pass.
- [x] 2.2 Render the entry as a visibly disabled control with no navigation when neither target exists; verify with `tests/global-app-shell.test.ts` that a disabled-state assertion is present and with `tests/viewport-layout.test.ts` that the collapsed 3rem rail, expanded overlay classes, and single sidebar mount assertions still pass.
- [x] 2.3 Update the README sidebar description to include Workspace and its target resolution; verify the documented entry order matches the rendered top group.

## 3. Apply the daisyUI 5 audit corrections

- [x] 3.1 Replace `tabs-boxed` with `tabs-box` in `AboutPage.svelte`, move the `ProvenancePanel.svelte` error onto `alert alert-soft alert-error`, and add a `loading loading-spinner loading-xs` indicator to its pending message; verify with `tests/global-app-shell.test.ts` and `tests/theme-tokens.test.ts` that the new classes are asserted, no `tabs-boxed` remains, and the existing About strings and retry control still pass.
- [x] 3.2 Move the `form.modal-backdrop` in `ShortcutHelpDialog.svelte` so it is a direct child of `<dialog class="modal">` outside `.modal-box`, keeping focus and dismissal handlers; verify with `tests/workspace-qol.test.ts` that a structural sibling assertion is added and that the existing focus, Escape, cancel, and help-reference assertions still pass.
- [x] 3.3 Replace the hand-rolled workspace spinner in `WorkspacePage.svelte` with `loading loading-spinner loading-lg text-info` and split `SummaryDrawer.svelte` DMA rows into separate `card` and `alert` branches; verify with `tests/workspace-qol.test.ts` and `tests/theme-tokens.test.ts` that both branches and the spinner classes are asserted and that no row carries both component families.
- [x] 3.4 Move the error surfaces in `LandingPage.svelte`, `QuickSearchBar.svelte`, and `CatalogPage.svelte` onto `alert alert-soft alert-error` and add `loading loading-spinner loading-xs` to the six pending messages named in the proposal; verify with `tests/workspace-qol.test.ts`, `tests/start-screen.test.ts`, and `tests/theme-tokens.test.ts` that every original message string and retry control is preserved and that no raw color or emoji is introduced.

## 4. Verify the change end to end

- [x] 4.1 Run `npm test` and confirm the full Vitest suite passes with no skipped or failing test, including the new discovery preference tests and the deliberately updated static UI tests; report the command output as evidence.
- [x] 4.2 Run `npm run check` and confirm strict TypeScript and Svelte checking exits zero with no warning; report the command output as evidence.
- [x] 4.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm the production subpath build exits zero with no warning, no root-absolute data or asset path, and no new raw color literal; run `openspec validate shell-polish-and-persisted-discovery --strict` and confirm it reports the change valid.

## Workflow follow-up

- After all tracked tasks pass, run `openspec archive shell-polish-and-persisted-discovery -y` so the delta specs sync into `openspec/specs/` and the change moves to `openspec/changes/archive/`.
- Include the archived spec files in the implementation commit and report validation, test, check, build, and archive output as evidence.
- Commit and push only after archive.

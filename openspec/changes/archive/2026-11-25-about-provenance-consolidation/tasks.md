# Tasks

## 1. Consolidated About catalog sources surface

- [x] 1.1 Remove the separate Catalog summary card from `src/pages/AboutPage.svelte` and move the indexed total and family count into the merged table header. Verify that `tests/global-app-shell.test.ts` asserts the header totals and no summary card.
- [x] 1.2 Replace the per-vendor and upstream-source cards in `src/components/about/ProvenancePanel.svelte` with one grouped Catalog sources table: vendor rows carry chip count, match and coverage ratios, and sync time; nested source rows carry id, SHA, license, and external link from `PROVENANCE_SOURCES` and `catalogStore.meta`. Verify that `tests/docs-attribution.test.ts` still finds all thirteen source ids and licenses and now checks the grouped table instead of the two card headings.
- [x] 1.3 Move the loading, unavailable, and retry states into the merged surface so failures stay retryable without the removed cards. Verify that `tests/global-app-shell.test.ts` and `tests/docs-attribution.test.ts` assert `catalogStore.indexError`, retry, and pending text on the merged surface.

## 2. Shortcut removal and tab preference

- [x] 2.1 Reduce `ABOUT_TABS` in `src/state/shell-preferences.svelte.ts` to the `sources` tab while keeping `DEFAULT_ABOUT_TAB`, `normalizeAboutTab`, and the `pincraft:shell_preferences_v1` key unchanged. Verify that `tests/shell-preferences.test.ts` passes unchanged, including the fallback from a stale `shortcuts` value.
- [x] 2.2 Remove the `SHORTCUTS` import, the Shortcuts tab, and both inline shortcut blocks from the About surface. Verify that `tests/start-screen.test.ts` keeps the shared `SHORTCUTS` and landing-rail assertions while asserting no shortcut text on About, and that `tests/global-app-shell.test.ts` asserts no Shortcuts tab.
- [x] 2.3 Update `README.md` so the `#/about` route describes the grouped catalog sources table and the shortcut reference is owned by the shared dialog and landing rail, not About. Verify that `tests/docs-attribution.test.ts` passes with the updated document metadata and attribution checks.

## 3. Hotkeys entry and shared shortcut dialog

- [x] 3.1 Add a Hotkeys button to `src/components/shell/GlobalSidebar.svelte` immediately above the About entry, reachable in both collapsed and expanded states, with no hash target and a monochrome `lucide-svelte` icon. Verify that `tests/global-app-shell.test.ts` asserts the entry, its position above About, and unchanged route helpers.
- [x] 3.2 Use a component-local transient flag in the sidebar to mount `ShortcutHelpDialog` with `onClose`, and declare in a doc comment that the flag is UI/view state that is never persisted or shared. Verify that `tests/workspace-state.test.ts` and `tests/core-io.test.ts` pass unchanged and that share URL and version-2 project output contain no dialog-open field.
- [x] 3.3 Change `src/components/workspace/ShortcutHelpDialog.svelte` to render `SHORTCUTS` from `src/data/provenance.ts` and delete its local shortcut array while preserving native dialog markup, focus restoration, Escape cancellation, and backdrop close. Verify that `tests/workspace-qol.test.ts` asserts the shared import, the absence of a local array, and the existing focus and close contracts.
- [x] 3.4 Extend the token scan in `tests/theme-tokens.test.ts` to cover the changed sidebar and dialog sources. Verify that no raw color literal appears outside the vendored theme file and no emoji character appears in any changed source.

## 4. Coordination and integration verification

- [x] 4.1 Confirm that no file under `openspec/changes/global-top-bar/` was edited by this change and record the integration seam: its shortcuts control must open the shared dialog because the About Shortcuts tab is removed, and the merged sidebar requirement must retain its rail, toggle, label, and ordering behavior. Verify with `git status --short` that only owned files are modified.
- [x] 4.2 Run `npm test` and resolve every failure or warning. Verify the command exits zero with the full suite green, including unchanged data-gen, gate, pin-configuration, and subpath contracts.
- [x] 4.3 Run `npm run check` and resolve every type or Svelte diagnostic. Verify the command exits zero with no output warnings.
- [x] 4.4 Run `BASE_PATH="/pincraft/" npm run build` and confirm the built app resolves assets under `/pincraft/` with no root-absolute data or asset paths. Verify the command exits zero with no build warnings.

## Workflow follow-up

- After all tracked tasks pass, the implementation agent must run `openspec archive about-provenance-consolidation -y`.
- Include the archived spec, proposal, design, and tasks files in the implementation commit and report validation, test, type-check, build, and archive output as evidence.

# Tasks

## 1. Shared persisted-preference helper

- [x] 1.1 Add `src/state/persisted-preference.svelte.ts` with safe raw/record read and write primitives and `createPersistedPreference(key, defaultValue, normalize, field?)` returning a runes-backed `{ value, set }`; add a dedicated Vitest test for normalization, no-op writes, namespaced records, reload, and throwing storage; verify `npm test` passes
- [x] 1.2 Refactor `shell-preferences.svelte.ts` onto the helper, keeping `SHELL_PREFERENCES_STORAGE_KEY`, `ShellPreferencesStore`, its getter/setter, defaults, and the exact `{ sidebarExpanded }` JSON shape; verify the shell-preferences suite passes
- [x] 1.3 Refactor `workspace-preferences.svelte.ts` onto the helper, keeping all six fields, `DEFAULT_CATEGORY_EXPANSION`, `isCategoryOpen`, `setCategoryOpen`, and the exact six-key JSON shape; update preference tests deliberately only where they describe boilerplate, and verify the view-preferences suite passes
- [x] 1.4 Refactor `discovery-preferences.svelte.ts` onto the helper, keeping both independent groups, their getters/setters, `reset()`, `snapshot()` consumers, normalizers, and the exact two-group JSON shape; verify the discovery-preferences suite passes
- [x] 1.5 Refactor `theme.svelte.ts` onto the helper for the raw string mode, keeping `THEME_MODES`, `normalizeThemeMode`, `resolveThemeId`, `cycle()`, DOM application, and the no-FOUC bootstrap contract; verify the theme suite and `npm run check` pass

## 2. Pure pin-view helpers

- [x] 2.1 Add pure `src/core/pin-view.ts` with `isPowerPin`, `basePinStatus`, `pinStatusTokens`, `PERIPHERAL_STATUS_VIEW`, and exported token types; add Vitest tests asserting exact CSS-variable tokens, precedence, baseline status mapping, and power detection; verify `npm test` and `npm run check` pass
- [x] 2.2 Refactor `PerimeterPackage.svelte` and `GridPackage.svelte` to call `pinStatusTokens`, preserving every SVG attribute, geometry calculation, badge, and stroke-width condition; verify package render and rotation suites pass
- [x] 2.3 Refactor `PinoutDiffModal.svelte` to call `basePinStatus`; refactor `PeripheralTree.svelte` and `PeripheralDetail.svelte` to call `PERIPHERAL_STATUS_VIEW`; update static status tests deliberately and verify diff, peripheral, and multi-vendor suites pass

## 3. Dialog wrapper and central owner

- [x] 3.1 Add `src/components/shell/Dialog.svelte` wrapping native `<dialog class="modal">` with `modal-box`, direct `modal-backdrop` form, opener capture via `openDialogWithFocus`, exported `close()`, cancel/backdrop handlers, and `ariaLabel`, `boxClass`, `onClose`, `focusTarget`, and children props; add a contract test for its source shape; verify `npm run check` passes
- [x] 3.2 Refactor the six workspace dialogs and the landing ambiguous-import dialog onto `Dialog.svelte`, preserving aria labels, sizing strings, focus targets, close-before-action order, and content; update static dialog tests to wrapper/contract assertions; verify the workspace and start-screen suites pass
- [x] 3.3 Add typed `activeDialog` to `top-bar-ui.svelte.ts` backing the existing boolean flags as accessors; mount `PinoutDiffModal` and `ShortcutHelpDialog` once in `AppShell`; route the landing Compare action through the shared owner and remove the duplicate mounts from `LandingPage` and `WorkspacePage`; update ownership tests deliberately and verify one-mount and global-shell suites pass

## 4. Full verification and closeout

- [x] 4.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` with zero warnings; confirm no STM32, generated-data, theme-token, or share-schema regressions and no new dependency
- [x] 4.2 Run `openspec validate shared-ui-abstractions --strict`, then archive with `openspec archive shared-ui-abstractions -y`; run `openspec validate --all --strict`, confirm no active changes remain, and commit code, specs, and archived artifacts without pushing

# Tasks

## 1. Dependency swap and slug verification

- [x] 1.1 Remove `lucide-svelte` from `package.json`, add `@solar-icons/svelte`, run `npm install`, and verify `npm ls @solar-icons/svelte` reports the installed package while `npm ls lucide-svelte` reports no entry and `package-lock.json` contains no `lucide-svelte` record.
- [x] 1.2 Verify every mapped slug from `design.md` exists as a bold duotone export in `node_modules/@solar-icons/svelte/dist/icons/bold-duotone/` and that the `./bold-duotone/*` exports map resolves; verify the list covers all 48 mapped names and that `RefreshCw` is recorded as an unused import to delete.

## 2. Theme-token color rule

- [x] 2.1 Add the `.solar` rule to `src/app.css` that sets `--solar-secondary-color` from `color-mix(in oklab, currentColor 60%, var(--color-base-content))`, leaves `--solar-color` unset so primary layers inherit `currentColor`, and adds no `--depth`, `--noise`, or raw color literal; verify by reading the rule and running `npx vitest run tests/theme-tokens.test.ts`.
- [x] 2.2 Update `tests/theme-tokens.test.ts` with an assertion that the duotone secondary color resolves through a theme token and no color literal appears in icon markup; verify the raw-color, emoji, and token-audit assertions in that file still pass.

## 3. Shell and theme picker icons

- [x] 3.1 Replace imports in `src/components/shell/GlobalSidebar.svelte`, `src/components/shell/GlobalTopBar.svelte`, and `src/components/ThemePicker.svelte` with the verified bold duotone paths using the local aliases from `design.md`; retain dynamic icon selection, section icon typing, `size-*` classes, and all `title`/`aria-label` text; verify `npm run check` passes.
- [x] 3.2 Update `tests/global-app-shell.test.ts`, `tests/package-rotation.test.ts`, `tests/theme-mode-toggle.test.ts`, and `tests/start-screen.test.ts` to assert the Solar import paths and absence of `lucide-svelte` while keeping their focus, route, bar-height, and persisted-preference assertions; verify with `npx vitest run tests/global-app-shell.test.ts tests/package-rotation.test.ts tests/theme-mode-toggle.test.ts tests/start-screen.test.ts`.

## 4. Landing icons

- [x] 4.1 Replace imports in `src/pages/LandingPage.svelte`, `src/components/landing/PresetGrid.svelte`, and `src/components/landing/QuickSearchBar.svelte` with mapped Solar paths, delete the unused `RefreshCw` import, and keep the existing size classes, `text-info` status tints, search focus behavior, and click handlers; verify `npm run check` passes.
- [x] 4.2 Extend `tests/start-screen.test.ts` to assert the landing and search-bar icon imports are Solar bold duotone paths with no lucide import; verify with `npx vitest run tests/start-screen.test.ts`.

## 5. Workspace component icons

- [x] 5.1 Replace imports in `src/components/workspace/ExportModal.svelte`, `McuSwitcherModal.svelte`, `BoardSelectorModal.svelte`, `CompatibleMcuFinder.svelte`, `PinoutDiffModal.svelte`, `ShortcutHelpDialog.svelte`, `PinPopover.svelte`, `PinContextMenu.svelte`, `PioPanel.svelte`, `PeripheralTree.svelte`, `PackageCanvas.svelte`, and `SummaryDrawer.svelte` with mapped Solar paths; preserve pointer-events classes, dialog focus handlers, sort indicators, and canvas control behavior; verify `npm run check` passes and no `lucide-svelte` import remains in `src/components/workspace/`.
- [x] 5.2 Update `tests/workspace-qol.test.ts` and `tests/viewport-layout.test.ts` to assert Solar import provenance, preserved accessible names, and unchanged SVG renderer geometry checks; verify with `npx vitest run tests/workspace-qol.test.ts tests/viewport-layout.test.ts`.
- [x] 5.3 Verify `public/radiokit-logo.svg`, the favicon reference in `index.html`, and the contents and texture tests for `PerimeterPackage.svelte` and `GridPackage.svelte` are unchanged by the icon work.

## 6. Remaining page icons

- [x] 6.1 Replace imports in `src/pages/CatalogPage.svelte`, `src/pages/ProjectsPage.svelte`, and `src/pages/WorkspacePage.svelte` with mapped Solar paths, keeping status icons, file import actions, and panel toggles intact; verify `npm run check` passes.
- [x] 6.2 Update `tests/ui-multi-vendor.test.ts` to assert vendor UI source files use Solar bold duotone imports without changing vendor filter, thumbnail, or mux assertions; verify with `npx vitest run tests/ui-multi-vendor.test.ts`.

## 7. Attribution

- [x] 7.1 Add one factual line to the README attribution section stating that Solar Icons code is MIT licensed and the original icons are CC BY 4.0 by 480 Design, with the package repository URL; verify the line contains no emoji or promotional wording.
- [x] 7.2 Update `tests/docs-attribution.test.ts` to assert that attribution line and re-run all existing provenance and source hygiene assertions; verify with `npx vitest run tests/docs-attribution.test.ts`.

## 8. Integration verification

- [x] 8.1 Scan all 21 affected files and the whole `src/` tree for `lucide-svelte` references and for any `@solar-icons/svelte` import outside the `bold-duotone` style; verify the scan returns no result and that all 49 original glyph names are either mapped or recorded as removed.
- [x] 8.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` and verify all three exit zero with no Svelte warnings, no broken subpath asset requests, and no STM32 behavior or generated catalog change.

## Workflow follow-up

- Run `openspec archive solar-icons-adoption -y` after all tasks and verification checks pass.
- Verify the archived change syncs the five delta specs into `openspec/specs/` and moves the change into `openspec/changes/archive/`, then include the archived files in the implementation commit.

# Tasks

## 1. Catalog rail simplification

- [ ] 1.1 Rewrite the right-rail Catalog card in `src/pages/LandingPage.svelte` so each available `PROVENANCE_VENDORS` row shows only the vendor label and `chipCount`, with `formatSyncDate(catalogStore.meta.generatedAt)` retained and the total count, `ratios.match`, and `ratios.coverage` fragments removed; keep the `alert alert-soft alert-error` error row and `loading loading-spinner loading-xs` pending row. Verify: page source contains no `ratios.match`, `ratios.coverage`, or rail-total line and still contains `formatSyncDate(` and both daisyUI status classes.
- [ ] 1.2 Update `tests/start-screen.test.ts` and `tests/ui-multi-vendor.test.ts` rail assertions to match the compact rows and to reject rail totals and ratios. Verify: `npm test -- tests/start-screen.test.ts tests/ui-multi-vendor.test.ts` passes.
- [ ] 1.3 Update `tests/docs-attribution.test.ts` landing assertions so provenance checks remain while the rail no longer claims ratios or totals. Verify: `npm test -- tests/docs-attribution.test.ts` passes.

## 2. Single discovery-header count

- [ ] 2.1 Keep the parts-indexed and families count and the two status badges only in the discovery header, and confirm the rail has no second total. Verify: source inspection finds one indexed-count expression inside `data-zone="discovery"` and none inside `data-zone="rail"`.
- [ ] 2.2 Update `tests/viewport-layout.test.ts` landing-shell and zone assertions for the compact header and zone framing while keeping the exact `.landing-shell` class string, `href="#presets"`, no `navbar`, and no `min-h-screen`. Verify: `npm test -- tests/viewport-layout.test.ts` passes.

## 3. Full-page hierarchy and spacing pass

- [ ] 3.1 Tighten `start-grid` padding and column gap and reframe the left action column as one compact divided surface while preserving all five action labels, the board-preset button, the inline import file inputs, and the import error surface. Verify: source retains `router.navigateCatalog()`, `revealRecentSessions`, `showBoardSelector = true`, `parsePinoutJson(`, `resolveBoardPreset(`, `buildBoardPresetState(`, and `setPendingHandoff(`, and `npm test -- tests/start-screen.test.ts` passes.
- [ ] 3.2 Reduce spacing and padding in the discovery and rail zones so discovery is primary and the rail is tertiary, without changing `QuickSearchBar.svelte` or `PresetGrid.svelte` internals. Verify: `git diff -- src/components/landing/QuickSearchBar.svelte src/components/landing/PresetGrid.svelte` is empty and `npm test -- tests/ui-multi-vendor.test.ts` passes.
- [ ] 3.3 Apply daisyUI classes and theme tokens only, with no raw color literal, no emoji, and no new dependency, and update `tests/theme-tokens.test.ts` if a landing-specific assertion references removed markup. Verify: `npm test -- tests/theme-tokens.test.ts` passes and a scan of touched sources finds no color literal outside `src/themes/daisyui.css` and no non-ASCII character in changed files.

## 4. Single keyboard shortcut reference

- [ ] 4.1 Remove the Shortcuts card from `src/pages/LandingPage.svelte`, drop the now unused `Keyboard` icon and `SHORTCUTS` imports there, and leave the shared constant in `src/data/provenance.ts` for `ShortcutHelpDialog.svelte`. Verify: landing source contains no `SHORTCUTS`, `Shortcuts`, or shortcut list markup, while `src/components/workspace/ShortcutHelpDialog.svelte` still imports and iterates `SHORTCUTS`.
- [ ] 4.2 Update `tests/workspace-qol.test.ts` and `tests/global-app-shell.test.ts` so the dialog is asserted as the only rendered shortcut reference and the sidebar Hotkeys entry stays immediately above About. Verify: `npm test -- tests/workspace-qol.test.ts tests/global-app-shell.test.ts` passes.

## 5. Integration verification

- [ ] 5.1 Run the full unit suite and type check. Verify: `npm test` and `npm run check` both exit zero with no failures and no diagnostics.
- [ ] 5.2 Run the production subpath build. Verify: `BASE_PATH="/pincraft/" npm run build` exits zero with no warnings and no root-absolute `/data/` or `/assets/` request in the built output.
- [ ] 5.3 Confirm scope boundaries across all touched files. Verify: no new route or dependency, no shareable presentation field in `src/core/types.ts`, no change to generated data, and no STM32 behavior regression.

## Workflow follow-up

- After every task passes, run `openspec archive landing-declutter -y` and report the validation, test, build, and archive output as evidence.
- Include the archived spec files in the implementation commit. Commit and push only after the archive succeeds.

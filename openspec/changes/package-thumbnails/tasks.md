# Tasks

## 1. Pure package geometry helper

- [ ] 1.1 Add `src/core/package-thumbnail.ts` with no Svelte or DOM import. Export a `ThumbnailGeometry` type, `approximateThumbnailGeometry(packageName, pinCount, options?)`, `approximateThumbnailFromIndex(entry)`, `thumbnailGeometryFromChip(chip)`, and `MAX_THUMBNAIL_REFINEMENTS = 40`. Verify that a new `tests/package-thumbnails.test.ts` imports the module in the host Vitest environment and asserts every exported symbol.
- [ ] 1.2 Implement the deterministic approximate rules from index fields only: four equal sides for QFP/QFN/DFN style strings, two vertical sides for SOP/SO/DIP/SSOP/TSSOP style strings, a square grid sized from pin count for BGA/WLCSP/CSP style strings, and a plain rectangle otherwise. Verify with `tests/package-thumbnails.test.ts` that each rule returns finite counts, grid results are marked approximate, and no `NaN` or `undefined` appears.
- [ ] 1.3 Implement exact geometry mapping from `ChipData.package` using `kind`, `sides`, `rows`, `cols`, `pinCount`, and `hasExposedPad`, with fidelity marked exact. Verify with a chip fixture that the mapped counts match the shard and that a source scan finds no hardcoded part identifier or per-chip silhouette table in the helper.

## 2. Non-interactive thumbnail component

- [ ] 2.1 Add `src/components/catalog/PackageThumbnail.svelte` with props for geometry, a 40-48px size (default 44), and an optional label. Emit a stable `package-thumbnail` class, a `data-fidelity` attribute, `pointer-events-none`, and `aria-hidden`. Verify with `tests/package-thumbnails.test.ts` that the source contains no click/pointer/keyboard handler, no `tabindex`, and no focusable child.
- [ ] 2.2 Draw a body outline and simple pad or ball marks derived from side or grid counts, plus a plain exposed-pad outline only when the geometry declares one. Verify with `tests/package-thumbnails.test.ts` that perimeter mark count equals the sum of sides, grid mark count equals rows times columns, exposed-pad markup is absent when undeclared, and only theme utility classes style the SVG.
- [ ] 2.3 Keep the component free of SVG filters, texture primitives, raw color literals, emoji, and new dependencies. Verify that `tests/theme-tokens.test.ts` stays green with `feTurbulence` limited to `PerimeterPackage.svelte` and `GridPackage.svelte`, and that `package.json` and `package-lock.json` are unchanged.

## 3. Catalog thumbnail column and bounded refinement

- [ ] 3.1 Add a small Svelte visibility action in `CatalogPage.svelte` or a component-local state helper using `IntersectionObserver` to track visible result rows, and keep a component-local `Map` of exact geometry keyed by uppercase MCU id. Verify with `tests/package-thumbnails.test.ts` that the generation token increments on result-set change and on destroy, and that `tests/view-preferences.test.ts` still shows no new localStorage key.
- [ ] 3.2 Implement the refinement pass with `mapWithConcurrency(ids, MAX_CONCURRENT_SHARD_LOADS, worker, () => token !== generation)`, a worker that calls `catalogStore.loadChip(id)` and maps `chip.package` with `thumbnailGeometryFromChip`, a per-pass cap of `MAX_THUMBNAIL_REFINEMENTS`, and a token check before applying results. Verify with an instrumented worker test that at most four loads are in flight, the cap is respected, stale results are dropped, and a failed shard leaves the approximate silhouette.
- [ ] 3.3 Add a leading 40-48px thumbnail header cell and cell to the dense catalog table in `src/pages/CatalogPage.svelte` without changing the search card, filters, 500-result cap, retry/loading/empty blocks, or Open handler. Verify with `tests/global-app-shell.test.ts` that the new column is present and that `searchCatalogEntries(`, `buildVendorTabs(`, `catalogFamilies(`, `catalogPackageKinds(`, `catalogStore.indexError`, `catalogStore.retry()`, `catalogStore.loadingIndex`, and `router.navigateMcu(entry.id)` contracts remain.
- [ ] 3.4 Confirm refinement never enqueues offscreen results and keeps subpath-safe fetches. Verify that `tests/subpath-contracts.test.ts` stays green and that a source assertion shows `loadChip(` in the catalog refinement worker only, with no root-absolute data or asset path added.

## 4. Projects session cards

- [ ] 4.1 Replace the table in `src/pages/ProjectsPage.svelte` with a responsive card grid. Each card shows a `PackageThumbnail`, MCU ID, package name, assigned/total pins, relative updated time, and Open, Export, and Delete controls. Verify with `tests/global-app-shell.test.ts` that the card fields and all three actions are present and that the import and New project actions remain.
- [ ] 4.2 Derive each card thumbnail from `session.packageName` and `session.pinCount` through the approximate helper and add no shard fetch to this route. Verify with `tests/package-thumbnails.test.ts` that `ProjectsPage.svelte` contains no `loadChip(` and that the helper receives the stored session fields.
- [ ] 4.3 Preserve the 10-session limit, `pincraft:recent_sessions_v1` shape, empty-state guidance, workspace handoff, and version-2 import/export behavior. Verify with `tests/global-app-shell.test.ts` and `tests/view-preferences.test.ts` that `recentSessions.slice(0, 10)`, `parsePinoutJson(`, `exportPinoutJson(`, `setPendingHandoff(`, and `href="#/catalog"` remain and no new persisted field appears.

## 5. Contract non-regression and documentation

- [ ] 5.1 Update `tests/ui-multi-vendor.test.ts` to assert that refined thumbnails follow generated package geometry and that the interactive renderers keep their two-sided, exposed-pad, bonded, and mux-label contracts. Verify the full file passes without weakening existing renderer assertions.
- [ ] 5.2 Review but keep `tests/start-screen.test.ts`, `tests/theme-tokens.test.ts`, `tests/subpath-contracts.test.ts`, and `tests/view-preferences.test.ts` green. Verify that no texture-scope, no-raw-color, no-emoji, no-root-absolute-path, or preference-key assertion is removed or relaxed.
- [ ] 5.3 Update `README.md` to describe the leading catalog thumbnail column, the visible-row refinement limit, and the projects card view without changing share or project schema claims. Verify that `tests/docs-attribution.test.ts` stays green and that all documented source, license, and verification tokens remain.
- [ ] 5.4 Confirm no file under `openspec/changes/global-top-bar` or `openspec/changes/about-provenance-consolidation` is modified and that the thumbnail edits sit in the page bodies only. Verify with `git status` and the test suite that the final page structure still satisfies the pending changes' contracts once those changes land.

## 6. Integration verification

- [ ] 6.1 Run `npm test` and resolve every failure or warning. Verify the command exits zero with the full suite green.
- [ ] 6.2 Run `npm run check` and resolve every type or Svelte diagnostic. Verify the command exits zero with no output warnings.
- [ ] 6.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm the built app resolves assets under `/pincraft/` with no root-absolute data or asset path. Verify the command exits zero with no build warnings.

## Workflow follow-up

- After all tracked tasks pass, the implementation agent runs `openspec archive package-thumbnails -y`.
- Include the synced spec under `openspec/specs/package-thumbnails/` and the archived change files in the implementation commit, and report validation, test, type-check, build, and archive output as evidence. This planning step makes no commit.

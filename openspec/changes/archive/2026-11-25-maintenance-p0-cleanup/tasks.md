# Tasks

## 1. Trim dependencies and build tooling

- [x] 1.1 Remove `@vitejs/plugin-react`, `lucide-react`, `motion`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `autoprefixer`, `svelte-check`, direct `esbuild`, and the `lint` script from `package.json`; regenerate `package-lock.json` with `npm install --package-lock-only` and verify `npm ci --dry-run` succeeds
- [x] 1.2 Re-evaluate `.npmrc`: keep `legacy-peer-deps=true` only if a real peer conflict blocks install after the removals and document the remaining conflict, otherwise delete the file; verify a clean `npm ci` with the final configuration
- [x] 1.3 Delete the dead `copy-unbundled-src-assets` plugin and unused `@/*` alias from `vite.config.ts` and `tsconfig.json`; verify `npm run check` and `BASE_PATH="/pincraft/" npm run build` pass with no missing imports

## 2. Remove dead runtime surface

- [x] 2.1 Remove `workspaceMode` from `top-bar-ui.svelte.ts` and its assignment from `WorkspacePage.svelte`; verify the top-bar and workspace static tests stay green
- [x] 2.2 Remove `themeStore.toggle()`, `HistoryStack.undoCount`/`redoCount`, and the discarded `validateMatrixPlan()` call in `solver.ts`; update affected tests deliberately and verify theme, history, and exported solver tests pass
- [x] 2.3 Remove the single-value About tab machinery (`ABOUT_TABS`, `AboutTab`, `aboutTab`, tab chrome, `ProvenancePanel` `tab` prop) and update shell-preferences, global-shell, and attribution tests; verify `npm test` passes and About still renders the grouped provenance table
- [x] 2.4 Remove `catalogStore.primeChip()` and its identity helper `signalCountsOrMap()`; replace test priming with a reusable `loadChip()` spy helper and verify every affected test passes without cache shortcuts

## 3. Remove legacy shims and enforce strict version-2 shapes

- [x] 3.1 Remove `LEGACY_PLACEMENT_RINGS`, `LegacyPlacementRing`, `LEGACY_RING_MAP`, and legacy ring acceptance from `types.ts` and `placement.ts`; replace the legacy ring tests with strict current-domain rejection tests and verify the placement suite passes
- [x] 3.2 Remove `-90` rotation normalization from `normalizePackageRotation()` and replace legacy rotation tests with strict rejection of that value; verify history, URL, JSON, and rotation suites pass
- [x] 3.3 Remove legacy `w`/`d`/`placementOverlayVisible`/`dockTab` comments and branches from `url-state.ts` and `exporters/json.ts`; replace legacy payload tests with assertions that these fields never enter decoded state and verify codec suites pass
- [x] 3.4 Remove legacy STM32 top-level fields from `CatalogMeta`, replace the dual `CatalogMetaSources` union with an explicit keyed interface, drop the legacy parameter from `buildMetaDocument()`, and update the provenance gate and log output; verify `npm run gen-data` passes all gates and chip shard bytes are unchanged

## 4. Reconcile documentation and specs

- [x] 4.1 Update `AGENTS.md` for Solar icons, nine runes stores, about six vendor adapters, no hero snapshot, no landing footer, current landing design, current CSV columns, and the new metadata shape; update `README.md` for the check command, the removed `workspaceMode`, no footer claims, removed legacy meta fields, and the store list; verify the attribution and documentation tests pass
- [x] 4.2 Edit the four contradictory main spec files (`multi-vendor-workspace`, `multi-vendor-ci-gates`, `rp-chip-data`, `esp32-ui-exporters-and-docs`) with the minimal footer-to-About delta matching the change specs; verify `openspec validate maintenance-p0-cleanup --strict` passes
- [x] 4.3 Update `tests/docs-attribution.test.ts` to stop preserving stale tokens and verify all documentation tests pass

## 5. Correct start-screen copy

- [x] 5.1 Change the start-screen three-vendor wording to all six vendors in `LandingPage.svelte`; verify start-screen tests pass
- [x] 5.2 Replace the `Static / offline-ready` badge with wording that does not claim offline fonts while remote font stylesheets are loaded; verify start-screen and attribution tests pass
- [x] 5.3 Change the workspace "Browse Catalog" action to open the catalog route and remove `.ioc` from the compare modal's `accept` attributes; verify workspace-button and project-diff tests pass

## 6. Full verification and closeout

- [x] 6.1 Run `npm ci`, `npm test`, `npm run check`, `BASE_PATH="/pincraft/" npm run build`, and `npm run gen-data` and confirm zero warnings, no STM32 shard regressions, and no broken subpath requests
- [x] 6.2 Run `openspec validate --all --strict`, confirm no active changes remain after archive, then commit all artifacts and code changes without pushing

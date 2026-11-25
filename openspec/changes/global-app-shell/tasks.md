# Tasks

## 1. Router and shell mount

- [ ] 1.1 Add `catalog`, `projects`, and `about` route variants to `src/state/router.svelte.ts`, parse `#/catalog`, `#/projects`, and `#/about`, and add navigation helpers. Verify with a new shell contract test that every new hash resolves to its route and that unknown hashes still resolve to `landing`.
- [ ] 1.2 Mount one `AppShell` in `src/App.svelte` around all six route bodies. Verify with a static contract that the shell is mounted exactly once and that `landing`, `workspace`, and `shared` still render their existing pages.
- [ ] 1.3 Add shell CSS in `src/app.css`: own scroll container per shell route, collapsed rail width, overlay stacking tokens, and a toast level above the overlay. Verify that `html`, `body`, and `#app` keep `height: 100%`, `overflow: hidden`, and `overscroll-behavior: none` and that `tests/viewport-layout.test.ts` passes its unchanged single-mount and dock contracts.

## 2. Sidebar and local preferences

- [ ] 2.1 Create `src/state/shell-preferences.svelte.ts` with key `pincraft:shell_preferences_v1`, `sidebarExpanded`, `aboutTab`, defaults collapsed and first tab, unknown-value normalization, and guarded writes. Verify with a new dedicated test covering defaults, reload, unknown values, and missing localStorage without throwing.
- [ ] 2.2 Build the global sidebar component with an always-visible collapsed icon rail, expand and collapse controls, a backdrop, the four section entries, active-route indication, and a fixed overlay that does not resize page content. Verify with a new shell test that the overlay is fixed-position, that the workspace root receives no width or padding rule from the shell, and that every route includes the component.
- [ ] 2.3 Wire the sidebar recent-projects area to `workspaceStore.recentSessions` with at most 10 entries, quick open, delete, and an empty state. Verify with a new shell test that open reuses `openMcu()` and delete reuses `deleteRecentSession()` and that no session payload gains a shell field.

## 3. Catalog route and new-project redirect

- [ ] 3.1 Build `src/pages/CatalogPage.svelte` as a full-screen browser over `catalogStore.index` with query, vendor, family, and package filters and a part action that opens `#/mcu/<PART_NUMBER>`. Verify with new shell contracts and the existing `tests/ui-multi-vendor.test.ts` that vendor filtering and navigation reuse current discovery behavior.
- [ ] 3.2 Show `catalogStore.indexError` with a retry control on the catalog route and keep a loading state while data is pending. Verify with a new shell test that a failed load shows the failure and retry row instead of an empty list.
- [ ] 3.3 Change the start screen's New pinout MCU/Board action to navigate to `#/catalog` while keeping inline search, board presets, imports, and compare. Verify that `tests/start-screen.test.ts` is updated deliberately and passes, and that quick search and board selector contracts remain.

## 4. Projects route

- [ ] 4.1 Build `src/pages/ProjectsPage.svelte` listing recent sessions with MCU identifiers, open, delete, and an empty state with a link to the catalog or home screen. Verify with a new shell test that the list reads the same store as the sidebar and that delete updates the stored list.
- [ ] 4.2 Add project import and export actions on the projects route using `parsePinoutJson()` and `exportPinoutJson()`. Verify with a new shell test that a valid version-2 file hands off to the workspace, an invalid file reports an error in place, and exported JSON contains no shell preference field; confirm `tests/workspace-state.test.ts` still passes unchanged.

## 5. About migration

- [ ] 5.1 Extract the provenance source and vendor constants from `src/pages/LandingPage.svelte` into a shared module under `src/data/` and build a provenance panel that renders sources, licenses, and revisions from `catalogStore.meta`. Verify that `tests/docs-attribution.test.ts` is updated deliberately to assert those strings in the new component and still passes its README and AGENTS.md checks.
- [ ] 5.2 Build `src/pages/AboutPage.svelte` with catalog statistics, the provenance panel, and the textual shortcut reference, plus tab selection persisted through the shell preference store. Verify with the shell preference test that the selected tab survives reload and that the default is the first tab.
- [ ] 5.3 Remove the start screen's `id="provenance"` footer, replace the header's provenance anchor with an About link, and keep the compact catalog summary card. Verify that updated `tests/viewport-layout.test.ts` and `tests/start-screen.test.ts` pass and that no data source or license string is lost from the app.

## 6. Workspace and shared-link non-regression

- [ ] 6.1 Keep the workspace root, three-pane grid, dock, single mounts, pan, zoom, and fit behavior unchanged under the expanded sidebar. Verify that `tests/viewport-layout.test.ts` passes with its single-mount, toolbar, modal, and overlay-clamping contracts intact and that no new layout class changes canvas dimensions.
- [ ] 6.2 Keep the toast fully visible and dismissible with the sidebar expanded by setting its stacking level above the overlay. Verify that `tests/workspace-qol.test.ts` passes with the new expanded-sidebar scenario and that its help dialog and focus contracts remain unchanged.
- [ ] 6.3 Confirm `#/mcu/<PART_NUMBER>` and `#/s/<PAYLOAD>` handoffs still hydrate with the original pin configuration and that no shell field enters the URL codec or history. Verify that `tests/workspace-state.test.ts`, `tests/core-io.test.ts`, and the existing share-link tests pass unchanged.

## 7. Documentation and shared contracts

- [ ] 7.1 Document the six hash routes, shell navigation, About provenance, and localStorage-only shell preferences in `README.md` and `AGENTS.md`. Verify that `tests/docs-attribution.test.ts` passes with its existing token checks and that no statement claims pin configuration is stored outside share URLs and project files.
- [ ] 7.2 Add `tests/global-app-shell.test.ts` and update `tests/subpath-contracts.test.ts` for the new route and data-loading contracts; keep `tests/view-preferences.test.ts` and `tests/hero-lazy.test.ts` unchanged. Verify that the full focused set of shell, start-screen, viewport, workspace-QOL, documentation, and subpath tests passes.

## 8. Integration verification

- [ ] 8.1 Run `npm test` and resolve every failure or warning. Verify the command exits zero with the full suite green.
- [ ] 8.2 Run `npm run check` and resolve every type or Svelte diagnostic. Verify the command exits zero with no output warnings.
- [ ] 8.3 Run `BASE_PATH="/pincraft/" npm run build` and the subpath smoke checks. Verify the command exits zero, the built app loads under `/pincraft/`, and no built asset requests `/data/` or `/assets/` from the root.

## Workflow follow-up

- After all tracked tasks pass, the implementation agent must run `openspec archive global-app-shell -y`.
- Include the archived spec, proposal, design, and tasks files in the implementation commit and report validation, test, type-check, build, and archive output as evidence.

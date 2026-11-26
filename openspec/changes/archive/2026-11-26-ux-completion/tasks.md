# Tasks

## 1. Keyboard-operable pins and portrait shell fit

- [x] 1.1 Add an SVG pin keyboard activation path in `PerimeterPackage.svelte` and `GridPackage.svelte`: `role="button"`, `tabindex="0"`, pin-title `aria-label`, and Enter/Space handling that computes a synthetic click at the focused group's centre and calls the existing `onPinClick`; leave non-I/O pads unfocusable and keep the diagram role; verify package render and keyboard static tests pass under `npm test`
- [x] 1.2 Reduce horizontal padding for `.landing-shell > main` and `.shell-route > main` inside the existing single `@media (orientation: portrait)` block in `src/app.css`, with no second orientation query or JavaScript layout detection; verify the viewport-layout suite and `npm test` pass

## 2. Catalog sorting, links, and capacity display

- [x] 2.1 Add a pure `sortCatalogEntries()` helper under `src/core/` with part, pin-count, flash, and RAM modes, stable part-id tie-breaking, and absent values last; add Vitest cases for every mode and tie case, with no DOM or Svelte import; verify `npm test` and `npm run check` pass
- [x] 2.2 Wire a transient catalog sort control to `sortCatalogEntries()`, turn the part cell into a `#/mcu/<PART>` hash link, and render `—` with a single `KB` header unit; verify catalog and multi-vendor suites pass and no sort field enters filters, share URLs, or project JSON

## 3. Projects search, confirmation, and Save as

- [x] 3.1 Add in-memory search over part, name, and package to `ProjectsPage.svelte`, filtering a derived list without mutating `workspaceStore.recentSessions`; verify project and start-screen suites pass
- [x] 3.2 Add per-card delete confirmation with Cancel and Delete choices that calls `deleteRecentSession()` only after confirmation; verify the delete path is still covered once and `npm test` passes
- [x] 3.3 Add a per-card Save as editor that downloads a version-2 JSON copy with a caller-supplied `projectName` through `exportPinoutJson()` without renaming the stored session; add a unit test that the exported copy parses and the session name stays unchanged; verify project suites pass

## 4. Copy and shortcut consistency

- [x] 4.1 Rename the top-bar compatible-MCU action label, title, and aria label to "Compatible MCUs" and align the finder heading and accessible label; verify compatible-finder and shell suites pass with no scoring change
- [x] 4.2 Make the Clear All confirmation and toast name every reset field and add matching `aria-keyshortcuts` to the shortcut-bearing controls; verify top-bar and workspace-qol suites pass
- [x] 4.3 Add `?` to `SHORTCUTS` and align action wording with the actual controls, with no shortcut list on About or the landing page; verify the shortcut reference suite and `npm test` pass

## 5. Full verification and closeout

- [x] 5.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no STM32, generated-data, theme-token, or share-schema regression and no new dependency
- [x] 5.2 Run `openspec validate ux-completion --strict`, archive with `openspec archive ux-completion -y`, fix any archived spec purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit code, specs, and archive artifacts

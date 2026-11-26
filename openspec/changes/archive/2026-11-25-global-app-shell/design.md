# Design

## Context

`src/App.svelte` switches between `landing`, `workspace`, and `shared` views;
`src/state/router.svelte.ts` parses only `#/`, `#/mcu/<PART>`, and `#/s/<PAYLOAD>`.
The workspace is viewport-locked by `src/app.css`, while the start screen scrolls
inside `.landing-shell`. Recent sessions live in `pinspec:recent_sessions_v1`
through `workspaceStore`, which already exposes open and delete operations.
`catalogStore` owns `meta.json` and `index.json` loading with retryable errors.
`viewPreferences` demonstrates the localStorage-only preference pattern, and its
stored key set is asserted by tests. Provenance constants and the technical
footer currently live inside `src/pages/LandingPage.svelte`. Most static tests
inspect source text, so contract changes must be deliberate and in the same
change. See proposal.md for motivation and `../specs/global-app-shell/spec.md`
for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Mount one shell outside the route switch so every route gets the same sidebar.
- Keep the pin canvas geometry and workspace layout byte-for-byte unaffected by
  sidebar expansion; overlay instead of reflow.
- Reuse the existing router, catalog, workspace, and preference patterns rather
  than adding parallel state modules for pin configuration.
- Move provenance content to About while preserving a compact start-screen
  summary and its quick actions.
- Keep all new presentation state in localStorage and out of share links and
  project files.

**Non-Goals:**

- No change to pin configuration schema, solver, exporters, generated data, or
  upstream sources.
- No new npm dependency, backend, API key, or runtime service.
- No removal of the existing workspace shortcut-help dialog or of the start
  screen's search, import, preset, and compare actions.
- No rewrite of workspace pan gesture, zoom, rotation, or dock behavior.

## Decisions

### Shell placement and route set

Mount `AppShell.svelte` once in `App.svelte`, wrapping the route body. Keep the
existing three views and add `catalog`, `projects`, and `about` to the `Route`
union and to `parseHash()` for `#/catalog`, `#/projects`, and `#/about`.
Navigation helpers on the router cover the three new destinations. Unknown
hashes continue to resolve to the home route. All routes keep hash-only
navigation so GitHub Pages subpaths never request a server route.

Alternative considered: mounting the sidebar inside each page. Rejected because
it duplicates state, causes a visible remount on route changes, and makes the
non-regression contract for the workspace harder to hold.

### Collapsed rail and overlay behavior

The collapsed rail is a fixed-width vertical strip rendered from vector icons and
is always present. Expansion renders a fixed-position panel over the current
page using theme tokens and a stacking level above page content but below native
dialogs. The workspace root, three-pane grid, and canvas receive no new padding,
margin, or width rule; `PackageCanvas` keeps reading its own bounding rectangle,
so pan, zoom, and fit calculations see the same dimensions before and after
expansion. A backdrop closes the expanded panel on activation. The shell never
changes `data-dock-tab`, dock height, or the single-mount contracts asserted by
the viewport tests.

Alternative considered: pushing page content with a CSS grid column. Rejected
because it resizes the canvas and invalidates fit-view geometry.

### New pages and reuse

`CatalogPage.svelte` uses `catalogStore.index` and `catalogStore.meta` with
`searchCatalogEntries()` for query and vendor, family, and package filtering. It
reuses `QuickSearchBar.svelte` or a shared filter component only where behavior
matches; opening a part calls the existing MCU navigation and chip load path.
`ProjectsPage.svelte` reads `workspaceStore.recentSessions` and reuses
`parsePinoutJson()`, `exportPinoutJson()`, `openMcu()`, and
`deleteRecentSession()`. `AboutPage.svelte` reads `catalogStore.meta` and shared
provenance constants extracted from the start screen into a small module under
`src/data/`; a `ProvenancePanel` component renders the full source, license, and
revision list and the textual shortcut reference. The start screen keeps its
compact catalog card and links to About.

Alternative considered: duplicating provenance literals in both places.
Rejected because two copies drift when sources change.

### Sidebar recent projects

The sidebar renders the same `recentSessions` array the start screen uses,
limited to 10 by the store. Each row offers open and delete. Open uses the
existing session handoff; delete calls the store so localStorage updates once.
The empty state is text only. No session state is copied into shell state, and
the recent-session payload stays identical to today's version-2 workspace state.

### Shell preferences

Add `src/state/shell-preferences.svelte.ts` with its own key
`pinspec:shell_preferences_v1`. It stores `sidebarExpanded` and `aboutTab`,
normalizes absent or unknown values to collapsed and the first tab, and writes
only through localStorage. Do not extend `VIEW_PREFERENCES_STORAGE_KEY`: its
exact key set is asserted by `tests/view-preferences.test.ts`, and shell
preferences apply outside the workspace. No shell field is added to
`WorkspaceState`, the URL codec, history, or project JSON. When storage is
unavailable, the store keeps values in memory and does not throw, matching the
existing preference store behavior.

### Test-contract mapping

- `tests/global-app-shell.test.ts` (new): shell mount on all six route states,
  collapsed rail and overlay contracts, section navigation, recent list limit
  and open/delete wiring, catalog/projects/about route contracts, localStorage
  key and normalization, and absence of shell fields in share and JSON outputs.
- `tests/viewport-layout.test.ts`: replace the start-screen `#provenance`
  assertions with About ownership; keep document-lock, single-mount, dock-tab,
  and toolbar contracts; add an overlay-no-reflow source contract.
- `tests/start-screen.test.ts`: assert the New pinout action navigates to
  `#/catalog`, remove the full footer assertions, and keep the three zones,
  quick actions, and `.ioc` handoff contracts.
- `tests/docs-attribution.test.ts`: move the source, license, and revision
  string assertions from `LandingPage.svelte` to the About/provenance component
  while keeping README and AGENTS.md checks.
- `tests/workspace-qol.test.ts`: add the expanded-sidebar toast visibility
  contract; keep the `?` help dialog and focus contracts unchanged.
- `tests/view-preferences.test.ts` and `tests/workspace-state.test.ts`: keep
  unchanged to prove the new shell preferences do not enter workspace state or
  the existing stored key set. Add a dedicated shell-preferences test.
- `tests/subpath-contracts.test.ts`: add coverage that new hash routes resolve
  from the hash and that data fetches continue through `dataUrl()`.
- `tests/hero-lazy.test.ts`, `tests/ui-multi-vendor.test.ts`, and
  `tests/docs-attribution.test.ts`: keep existing negative and vendor discovery
  contracts; only adjust assertions whose target file genuinely moves.

## Risks / Trade-offs

- Static source-string tests are brittle and may fail for benign markup changes.
  Mitigation: update the contracts in this change and run the full suite before
  closing tasks.
- The expanded sidebar could cover toasts, dock tabs, or native dialogs.
  Mitigation: define stacking levels so native dialogs remain in the top layer,
  the toast stays above the sidebar overlay, and the sidebar never changes dock
  geometry.
- A page scroll container on every shell route could reintroduce document
  scrolling. Mitigation: keep `html`, `body`, and `#app` locked, give each shell
  route its own overflow container, and verify with the viewport contracts.
- Missing localStorage can break preference restoration. Mitigation: normalize
  reads and guard writes as the existing preference store does.
- Catalog fetch failure could leave the catalog route empty. Mitigation: reuse
  `catalogStore.indexError` and its retry path on the route.
- Duplicated shortcut lists can diverge. Mitigation: About owns the full
  reference and the start screen keeps only its existing compact summary.

## Migration Plan

Implemented by the implementation agent after artifacts are complete:

1. Extend the router and app shell, then add the sidebar and shell preference
   store.
2. Add the catalog, projects, and about pages and extract provenance content.
3. Adjust the start screen, workspace overlay stacking, CSS, and documentation.
4. Update static test contracts in the same change.
5. Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`.
6. Run `openspec archive global-app-shell -y` and include archive output in the
   implementation commit. No persisted user data migration is required; the new
   localStorage key is additive and can be ignored on rollback.

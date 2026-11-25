# Proposal

## Why

Navigation and project recovery currently exist only inside the `#/` start screen and the workspace toolbar, while provenance information is locked in the start-screen footer. Users cannot browse the full catalog, reach recent projects, or read source attribution from other routes. A shell-level navigation surface with dedicated routes separates those concerns without changing pin planning behavior.

## What Changes

- Add a global left sidebar present on every route: home, catalog, projects, about, workspace, and shared. Its collapsed state is a narrow icon rail that stays visible; expanding it overlays the page without pushing or resizing the pin canvas or any other content.
- Add sidebar entries for Home screen, Catalog screen, Projects screen, and About, plus a recent-projects list of up to 10 sessions from `pincraft:recent_sessions_v1` with quick open and delete.
- Add three hash routes: `#/catalog` for browsing all generated parts, `#/projects` for recent sessions with import and export actions, and `#/about` for provenance and shortcut reference.
- Redirect the start screen's New pinout MCU/Board action to `#/catalog`. Keep the start screen's quick search, board preset control, imports, compare action, recent sessions, and starter chips.
- Move the technical provenance footer's content (catalog statistics, source revisions, licenses, shortcuts) into About. The start screen keeps a compact catalog summary and a link to About; it no longer owns the full footer.
- Persist sidebar expansion and the selected About tab in localStorage only. Share URLs and version-2 project JSON stay unchanged for pin configuration and gain no presentation fields.
- Update static test contracts for routing, the start screen, provenance location, view preferences, and subpath behavior deliberately; add contracts for the shell and the new routes.
- **BREAKING** for navigation flows only: the start screen's New pinout MCU/Board control opens the catalog route instead of focusing the inline search. No share-link, project-file, or workspace-state schema change is included.

## Capabilities

### New Capabilities

- `global-app-shell`: Global route shell with a collapsible overlay sidebar, catalog/projects/about routes, recent-project navigation, About provenance, and localStorage-only shell preferences.

### Modified Capabilities

- `viewport-locked-workspace`: The document-lock requirement currently exempts only the landing page from the root scroll lock; the new shell routes also need their own scroll containers.
- `pincraft-start-screen`: The header provenance anchor, the New pinout action target, and the retained provenance footer are changed by the new routes and About migration.
- `workspace-qol`: The toast visibility contract must account for the expanded global sidebar overlay above the workspace.

## Impact

- Files: `src/App.svelte`, `src/state/router.svelte.ts`, new shell state and page components, `src/pages/LandingPage.svelte`, `src/pages/WorkspacePage.svelte`, `src/app.css`, `README.md`, `AGENTS.md`, and static contract tests.
- State: sidebar expansion and About tab are UI preferences in localStorage. Recent sessions keep using `pincraft:recent_sessions_v1`. Pin configuration stays in workspace state, undo/redo history, share URLs, and project JSON.
- Data: catalog and meta reads continue through `catalogStore` and `dataUrl()` with `import.meta.env.BASE_URL`. No generated data, data generator, or upstream source changes.
- Dependencies: none added. Colors continue to come from theme tokens and the vendored theme file; icons come from `lucide-svelte`.
- Verification: `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` must pass with zero warnings, followed by change archive by the implementation agent.

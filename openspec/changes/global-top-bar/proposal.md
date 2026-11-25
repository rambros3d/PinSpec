# Proposal

## Why

Navigation and controls are duplicated across the application: four separate page
headers own branding and section links, the workspace renders its own toolbar,
and the collapsed sidebar rail is a fixed overlay that covers page content. There
is no single navigation and action surface shared by every route.

## What Changes

- Reserve the collapsed rail's 3rem of horizontal space on every route so the
  rail never covers content. The expanded panel stays a fixed overlay with a
  backdrop and never pushes or reflows the canvas or any pane.
- Add one global h-12 top bar mounted once in the shell on every route, visually
  matched to the workspace toolbar. It replaces the four page headers
  (`LandingPage`, `CatalogPage`, `ProjectsPage`, `AboutPage`) and the workspace
  `TopToolbar`. Workspace routes render one bar only.
- Merge workspace actions into the global bar: MCU switcher, pin and signal
  search, undo/redo, clear, rotate and fit if still needed, alternatives,
  compare, share, and export. Keep the existing behavior of each action and its
  keyboard shortcut.
- Move the sidebar expand/collapse control into the global bar as its leftmost
  button and remove it from the rail header.
- Compose the global bar from the sidebar toggle, a route title, section links
  (Home, Catalog, Projects), the theme control, the shortcuts control, and the
  workspace actions when applicable. Keep the row compact and horizontally
  scrollable when controls do not fit.
- Rename sidebar entries to remove the word "screen": Home, Catalog, Projects,
  About. Keep Home and Projects at the top followed by the recent-projects
  list, and move Catalog and About to the bottom behind a visual separator.
- Keep the recent-projects list at up to 10 localStorage sessions. Keep sidebar
  expansion and the selected About tab as localStorage-only UI preferences.
  Keep pin configuration shareable in share URLs and version-2 project files.
- Update the static test contracts deliberately for the single global bar, the
  rail reservation, the merged actions, the toggle placement, and the sidebar
  labels and order. Preserve pin configuration and generated-data contracts.
- **BREAKING** for page structure only: the four per-page navbars and the
  workspace toolbar are removed and their controls relocate to the global bar.
  No share-link, project-file, workspace-state, or generated-data schema change
  is included.

## Capabilities

### New Capabilities

- `global-top-bar`: One shared top navigation and action bar on every route,
  including rail space reservation, merged workspace actions, toggle placement,
  and route/persistence non-regression.

### Modified Capabilities

- `global-app-shell`: The collapsed rail now reserves horizontal space instead
  of overlaying content; the sidebar toggle moves to the global bar; section
  labels and ordering change with Catalog and About at the bottom.
- `viewport-locked-workspace`: The viewport-width and document-lock contracts
  now apply to the global top bar, and the reserved rail must not widen the
  document.
- `multi-vendor-workspace`: The vendor-aware MCU switcher remains reachable
  from the global bar on workspace and shared routes.
- `workspace-qol`: Toolbar overflow affordance and on-demand shortcut help now
  refer to the global bar and its shortcuts control.

## Impact

- Files: `src/App.svelte`, `src/components/shell/AppShell.svelte`,
  `src/components/shell/GlobalSidebar.svelte`, a new global top bar component
  under `src/components/shell/`, `src/pages/LandingPage.svelte`,
  `src/pages/CatalogPage.svelte`, `src/pages/ProjectsPage.svelte`,
  `src/pages/AboutPage.svelte`, `src/pages/WorkspacePage.svelte`,
  `src/components/workspace/TopToolbar.svelte`, `src/app.css`, `README.md`,
  and static contract tests.
- State: no new persisted field. Sidebar expansion and About tab stay in
  localStorage under `pincraft:shell_preferences_v1`; recent sessions stay in
  `pincraft:recent_sessions_v1`. Pin configuration stays in workspace state,
  undo/redo history, share URLs, and project JSON.
- Data: catalog and meta reads continue through `catalogStore` and `dataUrl()`
  with `import.meta.env.BASE_URL`. No generated data, data generator, or
  upstream source changes.
- Dependencies: none added. Colors continue to come from theme tokens and the
  vendored theme file; icons come from `lucide-svelte`. No emoji.
- Verification: `npm test`, `npm run check`, and
  `BASE_PATH="/pincraft/" npm run build` must pass with zero warnings, followed
  by change archive by the implementation agent.

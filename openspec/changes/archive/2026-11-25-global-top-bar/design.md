# Design

## Context

`src/App.svelte` mounts one `AppShell` around the route switch. `AppShell.svelte`
renders `GlobalSidebar` and route children inside `.app-shell`; today
`.app-shell-content` has no left inset, so the fixed 3rem rail covers content.
`src/app.css` locks `html`, `body`, and `#app` and gives `.landing-shell`,
`.shell-route`, and `.workspace-root` a `height: 100dvh`. The four shell pages and
the landing page each render their own `navbar` header; `WorkspacePage` renders
`TopToolbar` inside a grid `toolbar` row of `3rem`. `GlobalSidebar` owns the
section labels, the expand toggle in its header, and the recent list. Most
contracts are static source-string tests, so test edits must land in the same
change. See proposal.md for motivation and the delta specs for behavior.

## Goals / Non-Goals

**Goals:**

- Mount exactly one h-12 bar in the shell for every route and remove the five
  existing headers/toolbars it replaces.
- Reserve 3rem for the collapsed rail on every route while keeping the expanded
  panel a fixed overlay with a backdrop and no reflow.
- Preserve each workspace action and shortcut after it moves into the bar.
- Use one shared bar component for every route; the only intentional difference
  is that the PinSpec wordmark is rendered on shell routes and omitted on
  workspace/shared routes to conserve horizontal space.
- Keep route resolution, data fetches, share URLs, project JSON, and the
  localStorage preference boundary unchanged.

**Non-Goals:**

- No change to pin configuration, solver, exporters, generated data, or upstream
  sources.
- No new npm dependency, backend, API key, or runtime service.
- No new persisted preference or new field in `WorkspaceState`, the URL codec,
  history, or project JSON.
- No restyling of the workspace panes, dock, canvas gestures, or dialogs beyond
  the relocation of their triggers.

## Decisions

### Shell composition and one bar

`AppShell.svelte` renders `GlobalTopBar` above `.app-shell-content`, then
`GlobalSidebar` and the route children. The bar is full viewport width and h-12;
the rail and expanded panel start below it at `top: 3rem`. `LandingPage`,
`CatalogPage`, `ProjectsPage`, and `AboutPage` drop their `<header class="navbar">`
blocks; `WorkspacePage` drops `TopToolbar` and its `workspace-toolbar` wrapper.
The bar derives its title and active section link from the router view, so the
home, catalog, projects, and about routes show context without page-local
headers. No route renders a second bar.

Alternative considered: keep page headers and hide them with CSS. Rejected
because duplicate markup leaves two action sets in the DOM and keeps the
single-bar contract untestable by source inspection.

### Reserved rail and overlay behavior

`.app-shell-content` gains a 3rem left inset (a padding on the content box, with
`box-sizing: border-box` already provided by Tailwind preflight). The rail stays
`position: fixed` at `left: 0; top: 3rem; bottom: 0; width: 3rem`. The expanded
panel stays `position: fixed` at `left: 0; top: 3rem; bottom: 0` with an 18rem
width, a backdrop beneath it, and the existing `--shell-panel-z` and
`--shell-backdrop-z` levels. Expansion changes no width, padding, or grid on
route content, so `PackageCanvas` still measures the same rectangle and fit,
pan, and zoom are unchanged. The toast level stays above the overlay.

Because the bar consumes 3rem of vertical space, `.landing-shell`, `.shell-route`,
and `.workspace-root` change from `height: 100dvh` to `height: 100%` so each fills
only the content box below the bar. The `toolbar` grid area and its `3rem` row are
removed from both the landscape and portrait `.workspace-root` definitions; the
banner, canvas, dock, and summary areas keep their order and sizing rules. The
root document keeps `overflow: hidden` and `overscroll-behavior: none`, and the
rail inset cannot create a horizontal document scrollbar.

Alternative considered: push content with a CSS grid column in the shell while
expanded. Rejected because it resizes the canvas and invalidates fit-view
geometry, which the existing viewport contracts forbid.

### Top bar anatomy

The bar is one compact, horizontally scrollable row with this order: sidebar
toggle, route title, section links (Home, Catalog, Projects), theme control,
shortcuts control, then the workspace action cluster when the route is workspace
or shared. The section links reuse the router navigation helpers and mark the
active destination. The theme control reuses `ThemePicker` with the same compact
mode as the former toolbar. Overflow uses the existing `shouldShowScrollAffordance`
helper and the h-12 height, so the workspace-QOL affordance contract still holds.
On shell routes the shortcuts control navigates to `#/about` and selects the
`shortcuts` tab; on workspace and shared routes it opens the existing shortcut
help dialog so the `?` key and the button share one dialog.

Alternative considered: a separate global help dialog. Rejected because About
already owns the shortcut reference and a second copy would drift.

### Workspace action wiring

`WorkspacePage` keeps the chip load, dialogs, and pin state it owns today. A new
runes module `src/state/top-bar-ui.svelte.ts` holds only transient UI/view state:
`workspaceMode`, the four dialog-open flags (`switcher`, `export`, `finder`,
`diff`), the shortcut-help flag, and a registered `focusSearch` callback.
`WorkspacePage` sets `workspaceMode` on mount, clears it and all flags on
destroy, and renders its existing dialogs from those flags. `GlobalTopBar` reads
the flags, toggles them from its actions, and registers `focusSearch` so the
workspace Ctrl+F handler focuses and selects the bar's search input. Chip,
search text and match count, undo/redo availability, and rotation come straight
from `workspaceStore`; no pin configuration is duplicated in the new store.

State category declaration: every field in `top-bar-ui.svelte.ts` is UI/view
state. These fields are transient and are not persisted, including to
localStorage; they never enter share URLs, project JSON, recent session state, or
undo history. Sidebar expansion and About tab remain unchanged localStorage-only
preferences. Pin configuration remains shareable.

Alternative considered: pass a `Snippet` of bar actions from `WorkspacePage`
through `App.svelte`. Rejected because `App.svelte` cannot obtain a snippet from
a route it renders, and prop drilling would couple the shell to workspace-local
dialog state.

### Sidebar labels, order, and toggle

`GlobalSidebar`'s `SECTIONS` labels become Home, Catalog, Projects, and About.
The nav renders Home and Projects at the top, then the existing recent-projects
list, then a visual separator, then Catalog and About at the bottom. The expand
toggle is removed from the rail header and becomes the leftmost `GlobalTopBar`
control; both call the same `shellPreferences.sidebarExpanded` value. The recent
list stays `recentSessions.slice(0, 10)` with the same open and delete handlers,
and no label or ordering field is persisted outside localStorage.

### Test-contract mapping

- `tests/global-app-shell.test.ts`: assert exactly one global bar mount, no
  `navbar` header in the four pages, no `TopToolbar` in the workspace, the bar
  spanning all routes, rail reservation, toggle placement, and sidebar label and
  order strings; keep route and preference contracts.
- `tests/viewport-layout.test.ts`: replace toolbar/nav anchors with the global
  bar; keep document-lock, single-mount, dock, modal, and overlay-clamping
  contracts; assert no `100dvh` on the shell route roots and no toolbar grid row.
- `tests/start-screen.test.ts`: assert the landing header is gone and the global
  bar supplies Home, search entry, and theme; keep the three zones, quick
  actions, and `.ioc` handoff contracts.
- `tests/workspace-qol.test.ts`: retarget toolbar overflow and shortcut-help
  assertions to the global bar and its shortcuts control; keep toast, focus,
  and help-dialog contracts.
- `tests/ui-multi-vendor.test.ts`: keep vendor discovery and MCU switcher
  contracts; adjust the switcher anchor to the global bar.
- `tests/docs-attribution.test.ts` and `tests/theme-tokens.test.ts`: keep source
  attribution and token checks; adjust only anchors that move to the bar.
- `tests/shell-preferences.test.ts`, `tests/workspace-state.test.ts`,
  `tests/core-io.test.ts`, `tests/theme-mode-toggle.test.ts`, and
  `tests/subpath-contracts.test.ts`: keep unchanged to prove no new persisted
  field, no share/project schema change, and unchanged subpath fetches.

## Risks / Trade-offs

- Static source-string tests are brittle. Mitigation: update every affected
  contract in this change and run the full suite before closing tasks.
- Reserved rail and bar heights could leave a stale `100dvh` rule that overflows
  the document. Mitigation: change all three shell route roots to `height: 100%`
  and keep the viewport contracts active.
- Moving the search input out of `WorkspacePage` could break Ctrl+F selection.
  Mitigation: register `focusSearch` from the bar and assert the selection
  contract in `tests/workspace-qol.test.ts`.
- A stale dialog flag after leaving a workspace could show a dialog on a shell
  route. Mitigation: clear all transient flags on `WorkspacePage` destroy.
- The shortcuts button could duplicate the help dialog. Mitigation: shell routes
  open the About Shortcuts tab; workspace routes open the existing dialog.

## Migration Plan

Implemented by the implementation agent after artifacts are complete:

1. Add `GlobalTopBar` and `top-bar-ui.svelte.ts`, then mount the bar in
   `AppShell` and reserve the rail inset in `app.css`.
2. Remove the four page headers and the workspace toolbar; rewire workspace
   actions and dialogs through the new store.
3. Update `GlobalSidebar` labels, order, separator, and toggle placement.
4. Update static test contracts in the same change, then run `npm test`,
   `npm run check`, and `BASE_PATH="/pinspec/" npm run build`.
5. Run `openspec archive global-top-bar -y` and include archive output in the
   implementation commit. No user data migration is required: the new store is
   transient and the only persisted values are the existing localStorage keys.

## Open Questions

None. The user decisions fix the layout, action set, toggle placement, labels,
order, and persistence boundary; remaining choices are covered above.

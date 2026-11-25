# Tasks

## 1. Global bar mount and layout reservation

- [x] 1.1 Add `src/components/shell/GlobalTopBar.svelte` and mount it once in `src/components/shell/AppShell.svelte` above `.app-shell-content`, full width and h-12, with no page-level or workspace bar. Verify with `tests/global-app-shell.test.ts` that the bar mounts exactly once across all six route states and that no route renders a second bar.
- [x] 1.2 Reserve 3rem of horizontal space for the collapsed rail in `src/app.css` by giving `.app-shell-content` a left inset, and offset the rail and expanded panel to start below the bar at `top: 3rem`. Verify with `tests/global-app-shell.test.ts` and `tests/viewport-layout.test.ts` that route content begins after the rail, expansion stays a fixed overlay with a backdrop, and no width or padding rule reflows the canvas.
- [x] 1.3 Change `.landing-shell`, `.shell-route`, and `.workspace-root` from `height: 100dvh` to `height: 100%` and remove the `toolbar` grid area and its `3rem` row from both landscape and portrait `.workspace-root` definitions. Verify that `tests/viewport-layout.test.ts` keeps its document-lock, single-mount, dock, modal, and overlay-clamping contracts and that no `100dvh` root or toolbar grid row remains.

## 2. Shared bar controls

- [x] 2.1 Compose the bar in this order: sidebar toggle, route title, section links (Home, Catalog, Projects), theme control, shortcuts control. Derive title and active section from the router and reuse the router navigation helpers. Verify with `tests/global-app-shell.test.ts` that every shell route shows its title and active link and that no navigation label contains the word "screen".
- [x] 2.2 Move the expand/collapse control into the bar as its leftmost button, remove it from the rail header, and keep it bound to `shellPreferences.sidebarExpanded`. Verify with `tests/global-app-shell.test.ts` that the control is absent from the rail header and that toggling does not change the route or pin state.
- [x] 2.3 Wire the shortcuts control to the About Shortcuts tab on shell routes and to the existing shortcut-help dialog on workspace and shared routes. Verify with `tests/workspace-qol.test.ts` that both entry points open the same help content with focus inside and that `tests/shell-preferences.test.ts` still passes.
- [x] 2.4 Keep the bar compact with internal horizontal scrolling and the existing scroll affordance using `shouldShowScrollAffordance`. Verify with `tests/workspace-qol.test.ts` that the affordance appears only on overflow and that scrolling reveals controls without widening the document.

## 3. Workspace action merge

- [x] 3.1 Create `src/state/top-bar-ui.svelte.ts` with transient UI/view state only: `workspaceMode`, dialog flags for switcher, export, finder, diff, and shortcut help, plus a registered `focusSearch` callback. Declare in a doc comment that no field is persisted or enters share URLs, project JSON, recent sessions, or undo history. Verify with `tests/workspace-state.test.ts` and `tests/shell-preferences.test.ts` remaining unchanged.
- [x] 3.2 Move the former `TopToolbar` action set into `GlobalTopBar`: MCU switcher, pin/signal search, undo, redo, clear, rotate and fit where still needed, alternatives, compare, share, and export. Read chip, search text and match count, undo/redo availability, and rotation from `workspaceStore`. Verify with `tests/global-app-shell.test.ts` that every action appears once, no `TopToolbar` remains in `WorkspacePage`, and `tests/ui-multi-vendor.test.ts` still covers the vendor-aware switcher from the bar.
- [x] 3.3 Rewire workspace dialog triggers and the Ctrl+F handler to the new store: `WorkspacePage` sets `workspaceMode`, renders its dialogs from the flags, clears all flags on destroy, and calls the registered `focusSearch` so the bar input is focused with its query selected. Verify with `tests/workspace-qol.test.ts` that search selection, focus restoration, and help-dialog behavior are unchanged.
- [x] 3.4 Confirm undo/redo, clear, share, export, rotate, alternatives, and compare still call their prior handlers and that keyboard shortcuts are guarded while a dialog is open. Verify with `tests/viewport-layout.test.ts`, `tests/workspace-state.test.ts`, and `tests/core-io.test.ts` passing unchanged.

## 4. Sidebar labels, order, and recent list

- [x] 4.1 Rename `SECTIONS` labels in `src/components/shell/GlobalSidebar.svelte` to Home, Catalog, Projects, and About with no "screen" wording. Verify with `tests/global-app-shell.test.ts` and `tests/start-screen.test.ts` that no navigation label contains "screen" and target hashes are unchanged.
- [x] 4.2 Order the sidebar as Home and Projects at the top, the recent-projects list next, a visual separator, then Catalog and About at the bottom. Verify with `tests/global-app-shell.test.ts` that the bottom group follows the separator and that active-route indication still works from workspace and shared routes.
- [x] 4.3 Keep the recent list at `recentSessions.slice(0, 10)` with the same open and delete handlers and empty state. Verify with `tests/global-app-shell.test.ts` that the limit and handoff contracts are unchanged and that no ordering or label field enters localStorage beyond the existing preferences.

## 5. Test contracts and documentation

- [x] 5.1 Update `tests/viewport-layout.test.ts`, `tests/start-screen.test.ts`, `tests/workspace-qol.test.ts`, `tests/ui-multi-vendor.test.ts`, `tests/docs-attribution.test.ts`, and `tests/theme-tokens.test.ts` deliberately for the global bar, rail reservation, merged actions, toggle placement, and sidebar labels and order. Verify that every changed assertion targets a control that actually moved and that pin configuration and generated-data contracts remain.
- [x] 5.2 Update `README.md` and `AGENTS.md` navigation and layout descriptions to state that one global bar supplies navigation and workspace actions, the rail is reserved, and the new UI state is transient and local. Verify that no statement places UI preferences in share links or project files.

## 6. Integration verification

- [x] 6.1 Run `npm test` and resolve every failure or warning. Verify the command exits zero with the full suite green.
- [x] 6.2 Run `npm run check` and resolve every type or Svelte diagnostic. Verify the command exits zero with no output warnings.
- [x] 6.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm the built app resolves assets under `/pincraft/` with no root-absolute data or asset paths. Verify the command exits zero with no build warnings.

## Workflow follow-up

- After all tracked tasks pass, the implementation agent must run `openspec archive global-top-bar -y`.
- Include the archived spec, proposal, design, and tasks files in the implementation commit and report validation, test, type-check, build, and archive output as evidence.

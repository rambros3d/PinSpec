# Tasks

## 1. Contract and shell structure

- [x] 1.1 Amend `AGENTS.md` shell-routing paragraph to describe the thin h-9 navigation bar plus the workspace-only h-12 action bar, and remove the sidebar-rail and `pinspec:shell_preferences_v1` statements; verify the updated contract text is present
- [x] 1.2 Replace `GlobalSidebar.svelte` with `GlobalNavBar.svelte` mounted once by `AppShell`: Home, Projects, Catalog on the left; Workspace, About info icon, GitHub inline-SVG link, keyboard shortcuts, and `ThemePicker compact` on the right; icon-only below `sm`, accessible names, `aria-current`, and Workspace disabled when no chip or recent session exists; verify shell and accessibility tests pass
- [x] 1.3 Extract `WorkspaceTopBar.svelte` from `GlobalTopBar.svelte` with project-name editor, MCU switcher, undo, redo, Clear All, Compatible MCUs, Compare, Share, Export, and scroll affordance; mount it once in `AppShell` only for workspace and shared routes; keep `topBarUI`, dialog mounts, and all action handlers unchanged; verify top-bar and workspace suites pass

## 2. Layout, overlays, and preferences

- [x] 2.1 Update `src/app.css`: remove `.shell-panel`, `.shell-rail`, `.shell-backdrop`, `--shell-panel-z`, `--shell-backdrop-z`, and the 3rem content padding; set `scroll-padding-top` to `2.25rem`; keep the document viewport lock and portrait dock rules; verify viewport-layout suite passes
- [x] 2.2 Anchor the Clear All confirmation below both bars (`top-[5.25rem]`) and keep its full-reset copy; verify top-bar suite passes
- [x] 2.3 Delete `shell-preferences.svelte.ts` and its storage key, update all consumers and tests, and confirm discovery filters plus theme remain the only localStorage view preferences with no new share or project field; verify preference and core-IO suites pass

## 3. Verification and closeout

- [x] 3.1 Update static shell tests deliberately to target the new components and two-bar layout, including the GitHub anchor, About info icon, icon-only breakpoint, and removed recent list; confirm no coverage is deleted
- [x] 3.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm STM32 behavior, share/project schemas, dialog ownership, and generated data are unchanged and no dependency was added
- [x] 3.3 Run `openspec validate thin-top-bar-navigation --strict`, archive with `openspec archive thin-top-bar-navigation -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push code, specs, and archive artifacts

# Tasks

## 1. Bar refinements

- [x] 1.1 Reduce `GlobalNavBar.svelte` from `h-9` to `h-8`, center the Workspace control in a middle region, hide that region on workspace/shared routes, and keep the enabled/disabled derivation; verify shell and viewport suites pass
- [x] 1.2 Make GitHub and keyboard-shortcut controls icon-only at every width with `btn-square`; verify global shell and shortcut suites pass
- [x] 1.3 Show the app icon plus `PinSpec` name in the thin bar on non-workspace routes while keeping the app icon only in `WorkspaceTopBar.svelte` on workspace/shared routes; verify shell and icon suites pass

## 2. Offsets and contract

- [x] 2.1 Change both `scroll-padding-top` declarations in `src/app.css` to `2rem` and the Clear All confirmation to `top-20`; verify viewport and top-bar suites pass
- [x] 2.2 Update `AGENTS.md`, README, specs, and static shell tests for the h-8 bar, centered conditional Workspace control, icon-only resources, and route-specific identity; verify `npm test` passes
- [x] 2.3 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no share, project, solver, or generated-data change and no new dependency
- [x] 2.4 Run `openspec validate top-bar-refinements --strict`, archive with `openspec archive top-bar-refinements -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

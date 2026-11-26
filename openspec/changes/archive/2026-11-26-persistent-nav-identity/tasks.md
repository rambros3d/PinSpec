# Tasks

## 1. Persistent identity

- [x] 1.1 Remove the workspace condition around the centered app icon and name in `GlobalNavBar.svelte`, keeping the Workspace control conditional; verify shell and viewport suites pass
- [x] 1.2 Update AGENTS.md, README, specs, and static shell assertions so identity is global and only the Workspace control is route-specific; verify `npm test` passes
- [x] 1.3 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no behavior, persistence, or generated-data change and no new dependency
- [x] 1.4 Run `openspec validate persistent-nav-identity --strict`, archive with `openspec archive persistent-nav-identity -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

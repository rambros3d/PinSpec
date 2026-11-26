# Tasks

## 1. Bar balance

- [x] 1.1 Move the identity block from the left group into the centered region and restore the Workspace control at the start of the right group in `GlobalNavBar.svelte`, keeping both conditional on non-workspace routes; verify shell and viewport suites pass
- [x] 1.2 Update `AGENTS.md`, README, specs, and static shell assertions for the swapped region roles; verify `npm test` passes
- [x] 1.3 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no behavior, persistence, or generated-data change and no new dependency
- [x] 1.4 Run `openspec validate top-bar-balance --strict`, archive with `openspec archive top-bar-balance -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

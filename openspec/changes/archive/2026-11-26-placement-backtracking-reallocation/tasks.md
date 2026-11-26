# Tasks

## 1. Backtracking reallocation

- [x] 1.1 Replace the greedy per-signal loop in `reallocatePeripheralPlacement` with candidate groups and `searchBacktracking`, keeping locked pins satisfied and preserving the previous assignment when a signal has no pick; add host tests for lock-in, locked immovability, and no-pick preservation; verify `npm test` and `npm run check` pass
- [x] 1.2 Move custom labels with assignments when the chosen pin changes; add tests for label movement and no stale label; verify placement and core-IO suites pass
- [x] 1.3 Confirm matrix reallocation, scoring terms, candidate caps, and disabled-preference byte stability are unchanged; verify solver and multi-vendor suites pass

## 2. Verification and closeout

- [x] 2.1 Update static placement source tests deliberately for the backtracking path, preserving ring, allocation, persistence, and rotation coverage; verify `npm test` passes
- [x] 2.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no share/project schema, data, exporter, dialog, or shell change and no new dependency
- [x] 2.3 Run `openspec validate placement-backtracking-reallocation --strict`, archive with `openspec archive placement-backtracking-reallocation -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

# Tasks

## 1. Core types and geometry

- [x] 1.1 Add the placement preference type (angle, ring, enabled) and additive optional placement fields to `WorkspaceState` in `src/core/types.ts` with a doc comment naming the rationale; verify `npm run check` passes with no type errors
- [x] 1.2 Add a pure geometry helper under `src/core/` that derives per-pin angle and radius from the package centre using `sides` plus ordered pin positions and `rows`/`cols`, with a graceful finite fallback for two-sided packages; verify unit tests for perimeter, grid, and two-sided packages pass under `npm test`

## 2. Scoring, ring ordering, and live reallocation

- [x] 2.1 Extend `computePinScarcityScore()` with an optional additive affinity term that is zero when placement is disabled; verify a regression test shows placement-off allocations, assignments, and scores are byte-identical to the baseline across `allocatePeripheralMode()`, `togglePeripheralSignal()`, and `findOneHopFixForSignal()`
- [x] 2.2 Implement strict inter-ring ordering (inner before middle before outer) and weighted intra-ring angular plus radial scoring that prefers outer balls on BGA/grid packages; verify unit tests for ring ordering and angle/radius selection pass with `npm test`
- [x] 2.3 Implement the live reallocation path that reallocates only the affected peripheral on a placement change and filters `WorkspaceState.locked` pins out of every candidate set; verify a unit test shows locked pins keep their assignments through a simulated drag

## 3. Persistence across all version-2 surfaces

- [x] 3.1 Add placement fields to `cloneWorkspaceState()`, `statesEqual()`, and a shared normalizer that supplies disabled defaults when fields are absent; verify unit tests for clone, equality, and absent-field normalization pass with `npm test`
- [x] 3.2 Add additive optional placement fields to `CompactUrlPayload`/`url-state.ts` and `PinCraftProjectFile`/`json.ts` without a version bump or v1 path; verify share-URL and project-JSON round-trip tests restore angle, ring, and enabled flag with `npm test`
- [x] 3.3 Persist placement preferences and the overlay toggle in `localStorage` sessions; verify a session save/load round-trip test restores all placement fields with `npm test`

## 4. Toggleable canvas overlay

- [x] 4.1 Add a toggleable placement overlay on the pin canvas showing three concentric rings with selectable, draggable peripheral indicators (inner highest, outer lowest), a ring selector, keyboard/numeric angle input, and labels, feeding claimed pins through the existing `highlightedPins` set; verify the overlay renders cleanly in both themes at the supported zoom range with no STM32 rendering regression
- [x] 4.2 Wire drag and numeric input events to the live reallocation path and persist the overlay toggle with workspace state; verify that dragging updates assignments in real time, locked pins remain untouched, and the toggle and placement survive reload with `npm test`

## 5. Integration verification

- [x] 5.1 Run `npm test` and confirm the full unit suite passes with no failures
- [x] 5.2 Run `npm run check` and confirm strict type checking passes with zero warnings
- [x] 5.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm a clean production subpath build with no broken `/data/` or `/assets/` requests

## Workflow follow-up

- After all tracked tasks and verification are green, archive the change with `openspec archive pin-placement-affinity -y` and verify the archived result
- Include the archived spec and changed files in the implementation commit; do not commit `.cache/`, `public/data/`, `dist/`, or `node_modules/`

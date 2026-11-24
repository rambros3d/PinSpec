# Tasks

## 1. Prerequisite, shared search, and synthetic matrix chips

- [ ] 1.1 Confirm the sibling capability `esp32-schema-and-core-mux` is implemented before coding: verify with `openspec list --specs` that its capability is present and with `npm run check` that the matrix mux model, ESP32 hazard evidence, ESP32 diagnostic codes, and channel `resourceId` fields are available in `src/core/types.ts`. If any are absent, stop and implement that change first.
- [ ] 1.2 Extract the backtracking loop in `src/core/solver.ts` into a pure shared helper parameterized by candidate lists, scoring, an optional legality predicate, and a used-resource set, preserving MRV order, `MAX_NODES = 2500`, branch cap 8, partial-allocation fallback, and score tie-breaks; have `allocatePeripheralMode()` delegate to it. Verify that `tests/core-solver.test.ts` and the byte-identical baseline assertions in `tests/pin-placement-affinity.test.ts` still pass with `npm test`.
- [ ] 1.3 Build synthetic matrix chips in `tests/pin-placement-affinity.test.ts` with 20 to 40 candidate pins per signal, strapping, input-only, ADC2, and flash/PSRAM reserved hazard facts, LEDC/RMT/GDMA `resourceId` values, and a chip omitting hazard fields. Verify `buildPinGeometryMap` yields a finite angle and radius for every synthetic pin and that the fixture is used by the matrix tests added below.

## 2. Pure legality, electrical penalty, and alternate cap helpers

- [ ] 2.1 Add a pure electrical penalty helper in `src/core/placement.ts` that derives deterministic penalties from chip shard hazard facts for boot-strapping, input-only output use, ADC2 with Wi-Fi or Bluetooth active, and flash/PSRAM reservation, with a zero penalty when hazard data is absent; leave `placementAffinityForPin` unchanged. Verify with `tests/pin-placement-affinity.test.ts` that penalty ordering beats geometry, that absent fields produce zero, and that the helper has no Svelte or DOM import.
- [ ] 2.2 Add a pure matrix candidate legality predicate in `src/core/placement.ts` that rejects duplicate signals, repeated channel `resourceId` values, locked pins, and disqualifying hazards. Verify with `tests/pin-placement-affinity.test.ts` that illegal and locked candidates are excluded for synthetic matrix chips and that the non-matrix path is not affected.
- [ ] 2.3 Add a deterministic alternate ranking helper in `src/core/placement.ts` that applies a fixed cap of 12 after legality filtering and orders by legality, electrical penalty, angular/radial affinity, then physical position. Verify with `tests/pin-placement-affinity.test.ts` that an oversized candidate set is capped, illegal pins are absent, and two identical queries return identical order.

## 3. Matrix reallocation and post-allocation validation in the solver

- [ ] 3.1 Implement a matrix-aware reallocation function in `src/core/solver.ts` that uses the shared backtracking helper with legality-filtered candidates, locked pins treated as satisfied signals, a used-pin set, a used-resource set, and ranking by electrical penalty then the unchanged placement affinity term. Leave `reallocatePeripheralPlacement` unchanged. Verify with `tests/pin-placement-affinity.test.ts` that a synthetic matrix chip yields a complete legal plan, that the search backtracks past a greedy-only collision, and that no locked pin moves.
- [ ] 3.2 Add a post-allocation validation pass in `src/core/solver.ts` that reports DUPLICATE_SIGNAL, RESOURCE_CONFLICT with both pins, and the ESP32 diagnostics supplied by the sibling capability, without mutating assignments during a preview. Verify with `tests/pin-placement-affinity.test.ts` that duplicate signals, channel collisions, and hazard evidence are reported with the correct pins and that preview state is unchanged.
- [ ] 3.3 Wire mux-model dispatch inside `applyPlacementChange` in `src/state/workspace.svelte.ts` so matrix chips use the new reallocator and all other chips keep the greedy path, with `previewPlacement`, `commitPlacement`, and `cancelPlacementPreview` semantics unchanged. Verify with `tests/pin-placement-affinity.test.ts` that a simulated matrix drag keeps previews legal, creates no undo entry until pointer-up, records exactly one entry on commit, and restores the committed snapshot on cancel.

## 4. Non-regression and focused coverage

- [ ] 4.1 Assert non-matrix non-regression: verify with `tests/pin-placement-affinity.test.ts` and `tests/core-solver.test.ts` that STM32 default assignments, signals, and scores with placement disabled match the pre-change baseline, that the placement term is zero when no preference is enabled, and that a non-matrix drag stays on the greedy path.
- [ ] 4.2 Assert graceful degradation: verify with `tests/pin-placement-affinity.test.ts` that a synthetic matrix chip without hazard fields allocates without penalty or error, that no ESP32 diagnostic appears for non-matrix chips, and that the highlighted alternate list for STM32 is unchanged.

## 5. Full verification and diff review

- [ ] 5.1 Run `npm test` and confirm the full Vitest suite passes with zero failures.
- [ ] 5.2 Run `npm run check` and confirm strict `tsc --noEmit` passes with zero errors.
- [ ] 5.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm the production subpath build succeeds with zero warnings and no broken asset path.
- [ ] 5.4 Run `openspec validate esp32-matrix-placement --strict` and confirm zero validation errors or warnings.
- [ ] 5.5 Review the final diff for ASCII-only text, zero emojis, no marketing language, no Svelte or DOM import in `src/core/`, no generated data or upstream cache change, no schema version bump, and no new dependency, using a changed-file review and a repository grep.

## Workflow follow-up

- After every task passes and all verification is green, the implementation agent runs `openspec archive esp32-matrix-placement -y` and includes the synced `openspec/specs/` delta and the archived change files in the implementation commit.
- Commit and push only after archive, in the format required by `AGENTS.md`, and report validation, test, check, build, and archive output as evidence. This planning task set stops before archive and makes no commit.

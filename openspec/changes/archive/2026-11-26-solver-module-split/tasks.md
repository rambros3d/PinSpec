# Tasks

## 1. Extract phase modules

- [x] 1.1 Create `src/core/solver-modes.ts` with mode templates, `RCC_MODES`, `SIGNAL_ALIASES`, `getModesForPeripheral`, and `resolveCanonicalSignal`, exporting the aliases for the common module; verify `npm run check` passes
- [x] 1.2 Create `src/core/solver-common.ts` with pin lookup, debug/clock metadata, assignment enrichment, signal counts, and `computePinScarcityScore`, importing modes and the existing `placement` helpers; verify `npm run check` passes
- [x] 1.3 Create `src/core/solver-remap.ts` with alternates, remap groups, one-hop fixes, and `MATRIX_ALTERNATE_LIMIT`, importing common and `history`; verify `npm run check` passes
- [x] 1.4 Create `src/core/solver-allocation.ts` with backtracking, mode allocation, signal toggling, and placement reallocation, importing common, modes, remap, and `placement`; verify `npm run check` passes
- [x] 1.5 Create `src/core/solver-diagnostics.ts` with `validateMatrixPlan`, all analyzers, and `evaluateWorkspace`, importing common, modes, remap, and `history`; verify `npm run check` passes

## 2. Barrel and consumers

- [x] 2.1 Replace `src/core/solver.ts` with a barrel re-exporting the original 27 public symbols from the five modules; verify all existing solver imports resolve and `npm test` passes
- [x] 2.2 Update the two static source assertions in `tests/pin-placement-affinity.test.ts` and `tests/core-esp32-matrix.test.ts` to check the new module boundaries and all solver modules for Svelte/DOM imports; add a dedicated boundary contract test; verify `npm test` passes

## 3. Full verification and closeout

- [x] 3.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm solver results, diagnostics, share schema, and STM32 behavior are unchanged and no dependency was added
- [x] 3.2 Run `openspec validate solver-module-split --strict`, archive with `openspec archive solver-module-split -y`, fix any archived spec purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit code, specs, and archive artifacts

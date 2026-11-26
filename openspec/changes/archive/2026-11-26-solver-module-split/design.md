# Design: Solver Module Split

1. **Feature modules follow the solver phases.** `solver-modes.ts` owns the
   declarative mode templates and signal canonicalization. `solver-common.ts`
   owns pin lookup, tag/debug/clock predicates, assignment metadata, signal
   counts, and scarcity scoring. `solver-remap.ts` owns alternates, remap
   groups, and one-hop fixes. `solver-allocation.ts` owns backtracking, mode
   allocation, signal toggling, and placement reallocation.
   `solver-diagnostics.ts` owns `validateMatrixPlan`, the analyzers, and
   `evaluateWorkspace`.

2. **The dependency graph stays one-way.** Common imports modes and the pure
   `placement` and `history` helpers. Remap imports common. Allocation imports
   common, modes, and remap. Diagnostics imports common, modes, and remap.
   `validateMatrixPlan` moves to diagnostics so allocation never needs the
   evaluator. No solver module imports another feature module that imports it
   back, and no module imports Svelte or DOM APIs.

3. **`solver.ts` becomes a barrel only.** It re-exports the same 27 symbols
   that were public before the split. Consumers in `src/state/`, components,
   and tests keep their existing import paths; no import rewrite is needed
   outside the two static source assertions.

4. **Shared helpers are exported from their owning module, not from the
   barrel.** `SIGNAL_ALIASES`, `findRemapOption`, `pinHasTag`, `buildPinMap`,
   and the other cross-phase helpers are exported internally so sibling
   modules can import them without duplicating logic. The barrel exposes only
   the original public surface.

5. **Verification is behavioral and structural.** The full solver, placement,
   multi-vendor, ESP32 matrix, and exporter suites must pass unchanged. A
   dedicated static test asserts each phase lives in its module, the barrel
   exports the original surface, and no DOM or Svelte import appears in any
   solver module.

## Risks / Trade-offs

- Moving code without changing it keeps behavior stable but leaves some
  helper exports wider than their consumer set. The barrel still narrows the
  public API.
- Barrel re-exports keep source compatibility but do not reduce bundle work by
  themselves; future consumers may import feature modules directly.

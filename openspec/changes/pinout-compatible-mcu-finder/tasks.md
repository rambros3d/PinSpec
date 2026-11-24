# Tasks

## 1. Pure compatibility core

- [ ] 1.1 Define the compatibility signature and candidate scoring result types in `src/core/compatibility.ts` (pure TypeScript, no Svelte/DOM imports); verify `tsc --noEmit` passes and the module imports only plain data types.
- [ ] 1.2 Implement signature derivation from a workspace covering assigned pin name/type, power/reset pins, required signals of active modes, and mux model, ignoring labels and locks; verify a unit test shows two workspaces differing only in labels produce equal signatures.
- [ ] 1.3 Implement candidate scoring with exact pin-for-pin, functional, and incompatible classifications plus flash/RAM delta and a deterministic comparator; verify unit tests cover exact match, functional match, memory delta, and stable ordering.
- [ ] 1.4 Implement cross-vendor scoring so each candidate is evaluated under its own mux model (`af`, `remap-group`, `funcsel-pio`); verify unit tests with synthetic STM32, CH32, and RP chip fixtures score candidates across sources and vendors.

## 2. Finder component

- [ ] 2.1 Create `src/components/workspace/CompatibleMcuFinder.svelte` that renders at most 20 ranked candidates with vendor and package filters; verify the rendered candidate count never exceeds 20 when given more than 20 inputs.
- [ ] 2.2 Add bounded shard loading through `catalogStore.loadChip()` with a fixed concurrency of 4 and a generation-token cancellation check on close/unmount; verify a unit test with instrumentation asserts at most 4 in-flight loads and that results after cancellation are discarded.
- [ ] 2.3 Surface a warning naming any candidate whose shard lacks required pin-level data and skip it from results; verify a unit test with an empty-pin fixture shows the warning and excludes the candidate.
- [ ] 2.4 Navigate to a selected candidate via `router.navigateMcu()` without writing to the source workspace store; verify a test asserts source assignments, labels, locks, modes, remaps, and PIO bindings are unchanged after selection.

## 3. Entry point and integration

- [ ] 3.1 Add a toolbar entry point in `TopToolbar.svelte` that opens the finder seeded with the current workspace; verify the finder opens with the active workspace signature and no workspace state changes on open.
- [ ] 3.2 Run project verification (`npm test`, `npm run check`, and the subpath production build); verify all pass with no new warnings and no STM32 regressions.

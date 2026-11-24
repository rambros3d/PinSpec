# Design

## Context

See proposal.md for motivation. `index.json` carries only part-level fields (id, vendor, family, core, package, pin counts, flash/RAM, peripheral counts), so pin compatibility cannot be decided without fetching full chip shards. `catalogStore.loadChip()` lazily fetches and caches shards by uppercase ID with no eviction, so an unbounded scan would grow memory. The app is static with no backend and no new dependency is allowed. Core logic must be pure TypeScript with no Svelte or DOM imports. The hash router exposes `router.navigateMcu()` for navigation.

## Goals / Non-Goals

**Goals:**
- Compute a deterministic compatibility signature and candidate ranking in `src/core/compatibility.ts`.
- Evaluate candidates across STM32, CH32, and RP using each candidate's own mux model.
- Present a bounded, filterable, cancellable candidate list in the workspace.

**Non-Goals:**
- Auto-applying a candidate pinout to or mutating the current workspace.
- Adding a backend, new dependency, or changes to generated catalog data.
- Deciding electrical compatibility beyond pin names/types, required signals, mux model, and memory capacity.

## Decisions

- **Pure scoring module.** `src/core/compatibility.ts` exports pure functions for signature derivation and candidate scoring, taking `WorkspaceState` and `ChipData` values and returning plain data. This keeps ranking deterministically unit-testable and satisfies the core-layer constraint. Alternative: scoring inside the Svelte component, rejected because it would be hard to test and would mix layers.
- **Signature inputs.** The signature covers assigned pin name/type, power/reset pins, required signals of active modes, and mux model; it intentionally ignores labels, locks, and remaps/PIO beyond their effect on required signals. This makes the signature stable under cosmetic edits.
- **Tiered classification.** Candidates are classified as exact pin-for-pin match, functional match, or incompatible, with a flash/RAM delta reported alongside. A deterministic comparator ranks exact above functional and then orders by smaller memory delta and candidate ID. Alternative: a single opaque numeric score, rejected because it hides why a candidate matched.
- **Bounded incremental loading with a concurrency gate.** The finder caps results at 20 and loads shards through `loadChip()` with a fixed concurrency of 4. This bounds both network work and the number of newly cached shards. Alternative: load all shards up front, rejected because of the cache-growth concern and cost.
- **Cancellation via a generation token.** Each load checks a monotonically increasing generation counter before applying results; closing the finder increments it so stale results are discarded. This avoids depending on `AbortController` support in `loadChip()`.
- **Read-only navigation.** Selecting a candidate calls `router.navigateMcu()` only; the source workspace store is never written.

## Risks / Trade-offs

- [Shard cache growth] -> Cap results at 20 and concurrency at 4; document that repeated searches still add entries to the no-eviction cache and keep the cap configurable in one constant.
- [Incomplete candidate shards] -> Treat missing pin data as a per-candidate warning and skip that candidate rather than failing the whole search.
- [Heuristic ranking] -> Keep classification rules explicit and covered by synthetic fixture tests so ranking changes are visible.
- [Cross-vendor mux differences] -> Evaluate each candidate under its own mux model (`af`, `remap-group`, `funcsel-pio`) instead of assuming STM32 AF semantics.

## Migration Plan

Additive only. No state schema change, no generated-data change, and no change to existing routes. Rollback is removal of the new module, component, and toolbar entry.

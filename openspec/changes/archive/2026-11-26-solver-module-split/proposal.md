# Proposal: Solver Module Split

## Why

`src/core/solver.ts` is 2,132 lines and mixes mode templates, pin-scarcity
helpers, remapping, allocation, and diagnostics in one file. Every consumer
imports this single module, so a change to a diagnostic pass also rebuilds the
allocator path, and the seams between pure phases are not visible in the file
layout. The public API and solver behavior are stable; only the source layout
needs to change.

## What Changes

- Split the solver into five pure modules under `src/core/`: mode templates,
  shared pin helpers, remapping and one-hop fixes, allocation and backtracking,
  and diagnostics and workspace evaluation.
- Keep `solver.ts` as a barrel that re-exports the existing 27 public symbols,
  so all application and test imports keep working unchanged.
- Extract shared private helpers into a common module to keep the dependency
  graph acyclic; move read-only `validateMatrixPlan` next to the diagnostics it
  uses.
- Update the two static source assertions that expected allocator functions in
  `solver.ts` itself to check the new module boundaries.
- Keep every function pure TypeScript with no Svelte or DOM import, and keep
  solver results and diagnostic ordering byte-for-byte unchanged.

## Capabilities

- `solver-module-boundaries`

## Out of scope

No solver rule, mode template, diagnostic, generated MCU fact, exporter, UI, or
dependency change. No new state field or share-schema version.

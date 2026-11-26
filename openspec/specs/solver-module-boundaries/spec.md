# solver-module-boundaries Specification

## Purpose

Defines the pure module boundaries of the solver: mode templates, shared pin helpers, remapping, allocation, diagnostics, and a stable barrel API for all consumers.

## Requirements

### Requirement: Solver phases live in separate pure modules

The core solver SHALL be organized into mode, common, remap, allocation, and
diagnostics modules under `src/core/`. Each module SHALL contain only pure
TypeScript with no Svelte or DOM import. Shared helpers SHALL have one owning
module, and module dependencies SHALL form an acyclic graph from modes and
common toward remap, allocation, and diagnostics.

#### Scenario: Phase boundaries are visible in source

- **WHEN** the solver source layout is inspected
- **THEN** mode templates, pin predicates and scarcity scoring, remapping,
  backtracking allocation, and workspace evaluation are each defined in their
  own named module rather than one monolithic file

#### Scenario: No import cycle or DOM dependency

- **WHEN** every solver module is inspected
- **THEN** none imports Svelte or DOM APIs and no feature module imports a module that depends back on it

### Requirement: The solver barrel preserves the public API

`src/core/solver.ts` SHALL be a barrel that re-exports the existing public
solver symbols. Existing imports in application code and tests SHALL continue
to resolve without changes, and solver behavior, diagnostics, and allocation
results SHALL remain identical.

#### Scenario: Existing consumers keep importing the barrel

- **WHEN** the application or a test imports a solver symbol from `src/core/solver.ts`
- **THEN** the symbol resolves through the barrel and behaves exactly as before the split

#### Scenario: Static assertions follow the new modules

- **WHEN** a source contract checks where allocator functions are defined
- **THEN** it inspects the allocation module rather than expecting their definitions inside the barrel

# Proposal

## Why

Live placement reallocation currently picks pins greedily and ranks them by
scarcity plus angular/radial affinity. Matrix-mux chips such as ESP32 expose 20
to 40 candidate pins per signal, so the geometry term dominates without
electrical meaning and the greedy path can select boot-strapping, input-only,
ADC2-while-radio-active, or flash/PSRAM reserved pins. A drag therefore renders
pin plans that cannot be built. The decision for this change is full electrical
correctness from the start, so no live drag ever shows an illegal plan.

## What Changes

- Add a matrix-aware placement reallocation path that uses backtracking over the
  required signals instead of the greedy per-signal path. Legality is a hard
  filter; angular and radial affinity applies only among legal candidates.
- Reject assignments that create a duplicate signal, a shared LEDC/RMT/GDMA
  channel resource conflict, or an ESP32-specific electrical hazard, and run a
  post-allocation validation pass that reports DUPLICATE_SIGNAL,
  RESOURCE_CONFLICT, and the ESP32 diagnostics supplied by the schema and core
  mux capability.
- Apply electrical penalties for boot-strapping pins, input-only pins used as
  outputs, ADC2 pins when Wi-Fi or Bluetooth is active, and flash/PSRAM reserved
  pins. Treat channel `resourceId` values as exclusive resources during search.
- Keep locked pins as hard constraints: exclude them from candidate sets, treat
  their assignments as satisfied signals, and never move or clear them.
- Bound the highlighted alternate-pin list after legality filtering so a large
  matrix candidate set stays usable and deterministic.
- Extend the live drag requirement in `pin-placement-affinity` so matrix previews
  are electrically legal at every step while the existing preview, pointer-up
  commit, and lock semantics remain intact.
- Dispatch by mux model so AF, remap-group, and funcsel-pio chips keep the
  existing greedy path, byte-identical default allocations, and an exactly zero
  placement term when no preference is enabled.
- Add coverage in `tests/pin-placement-affinity.test.ts` using synthetic matrix
  chips. No generated data, adapter, exporter, or schema-version change.

## Capabilities

### New Capabilities

- `esp32-matrix-placement`: Electrically legal live placement for matrix-mux
  chips, covering backtracking reallocation, legality filtering and electrical
  penalties, exclusive channel resources, post-allocation validation, bounded
  alternate lists, hard lock constraints, and unchanged non-matrix behavior.

### Modified Capabilities

- `pin-placement-affinity`: The requirement "Dragging reallocates in real time
  and preserves locked pins" gains matrix-specific guarantees that every
  previewed and committed plan is electrically legal, while its existing drag,
  commit, and locked-pin behavior is retained in full.

## Impact

- Depends on the sibling change `esp32-schema-and-core-mux` (not yet
  implemented). This change consumes its matrix mux model, electrical hazard
  evidence, ESP32 diagnostic codes, and channel resource fields; it does not
  redefine or duplicate that schema.
- Core: `src/core/solver.ts` (shared backtracking helper, matrix reallocation,
  post-allocation validation, bounded alternates), `src/core/placement.ts`
  (pure electrical penalty, legality, and cap helpers), and the existing
  hardware-audit strapping evidence in `src/core/hardware-audit.ts`.
- State: `src/state/workspace.svelte.ts` dispatch inside the existing
  `applyPlacementChange`, with `previewPlacement`, `commitPlacement`, and
  `cancelPlacementPreview` semantics unchanged.
- Tests: `tests/pin-placement-affinity.test.ts` extended with synthetic matrix
  chips; existing solver, core I/O, and multi-vendor tests must stay green.
- No new npm dependency, no Svelte or DOM import in `src/core/`, no data
  pipeline or generated shard change, no project/share schema version bump, and
  no change to the Rust, C, or CSV exporters.

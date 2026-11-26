# Design

## Context

See `proposal.md` for motivation and `specs/` for the behavior contract. The
current placement implementation has two separate concerns:

- `src/core/placement.ts` is geometry-only. `buildPinGeometryMap`,
  `placementAffinityForPin` (`rank * 10000` plus angular and radial terms),
  `orderPeripheralsByPlacement`, `configuredPeripheralNames`, and
  `measuredSafeRadius` take plain data and work unchanged for ESP32 QFN
  packages. `placementAffinityForPin` returns exactly zero when no preference is
  enabled.
- `src/core/solver.ts` uses a greedy live path: `reallocatePeripheralPlacement()`
  clears the dragged peripheral's unlocked pins and picks the lowest-scoring
  free pin per signal. `reallocatePlacementOrdered()` exists but is not wired to
  the UI. `allocatePeripheralMode()` is the real backtracking allocator, using
  MRV signal ordering, `MAX_NODES = 2500`, and a branch cap of 8.
- `src/state/workspace.svelte.ts:402-424` (`applyPlacementChange`) calls
  `reallocatePeripheralPlacement` from both `previewPlacement` (no history) and
  `commitPlacement` (one history entry); `cancelPlacementPreview` restores the
  committed snapshot.
- `src/core/hardware-audit.ts` already reports strapping facts from shard fields
  and vendor tags, so hazard evidence is available without new hardcoded rules.

Matrix chips present 20 to 40 candidate pins per signal. With so many
candidates, the angular/radial term dominates the scarce-signal term and the
greedy path can land on boot-strapping, input-only, ADC2-with-radio, or
flash/PSRAM reserved pins. Live drags therefore show illegal plans.

This change depends on the sibling change `esp32-schema-and-core-mux` (not yet
implemented) for the matrix mux model value, electrical hazard evidence,
ESP32-specific diagnostic codes, and channel `resourceId` fields. This change
consumes those fields with a zero-penalty, no-hazard fallback and does not
redefine the schema. `src/core/` stays pure TypeScript with no Svelte or DOM
import, no new dependency is added, and no project/share schema version bump or
generated data regeneration is performed.

## Goals / Non-Goals

**Goals:**

- Give matrix chips a live reallocation path that returns only electrically
  legal plans at every drag step, using backtracking rather than greedy picks.
- Filter illegal candidates before search and apply electrical penalties before
  angular/radial affinity, with locked pins as hard constraints.
- Enforce exclusive LEDC/RMT/GDMA channel resources and validate the final plan
  for duplicate signals, resource conflicts, and ESP32 diagnostics.
- Bound the alternate-pin list deterministically for large candidate sets.
- Keep non-matrix chips byte-identical in default allocation and scoring.

**Non-Goals:**

- No new schema fields, mux model values, diagnostic codes, or mux metadata;
  these come from `esp32-schema-and-core-mux`.
- No adapter, data-gen, gate, generated shard, or exporter change.
- No wiring of `reallocatePlacementOrdered()` into the UI.
- No change to the overlay, drag gesture, persistence surfaces, or undo/redo
  semantics.
- No new dependency, no Svelte or DOM code in `src/core/`, no v1 compatibility
  path.

## Decisions

1. **Dispatch by mux model at the reallocation boundary.** Add a matrix-specific
   reallocation function and select it in `applyPlacementChange` only when the
   chip's effective mux model is the matrix value supplied by the sibling
   change. `reallocatePeripheralPlacement` remains the path for all other chips.
   The existing mux-model resolver defaults absent vendor and mux-model fields
   to `af`, so every current STM32, CH32, and RP chip stays on the legacy path.
   Alternative: add matrix branches inside `computePinScarcityScore`, which is
   shared by mode allocation, signal toggling, and one-hop fixes; rejected
   because it would put vendor-specific behavior into the STM32 hot path and
   risk byte-level regressions.

2. **Extract one shared backtracking search.** Pull the search loop out of
   `allocatePeripheralMode()` into a pure helper in `src/core/` parameterized by
   candidate lists, a scoring function, an optional legality predicate, and a
   resource-exclusion set. Keep MRV ordering, `MAX_NODES = 2500`, branch cap 8,
   partial-allocation fallback, and score tie-breaks identical. Have
   `allocatePeripheralMode()` delegate to the helper so its behavior does not
   change, and have the matrix reallocator supply its own candidate lists.
   Alternative: call `allocatePeripheralMode()` after clearing the peripheral;
   rejected because it only fills signals missing from a mode template and
   would ignore ad-hoc per-signal assignments created from the pin popover.

3. **Legality is a hard filter, not a large negative score.** Build candidate
   lists by removing pins that would duplicate a signal, collide on a
   `resourceId`, violate a locked pin, or carry a disqualifying hazard. The
   search then ranks survivors by electrical penalty, then the unchanged
   `placementAffinityForPin` geometry term, then physical position. A separate
   post-allocation validation pass re-checks the result and reports
   DUPLICATE_SIGNAL, RESOURCE_CONFLICT, and sibling-provided ESP32 diagnostics
   without mutating state. Alternative: a big illegal penalty in the score;
   rejected because scoring is comparative and could still choose an illegal
   pin when no legal alternative exists, which would violate the no-illegal-plan
   rule.

4. **Electrical penalties are pure and data-derived.** Add a pure helper in
   `src/core/placement.ts` that reads hazard facts from chip shard fields
   (pin tags, notes, signal metadata, and the sibling hazard fields) and returns
   a deterministic penalty for boot-strapping, input-only output use,
   ADC2-with-radio, and flash/PSRAM reservation. Strapping classification is
   consistent with `hardware-audit.ts` evidence but the allocator reads chip
   data directly so it remains deterministic and host-testable. Absent hazard
   data yields a zero penalty. Alternative: an MCU allowlist; rejected because
   it needs per-MCU hardcoding and would break synthetic chip tests.

5. **Channel resources join the used set.** During matrix search, maintain a
   `usedResources` set beside `usedPins`. A candidate whose `resourceId`
   (LEDC, RMT, or GDMA channel) is already used is skipped. Any collision that
   still reaches the result is reported by the validation pass as
   RESOURCE_CONFLICT with both pins. Non-matrix chips ignore this set.

6. **Locks stay at the candidate boundary.** Locked pins are removed from every
   matrix candidate list before search, and their assignments enter the search
   as satisfied signals. `previewPlacement`, `commitPlacement`, and
   `cancelPlacementPreview` keep their current history behavior: no undo entry
   during a drag, one entry on pointer-up, and a committed-snapshot restore on
   cancel.

7. **Bounded, deterministic alternate list.** The alternate builder used by pin
   popovers applies a fixed cap of 12 entries for matrix signals after illegal
   and locked candidates are removed. Ordering is legality, electrical penalty,
   geometry affinity, then physical position. The cap applies only to matrix
   chips, so the existing alternate list for STM32, CH32, and RP is unchanged.

8. **Non-regression is structural and tested.** The shared scoring hook,
   `reallocatePeripheralPlacement`, `reallocatePlacementOrdered` (still unwired),
   and all exporters stay untouched. Tests compare pre-change baseline
   allocations for representative STM32 packages with placement disabled and
   assert a zero placement term across vendors. Alternative: a single unified
   allocator for all mux models; rejected as unnecessary risk to the STM32
   release contract.

## Risks / Trade-offs

- [Backtracking cost with 20 to 40 candidates per signal] Mitigation: keep MRV
  ordering, branch cap 8, and node cap 2500; precompute candidate lists and the
  pin geometry map once per drag update; cover an 80-pin synthetic matrix chip
  in tests.
- [Sibling schema is not implemented yet] Mitigation: consume optional fields
  with a zero-penalty, no-hazard fallback; use synthetic matrix chips in tests;
  make sibling availability the first tracked task and stop if it is absent.
- [Legality filtering can leave signals unallocated mid-drag] Mitigation: report
  unallocated signals through the existing diagnostics and allocation result;
  never render an illegal assignment, and let validation confirm the final
  plan.
- [Extracting the shared search could regress STM32] Mitigation: the delegated
  `allocatePeripheralMode()` keeps the same ordering, caps, scoring, and partial
  fallback; existing solver tests plus byte-identical baseline assertions must
  stay green.
- [Mux model default could misclassify legacy chips] Mitigation: rely on the
  existing resolver default of `af` for absent vendor and mux-model fields, and
  assert that a chip with no matrix marker takes the greedy path.
- [Hazard facts and diagnostic codes could drift from the sibling spec]
  Mitigation: validation reports only codes supplied by the sibling capability
  plus the existing DUPLICATE_SIGNAL and RESOURCE_CONFLICT codes, so this
  change never redefines diagnostic identity.

## Migration Plan

1. Confirm the sibling `esp32-schema-and-core-mux` capability is present; stop
   before coding if it is not.
2. Extract the shared backtracking helper and delegate
   `allocatePeripheralMode()` to it, with baseline tests green.
3. Add pure electrical penalty, legality, and bounded-alternate helpers in
   `src/core/placement.ts`, plus the synthetic matrix chips in
   `tests/pin-placement-affinity.test.ts`.
4. Implement matrix reallocation and post-allocation validation in
   `src/core/solver.ts`, then dispatch from
   `src/state/workspace.svelte.ts`.
5. Verify non-regression, then run `npm test`, `npm run check`, and
   `BASE_PATH="/pinspec/" npm run build`; fix warnings before closeout.
6. The implementation agent archives this change with
   `openspec archive esp32-matrix-placement -y` and includes the synced spec and
   archived change files in the implementation commit. This planning task set
   stops before archive and makes no commit.

No data regeneration, schema migration, or UI migration is needed. Rollback is
to remove the mux-model dispatch and leave the pure helpers unused; all
non-matrix behavior and the shared backtracking extraction remain valid.

## Open Questions

None. The dependency sequencing with `esp32-schema-and-core-mux` is a task
prerequisite, not a spec-level or design-level unknown.

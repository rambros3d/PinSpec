# Proposal: Pin Placement Affinity

## Why

The auto-allocator currently ranks candidate pins only by scarcity, so an
engineer cannot express a preferred physical placement for a peripheral.
Connector-facing and board-layout-driven pin planning is therefore manual. This
change adds an opt-in placement affinity that expresses placement preference
through concentric priority rings and angular/radial position while leaving
default allocation unchanged.

## What Changes

- Add a pure geometry helper that derives each pin's angle and radius from the
  package centre using `PackageInfo.sides` and the ordered pin positions. It
  handles perimeter, grid, and two-sided packages (`[N/2, 0, N/2, 0]`) without
  per-MCU hardcoding and falls back gracefully where top/bottom pins are absent.
- Extend `WorkspaceState` with a placement map keyed by peripheral, recording an
  angle, a ring, and an enabled flag.
- Add an optional additive placement term to `computePinScarcityScore()`, the
  single scoring hook used by `allocatePeripheralMode()`,
  `togglePeripheralSignal()`, and `findOneHopFixForSignal()`. When placement is
  disabled the term is zero and existing allocations remain byte-identical.
- Implement hybrid ring priority: strict ordering between rings (inner ring
  allocated before middle, middle before outer) and weighted angular-distance
  scoring within a ring, combined with radial distance from the package centre
  so outer balls of BGA/grid packages are preferred for connector-facing
  placement.
- Add a toggleable overlay on the pin canvas (not a permanent overlay and not a
  separate panel). The overlay shows three concentric rings with a draggable,
  selectable peripheral indicator per peripheral. Ring priority is inner
  highest, outer lowest. The overlay provides a ring selector, keyboard/numeric
  angle input, and labels, and reuses `highlightedPins` to show pins claimed by
  the selected peripheral.
- Reallocate pins dynamically in real time as a peripheral indicator is
  dragged. Pins the user has explicitly pinned or locked are never touched by
  the live reallocation path.
- Persist all placement settings in workspace state, undo/redo history,
  `localStorage` sessions, share URLs (version 2 compact payload), and project
  JSON (version 2). Use additive optional fields at version 2 rather than
  bumping the schema version. No setting is session-only.
- Add unit tests proving default allocations are unchanged, ring ordering is
  strict, angle+radius scoring is applied within a ring, persistence round-trips
  through URL/JSON/history, and locked pins are preserved during live
  reallocation.

Out of scope: this change does not alter data adapters or generated shards, and
it does not change the Rust, C, or CSV exporters for placement. Placement is
persisted only through workspace state, share URLs, and project JSON.

## Capabilities

### New Capabilities

- `pin-placement-affinity`: Opt-in, persisted placement preferences that bias
  pin allocation by circular ring priority and angular/radial distance, exposed
  through a toggleable canvas overlay with live, lock-preserving reallocation.

### Modified Capabilities

None.

## Impact

Affected code: `src/core/types.ts`, `src/core/solver.ts`, `src/core/history.ts`,
`src/core/url-state.ts`, `src/core/exporters/json.ts`, a new pure geometry/
scoring helper under `src/core/`, `src/state/workspace.svelte.ts` and its
`localStorage` session serialization, and workspace UI in `PackageCanvas.svelte`,
`PerimeterPackage.svelte`, `GridPackage.svelte`, plus a new overlay component and
`tests/`. No new npm dependency. `src/core/` remains pure TypeScript with no
Svelte or DOM imports. Data adapters, generated shards, and non-JSON exporters
are unchanged.

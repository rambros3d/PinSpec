# Design

## Context

See `proposal.md` - Why for the motivation. The current allocator ranks
candidate pins only through `computePinScarcityScore()` in `src/core/solver.ts`,
the single scoring hook shared by `allocatePeripheralMode()`,
`togglePeripheralSignal()`, and `findOneHopFixForSignal()`. Package geometry is
already available as `PackageInfo.sides = [left, bottom, right, top]` plus
ordered pin positions for perimeter packages and `rows`/`cols` for grid
packages. The renderers already receive a `highlightedPins: Set<string>` through
`PackageCanvas.svelte`. Workspace state is a strict version-2 schema with no v1
import path, and placement must be added as additive optional fields rather than
a new version. `src/core/` must remain pure TypeScript with no Svelte or DOM
imports, and no new npm dependency is needed.

## Goals / Non-Goals

**Goals:**

- Derive per-pin angle and radius from the package centre with one pure helper
  that works for perimeter, grid, and two-sided packages.
- Add an optional additive affinity term to the shared scarcity hook that is
  exactly zero when placement is disabled.
- Store a per-peripheral placement map (angle, ring, enabled) in workspace state
  and persist it through history, `localStorage`, share URLs, and project JSON.
- Provide a toggleable canvas overlay with draggable indicators on three
  concentric rings, a ring selector, keyboard/numeric angle input, and labels.
- Recompute allocation live during a drag without ever moving a locked pin.
- Verify default allocations are byte-identical when placement is off.

**Non-Goals:**

- No change to data adapters, generated shards, or any `tools/data-gen/` code.
- No change to the Rust, C, or CSV exporters for placement.
- No schema version bump and no v1 compatibility path.
- No session-only settings; no new npm dependency; no DOM/Svelte code in
  `src/core/`.

## Decisions

- **Single additive scoring hook.** Extend `computePinScarcityScore()` with an
  optional affinity term parameter. The default call path passes no term, so the
  numeric result and allocation order are unchanged. This preserves STM32 and
  all-vendor default behavior byte-for-byte and avoids forking the three call
  sites. Alternative: a separate scoring pipeline for placement would duplicate
  allocator logic and risk drift.
- **Pure geometry helper in core.** A new pure module derives angle and radius
  from package centre using `sides` and ordered pin positions for perimeter
  packages and `rows`/`cols` for grid packages. Two-sided packages
  (`[N/2, 0, N/2, 0]`) have no top/bottom pins, so the helper maps their pins
  onto the left/right sides and always returns finite angle and radius values.
  Alternative: storing precomputed coordinates per MCU would require generated
  data changes, which are out of scope.
- **Hybrid ring priority.** Inter-ring ordering is strict: inner before middle
  before outer, applied before scarcity when a preference is enabled. Intra-ring
  ranking is a deterministic weighted score combining angular distance and,
  where relevant, radial distance from the package centre so outer balls of
  BGA/grid packages are favored. Unconfigured peripherals keep scarcity-only
  ranking. Alternative: a single blended score across all rings would let a
  scarce outer pin outrank an inner-ring preference and break the user's
  explicit priority signal.
- **Per-peripheral placement map.** Workspace state gains an additive optional
  map keyed by peripheral: `{ angle, ring, enabled }`. The overlay toggle is
  persisted in the same state. Absent fields are normalized to disabled at read
  time. Alternative: a separate top-level store would fragment persistence and
  break undo/redo and share-link parity.
- **One persistence surface updated together.** `WorkspaceState`,
  `cloneWorkspaceState()`, `statesEqual()`, `CompactUrlPayload`/`url-state.ts`,
  `PinCraftProjectFile`/`json.ts`, and the `localStorage` session serializer are
  updated in one pass with additive optional fields at version 2. A single
  shared normalizer supplies defaults when fields are missing, so every surface
  interprets older payloads identically.
- **Overlay reuses existing highlight plumbing.** A toggleable overlay component
  layered on the pin canvas draws three rings and one draggable indicator per
  enabled peripheral. Selection feeds the existing `highlightedPins` set so
  claimed pins render with the established highlight color. Ring selector,
  number input, and labeled indicators provide non-drag control. The toggle
  state persists with the placement map.
- **Live reallocation via the real allocator.** Drag and numeric input events
  update the placement angle/ring and immediately re-run allocation for the
  affected peripheral through the same authored allocator path, skipping every
  pin in `WorkspaceState.locked`. Locked pins are filtered before candidate
  ranking, so they cannot be claimed or cleared. Each committed drag is a single
  history entry to avoid flooding undo/redo. Alternative: mutating assignments
  directly on drag would bypass solver invariants and diagnostics.

## Risks / Trade-offs

- [Continuous reallocation during drag could be expensive] -> The scoring hook
  is linear in pin count and the drag path reallocates only the affected
  peripheral; recompute on animation frames rather than every pointer event is
  an implementation detail that introduces no persisted setting.
- [Locked pins could be disturbed by ring switching] -> Filter locked pins out
  of the candidate set before ranking in every placement-driven allocation
  path, and keep them fixed through the drag.
- [Two-sided geometry could mislead angular preference] -> The helper returns
  finite positions mapped to the left/right sides; scoring remains deterministic
  and degrades gracefully rather than failing.
- [Default behavior could drift accidentally] -> The additive term is exactly
  zero when disabled, and a regression test compares placement-off allocations
  against the current baseline for representative packages.

## Migration Plan

Placement fields are additive and optional, so existing version-2 workspace
state, share URLs, and project files remain valid and load with placement
disabled. No version bump, data regeneration, or user migration is required.
Rollback is to stop rendering the overlay and ignore the optional fields; the
default allocation path is unaffected.

## Open Questions

None.

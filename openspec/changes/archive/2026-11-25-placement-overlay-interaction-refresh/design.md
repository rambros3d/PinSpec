# Design

## Context

Placement affinity is an existing opt-in capability under
`openspec/specs/pin-placement-affinity/`. Its scoring term in
`src/core/placement.ts` returns zero unless a peripheral has an enabled
preference, and its ordering hook keeps unconfigured peripherals at the end.
The workspace state is version 2; additive optional fields are already used for
remaps, PIO bindings, GPIO config, placement, dock tab, and overlay visibility.

The current overlay in `src/components/workspace/PlacementOverlay.svelte`
accepts a ring through a `<select>` element and sends it through an `onRing`
callback handled in `src/components/workspace/PackageCanvas.svelte`.
`placementIndicators` in `PackageCanvas.svelte` is built from preference keys
plus assigned peripherals, so unconfigured peripherals cannot be enabled, and
assigned peripherals show an indicator without having opted in. The toggle lives
in the top-right view HUD. Drag updates only the angle through
`previewPlacement` and `commitPlacement` on the workspace store.

Constraints from `AGENTS.md`: core stays pure TypeScript, all settings are
persisted across history, sessions, share links, and project JSON, no emojis,
no version bump for additive fields, and default STM32 allocation behavior must
not regress.

## Goals / Non-Goals

**Goals:**

- Make ring indicators represent an explicit opt-in decision per peripheral.
- Let users enable any allocatable peripheral from the placement panel.
- Replace the ring dropdown with drop-radius selection plus keyboard parity.
- Move the overlay toggle to an independent top-centre canvas control.
- Add an overlay-only rotation with a persisted display-only value.
- Tighten ring spacing and enlarge the outer ring.

**Non-Goals:**

- Changing scoring weights, `PLACEMENT_RING_RANK`, `buildPinGeometryMap`, or
  `placementAffinityForPin`.
- Changing default allocation output for workspaces with no enabled placement.
- Changing data generation, catalog gates, or non-JSON exporters.
- Changing package rotation, pan, zoom, remap mode, or pin click behavior.
- Introducing a schema version bump or a v1 import path.

## Decisions

### 1. Indicators come only from enabled preferences

Derive `placementIndicators` from `placementSettings.preferences` entries whose
`enabled` flag is true, instead of unioning preference keys with assigned
peripherals. A peripheral that is assigned but has no enabled preference stays
out of the rings. The `claimed` list still comes from assignments so the
existing highlight set keeps working.

Alternative considered: keep assigned peripherals as indicators with a null
preference and label them as disabled. Rejected because it violates explicit
opt-in and lets a default allocation appear to be placement-driven.

### 2. Selector covers allocatable plus assigned system peripherals

Build the selector options from keys of `chip.peripherals` whose `signals`
array is non-empty, excluding `GPIO`, then add any peripheral named in an
assignment whose chip entry has kind `sys` or that has no assignable signals.
Deduplicate by name and sort with the existing locale-aware numeric comparator.
For a selected peripheral with no preference, show an explicit enable action
that calls `setPlacement` with `{ angle: 0, ring: 'outer', enabled: true }`.

Alternative considered: derive options from pin signals instead of
`chip.peripherals`. Rejected because it drops system peripherals that hold
assignments but expose no assignable signals.

### 3. Ring is derived on drop, with keyboard parity

Remove `onRing`, `handlePlacementRing`, and the ring `<select>`. On pointer
move, compute the pointer radius as `hypot(dx, dy)` in stage coordinates and
pick the ring whose `radius * RING_FACTORS[ring]` is nearest, then send the
combined angle and ring through `onAngle` as a preview. On pointer-up, send the
final angle and ring once as a commit. Both callbacks keep the existing
`(name, angle, commit)` shape extended with a ring argument, so the workspace
store still routes previews to `previewPlacement` and commits to
`commitPlacement`, preserving single-entry undo history.

Keyboard handling on an indicator keeps `ArrowLeft` and `ArrowRight` for
five-degree angle steps and adds `Shift+ArrowUp` and `Shift+ArrowDown` to move
one ring inward or outward, clamped at the ends. Ring changes go through the
same commit path as angle changes. Ring circles and labels stay inside the
existing `pointer-events-none` SVG layer so pin clicks, hover, and context menus
are unaffected.

Alternative considered: commit a history entry on every ring preview. Rejected
because it duplicates the existing preview/commit contract and would flood the
undo stack.

### 4. Ring factors and drawing geometry

Keep `RING_FACTORS` local to `PlacementOverlay.svelte` and change it from
`0.34 / 0.66 / 0.96` to `0.50 / 0.72 / 0.98`. This reduces both adjacent gaps
from roughly 0.32 of the overlay radius to roughly 0.22 and 0.26, while
increasing the outer radius. The values are display-only; scoring geometry is
derived from package coordinates in `src/core/placement.ts` and is untouched.
`PLACEMENT_RINGS` and `PLACEMENT_RING_RANK` keep their order and names.

### 5. Toggle placement

Remove the placement button from the top-right view HUD in
`PackageCanvas.svelte` and add an independent top-centre control stacked with
the remap banner near the existing `top-3 left-1/2 -translate-x-1/2` pattern.
The control keeps the `Crosshair` icon, `aria-pressed`, the persisted
`placementOverlayVisible` flag, and the call to `setPlacementOverlayVisible`.
When the overlay closes, `selectedPlacementPeripheral` is cleared as before.

### 6. Display-only overlay rotation

Add an optional `placementOverlayRotation?: number` field to `WorkspaceState`,
normalized through the existing `normalizeAngle` helper and applied only inside
`PlacementOverlay.svelte`. `pointFor` uses `preference.angle + rotation` when
computing the display position; `angleFromEvent` subtracts the rotation before
returning the stored angle. Ring derivation uses radius only, so it is
unaffected. The rotate button cycles the value in 90-degree steps in the
overlay panel header.

Persistence is additive with no schema bump:

- `cloneWorkspaceState` copies the field when defined; `statesEqual` compares
  normalized values so absent and zero are equivalent.
- `url-state.ts` emits a compact degree key only for non-zero values and
  restores it through `normalizeAngle` on decode.
- `exporters/json.ts` writes the field only when non-zero and parses it with
  the same normalizer on import.
- `localStorage` recent sessions store the cloned workspace state, so the field
  is covered without a separate serializer.
- `workspaceStore.setPlacementOverlayRotation()` commits one history entry,
  matching `setPlacementOverlayVisible`.

Alternative considered: rotating the stored preference angles. Rejected because
it would change scoring geometry and default allocations, and would make the
same project allocate differently after a display-only view change.

### 7. Tests

Update the static wiring assertions in `tests/pin-placement-affinity.test.ts`:
replace the `onRing` token with tokens for the ring derivation callback and
rotation button, and keep `PLACEMENT_RINGS`, `setPointerCapture`,
`type="number"`, `indicator.name`, `set.add(pos)`, `PlacementOverlay`, and
`setPlacementOverlayVisible`. Add persistence assertions for the rotation field
through history, share links, project JSON, and sessions, plus deterministic
assertions that rotation does not change placement scoring or allocation.

## Risks / Trade-offs

- Ring radii may overlap package pins, making it harder to tell a ring from a
  pin. Mitigation: dashed outer ring, low-opacity strokes, and non-interactive
  circles so the pin under the cursor still receives events.
- Previewing allocation on every pointer move reuses the existing reallocation
  path. Mitigation: keep preview uncommitted and commit only on pointer-up, as
  the current angle drag already does.
- A rotated overlay can make the numeric angle input appear offset from the
  drawn indicator. Mitigation: keep the numeric field bound to the stored
  package-coordinate angle and label the rotation as overlay-only in the panel.
- Adding a field to several serializers can drift across surfaces. Mitigation:
  share `normalizeAngle` and test all four persistence surfaces in one case.
- Static string assertions in the wiring test are brittle. Mitigation: update
  the affected tokens in the same task as the component changes.

## Migration Plan

No data migration is needed. Older version-2 payloads omit the rotation field
and decode as zero. Overlay indicator derivation changes from
preference-or-assignment to enabled-only; users who want an assigned peripheral
on the rings enable it once from the selector. Rollback consists of restoring
the previous two component files and removing the additive field from the
serializers; stored state from this change remains readable because the field
is optional.

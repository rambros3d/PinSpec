# Proposal

## Why

The placement overlay currently draws indicators only for peripherals that already hold a preference or an assignment, so a user cannot turn on placement for an unconfigured peripheral. Ring selection through a dropdown and the overlay toggle inside the view HUD also interrupt the workflow of reading and adjusting a package interactively.

## What Changes

- Keep placement affinity opt-in per peripheral. The default CubeMX-style allocation path is unchanged, and a peripheral gains a ring indicator only after the user explicitly enables it in the placement panel.
- Expand the placement selector to list allocatable peripherals from the chip, defined as keys of `chip.peripherals` with assignable signals excluding GPIO, plus system peripherals that hold assignments. Enabling an unconfigured peripheral creates a default preference of angle 0, outer ring, enabled true.
- Remove the ring select control. Derive the ring from the radius at which the indicator is dropped, preview the drag, and commit one preference change on pointer-up. Add `Shift+ArrowUp` and `Shift+ArrowDown` for keyboard ring changes alongside the existing arrow-key angle control.
- Move the overlay toggle out of the top-right view HUD into an independent top-centre canvas control stacked with the remap banner.
- Add a rotate button inside the placement overlay panel. Persist its display-only rotation through history, local sessions, share links, and project JSON as an additive version-2 field with no schema bump. Stored angles, scoring geometry, and allocations remain in package coordinates.
- Reduce the spacing between rings and make the outer ring visibly larger. Keep the ring graphics non-interactive so pin clicks and hover keep working.
- Update the static overlay wiring test that expects the removed ring selector callback, and add coverage for the new opt-in, ring derivation, and rotation behavior.

No breaking changes. Existing version-2 state, share links, and project files stay valid.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pin-placement-affinity`: overlay indicator eligibility, selector contents, ring derivation and keyboard control, overlay control placement, persisted display-only overlay rotation, and ring geometry.

## Impact

- `src/components/workspace/PackageCanvas.svelte`: indicator derivation, drag drop handling, independent top-centre toggle.
- `src/components/workspace/PlacementOverlay.svelte`: peripheral selector, ring controls, rotation button, ring radii.
- `src/core/types.ts`, `src/core/placement.ts`, `src/core/history.ts`, `src/core/url-state.ts`, `src/core/exporters/json.ts`, `src/state/workspace.svelte.ts`: additive overlay rotation field and store action.
- `tests/pin-placement-affinity.test.ts`: revised wiring assertions plus opt-in, ring derivation, and rotation persistence coverage.
- No data generation changes, no changes to exporters other than JSON, and no changes to scoring semantics or `PLACEMENT_RING_RANK`.

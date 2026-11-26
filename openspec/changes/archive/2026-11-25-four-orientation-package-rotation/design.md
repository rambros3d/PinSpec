# Design

## Context

See proposal.md for motivation. The current implementation is a two-state model:

- `src/core/types.ts` defines `PackageRotation = 0 | -90` and `normalizePackageRotation()`, and `WorkspaceState.packageRotation` is optional.
- `src/state/workspace.svelte.ts` derives `rotation` from the field and `toggleRotation()` alternates between `-90` and absence.
- `src/core/history.ts`, `src/core/url-state.ts` (compact key `z`), and `src/core/exporters/json.ts` each call the same normalizer and omit the field for 0.
- `PerimeterPackage.svelte` and `GridPackage.svelte` set `geometryTransform` to `rotate(-90 cx cy)` only at `-90` and use a single `counterRotation` of `90` for every text site. Three sites in `PerimeterPackage.svelte` use `-90 + counterRotation`, which keeps original top and bottom labels vertical even after the pins move to a different edge.
- `PackageCanvas.svelte` fit view treats `-90` as the only rotated case. The toolbar and canvas HUD share a `RotateCw` icon, and the canvas HUD placement-rings button also uses `RotateCw`.
- `src/core/` must stay pure TypeScript; no new dependency is permitted; no raw color literal may be added.

The existing delta names in `openspec/specs/canvas-gesture-and-rotation/spec.md` are retained verbatim in the delta so archive can match them; the normative bodies change from two states to four.

## Goals / Non-Goals

**Goals:**

- Expose four clockwise orientations (`0`, `90`, `180`, `270`) through one shared cycle with no reverse control.
- Render label text upright at every orientation by deriving its angle from the shown edge.
- Keep rectangular packages inside their declared extents at quarter turns and in fit view.
- Preserve all persistence surfaces and normalize legacy `-90` to `270` at every decode boundary.
- Keep the placement-rings control separate and identifiable.

**Non-Goals:**

- No counter-clockwise or reverse rotate control.
- No change to placement-overlay rotation semantics, scoring, or generated catalog data.
- No schema version bump or v1 compatibility layer.
- No change to `openspec/specs/viewport-locked-workspace` or `openspec/specs/pin-placement-affinity`; neither carries a conflicting rotation limit.

## Decisions

1. **Four-value union with one clockwise cycle.** Keep `PackageRotation` and `normalizePackageRotation()` in `src/core/types.ts` so existing imports remain valid, but widen the union to `0 | 90 | 180 | 270`. `toggleRotation()` becomes the cycle step: `0 -> 90 -> 180 -> 270 -> 0`. The default 0 is still represented by an absent field, so a full cycle restores the original serialized bytes and existing byte-identical contracts hold. Alternative considered: storing an explicit 0; rejected because it would break the existing absence contract and add a field to share links.

2. **Single normalization shim at the core boundary.** `normalizePackageRotation()` accepts the four valid numbers, maps `-90` to `270`, and maps every other input to 0. `history.ts`, `url-state.ts`, `exporters/json.ts`, and the store keep calling this one helper, so no caller needs a separate migration branch. A legacy `-90` therefore renders at the same visual orientation as before; it is not treated as an untrusted value. Alternative considered: rewriting persisted payloads on load; rejected because it would mutate shared links and project files.

3. **Text angle from displayed side, not source side.** Add a pure helper module in `src/core/` exposing the rotation sequence, the clockwise step, a displayed-side resolver, and a text-angle resolver. The side resolver maps a pin's source edge through the clockwise step `rotation / 90` to the edge where the pin is shown. The text-angle resolver returns `0` for displayed left or right edges and `-90` for displayed top or bottom edges. Because the geometry group applies `rotate(rotation cx cy)`, each text site applies `rotate(textAngle - rotation cx cy)` so the net screen angle equals the resolved angle. All pad names, pin numbers, tag groups, grid headers, ball labels, centre markings, and exposed-pad markings use the same resolver, which removes the special-case `-90 + counterRotation` sites. Alternative considered: counter-rotating every label by `-rotation`; rejected because it leaves top and bottom labels vertical after the pin moves to a side edge.

4. **One composed geometry transform with swapped extents at quarter turns.** Renderers build `geometryTransform` as `rotate(<rotation> <centerX> <centerY>)` for every non-zero orientation. At 90 and 270 degrees they also swap the SVG `width` and `height`, set the viewBox to the swapped dimensions, and add a preceding translate on the geometry group so the rotated bounding box is recentered inside that viewBox. Fit view reads the declared extents once, so it must not apply a second swap; the existing `isRotated` branch is reconciled with the swapped attributes rather than duplicated. Alternative considered: keeping unswapped attributes and relying on `overflow: visible`; rejected because the layout box still mismatches the rotated body under manual zoom and pan.

5. **Distinct rings affordance.** Only the placement-overlay button in `PackageCanvas.svelte` changes icon and gains a Rings label or tooltip. The package controls in `TopToolbar.svelte` and `PackageCanvas.svelte` keep the package rotate icon and use clockwise wording. No new control is added.

6. **Test updates are deliberately scoped.** `tests/package-rotation.test.ts` covers four values, the cycle, legacy normalization, and all round trips. `tests/viewport-layout.test.ts`, `tests/ui-multi-vendor.test.ts`, `tests/pin-placement-affinity.test.ts`, and `tests/theme-tokens.test.ts` update only the transform strings that change. Contracts for `formatMuxLabel`, `twoSidedPackage`, `hasExposedPad`, `bondedNames`, `data-pin-pos`, focus, hover, and token-only colors remain asserted.

## Risks / Trade-offs

- [Legacy `-90` now reports `270`] Mitigation: the shim is centralized and covered by decode tests for share links, project files, sessions, and history.
- [Text angle math can invert on square packages] Mitigation: resolve the displayed side from the rotated edge mapping rather than from pixel comparisons, and assert all four orientations for a square and a non-square package.
- [Double extent compensation in fit view] Mitigation: treat the SVG attributes as the single source of effective extents and add a non-square fit-view assertion.
- [Source-string assertions can overfit renderer internals] Mitigation: update only the assertions named in this change and keep the remaining rendering contracts unchanged.
- [New core helper could break strict layer separation] Mitigation: the helper uses plain numbers and strings only, with no Svelte or DOM import.

## Migration Plan

1. Widen the core type and normalizer, then propagate through store, history, URL, and project codecs.
2. Add the pure rotation helper and adopt it in both renderers.
3. Swap extents, recenter geometry, and reconcile fit view.
4. Relabel the rings control and update the five affected test files.
5. Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; fix warnings before closeout.

After implementation the owning agent archives the change with `openspec archive four-orientation-package-rotation -y` and includes the synced spec plus archived change files in the implementation commit. This planning task set stops before archive and makes no commit.

## Open Questions

None. The displayed-side text rule, clockwise cycle, rings distinction, and persistence shim are fixed by the request.

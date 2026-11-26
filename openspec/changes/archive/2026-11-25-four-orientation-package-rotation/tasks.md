# Tasks

## 1. Core rotation domain and pure geometry helpers

- [x] 1.1 Widen `PackageRotation` in `src/core/types.ts` to `0 | 90 | 180 | 270` and update `normalizePackageRotation()` to accept those values, map legacy `-90` to `270`, and map every other input to `0`; keep the field optional on `WorkspaceState` and update its doc comment. Verify with `tests/package-rotation.test.ts` that all four values are preserved, `-90` becomes `270`, and absent, `0` as a stored legacy token, `90` as a legacy invalid token, strings, and objects normalize as specified.
- [x] 1.2 Add a pure `src/core/package-rotation.ts` module with the clockwise rotation sequence, a one-step clockwise cycle function, a displayed-side resolver that maps a source edge through `rotation / 90`, and a text-angle resolver that returns `0` for displayed left or right edges and `-90` for displayed top or bottom edges. Use only plain numbers and strings with no Svelte or DOM import. Verify with a host-side unit test that covers every source edge at `0`, `90`, `180`, and `270` and that the resulting local text angle equals `resolvedAngle - rotation`.
- [x] 1.3 Add unit coverage in `tests/package-rotation.test.ts` for the clockwise cycle order `0 -> 90 -> 180 -> 270 -> 0` using the pure cycle function. Verify `npm test` passes for the updated normalization and helper tests.

## 2. Persistence surfaces and legacy shim

- [x] 2.1 Update `src/core/history.ts` clone and equality to use the widened normalizer so `-90` compares and clones as `270`, while absent and default `0` remain byte-identical. Verify with `tests/package-rotation.test.ts` that clone, undo, and redo preserve `90`, `180`, and `270` and that a legacy `-90` snapshot becomes `270`.
- [x] 2.2 Update `src/core/url-state.ts` compact key `z` encode and decode to emit any non-zero value in the four-value domain and to normalize legacy `-90` to `270`. Verify with `tests/package-rotation.test.ts` that all four values round-trip through `encodeWorkspaceState()` and `decodeWorkspaceState()`, that a `-90` payload decodes to `270`, and that an absent payload stays absent.
- [x] 2.3 Update the version-2 schema type and encode and decode paths in `src/core/exporters/json.ts` to emit any non-zero value in the four-value domain and to normalize legacy `-90` to `270`. Verify with `tests/package-rotation.test.ts` that all four values round-trip, that a `-90` file imports as `270`, that unrecognized values import as `0`, and that a default workspace emits no `packageRotation` field.
- [x] 2.4 Confirm no other codec or exporter reads the old two-state union. Verify with `npm run check` that no strict TypeScript error remains after the domain change and with a repository search that no `0 | -90` rotation union remains outside archived specs.

## 3. Workspace store and rotate controls

- [x] 3.1 Replace `toggleRotation()` in `src/state/workspace.svelte.ts` with a clockwise step through `0 -> 90 -> 180 -> 270 -> 0`, setting the field for non-zero values and deleting it when returning to `0`, committing exactly one history entry. Keep `rotation` derived through the normalizer. Verify with `tests/package-rotation.test.ts` that four activations return to the original fields, that assignments, labels, locks, modes, remaps, and PIO bindings are unchanged, and that undo and redo reverse and restore the step.
- [x] 3.2 Keep recent-session persistence working with the widened field and verify in `tests/package-rotation.test.ts` that a rotated session stores `90`, `180`, or `270` and that the default session stores no field.
- [x] 3.3 Update the placement-overlay rotate button in `src/components/workspace/PackageCanvas.svelte` only: use an icon different from the package rotate icon and add a Rings label or tooltip while keeping `setPlacementOverlayRotation(overlayRotation + 90)`. Leave both package rotate controls in `PackageCanvas.svelte` and `TopToolbar.svelte` on the shared clockwise cycle. Verify with `tests/pin-placement-affinity.test.ts` that the canvas still calls `setPlacementOverlayRotation(overlayRotation + 90)`, that the Rings identification is present, and that the store still exposes `normalizePackageRotation` and `toggleRotation()`.
- [x] 3.4 Update the accessible label or tooltip of both package rotate controls to describe clockwise rotation at the active orientation instead of a counter-clockwise restore action. Verify with a source assertion that neither package control uses the counter-clockwise wording and that both call `onRotate`.

## 4. Renderer text orientation from displayed side

- [x] 4.1 Replace the `-90`-only `geometryTransform` and `counterRotation` in `src/components/workspace/PerimeterPackage.svelte` and `GridPackage.svelte` with a generic `rotate(${rotation} ${viewCenterX} ${viewCenterY})` and per-label angles from the pure side resolver. Apply the resolver to pad names, pin numbers, tag groups, signal tags, grid headers, ball labels, centre markings, and exposed-pad markings, including the three sites currently using `-90 + counterRotation`. Verify with `tests/viewport-layout.test.ts` that generic transform strings are present and no renderer branch is limited to `rotation === -90`.
- [x] 4.2 Preserve `formatMuxLabel`, `twoSidedPackage`, `chip.package.hasExposedPad`, `bondedNames`, `stroke-dasharray={isBonded`, `tag && zoom >= 0.6`, and `data-pin-pos` in `PerimeterPackage.svelte`, and preserve `formatMuxLabel` and `data-pin-pos` in `GridPackage.svelte`. Verify with `tests/ui-multi-vendor.test.ts` that all these contracts still pass and that the exact old top or bottom transform string `rotate(${-90 + counterRotation} ${cx} ${cy})` is replaced by the displayed-side angle expression.
- [x] 4.3 Keep all rotated text on theme utilities with no raw color literals. Verify with `tests/theme-tokens.test.ts` that both renderers still contain `fill-base-content` and no hexadecimal color literal.

## 5. Rotated extents and fit view

- [x] 5.1 Swap the SVG `width` and `height` of `PerimeterPackage.svelte` and `GridPackage.svelte` at `90` and `270`, set the viewBox to the swapped extents, and recenter the geometry group so the rotated bounding box stays inside that viewBox. Verify with `tests/viewport-layout.test.ts` that both renderers declare the swapped dimensions for quarter turns and an unchanged viewBox for `0` and `180`.
- [x] 5.2 Reconcile `fitView()` in `src/components/workspace/PackageCanvas.svelte` so rotated extents are applied exactly once when reading the declared SVG dimensions; the old `rotation === -90` branch becomes the four-value quarter-turn condition without double compensation. Verify with a non-square package fixture that fit zoom and pan use the effective width and height and that no clipping occurs at `90` and `270`.
- [x] 5.3 Confirm pointer pan, cursor-centred zoom, pin focus, hover tooltips, document lock, and overlay clamping still work at all four orientations. Verify by running the existing viewport and interaction tests together with `npm test`.

## 6. Integration verification

- [x] 6.1 Run `npm test` and confirm the full Vitest suite passes with zero failures.
- [x] 6.2 Run `npm run check` and confirm strict `tsc --noEmit` passes with zero errors.
- [x] 6.3 Run `BASE_PATH="/pinspec/" npm run build` and confirm the production subpath build succeeds with zero warnings and no broken asset path.
- [x] 6.4 Review the final diff for zero emojis, no marketing language, no hardcoded colors added outside vendored themes, no Svelte or DOM import in `src/core/`, and no generated data or upstream cache file changed. Verify by inspection of the changed file list and by a repository grep for rotation literals outside the expected sources.

## Workflow follow-up

- After every task passes and all verification is green, the implementation agent runs `openspec archive four-orientation-package-rotation -y`, then includes the synced `openspec/specs/` delta and the archived change files in the implementation commit.
- Commit and push only after archive, using the commit format required by `AGENTS.md` and reporting validation, test, check, build, and archive output as evidence.

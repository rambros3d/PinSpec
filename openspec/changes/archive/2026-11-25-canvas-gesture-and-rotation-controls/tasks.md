# Tasks

## 1. Persisted rotation state in the pure core

- [x] 1.1 Add a `PackageRotation = 0 | -90` type and a `normalizePackageRotation()` helper to `src/core/types.ts`, and add optional `packageRotation?: 0 | -90` to `WorkspaceState`; verify a unit test confirms `-90` is preserved while absent, `0`, `90`, and other untrusted values normalize to `0`.
- [x] 1.2 Update `cloneWorkspaceState` and `statesEqual` in `src/core/history.ts` to copy and compare normalized rotation; verify tests confirm absent rotation clones byte-identically, explicit `-90` survives a clone, and absent and explicit `0` compare equal.
- [x] 1.3 Add compact key `z` to `src/core/url-state.ts` encode and decode paths, emitted only for `-90`; verify a round-trip test preserves rotation through a share link and that existing payloads without `z` decode at `0`.
- [x] 1.4 Add optional `packageRotation` to the version-2 project schema and parser in `src/core/exporters/json.ts`, emitted only for `-90`; verify a project-file round-trip test preserves rotation and that default states serialize without the field.

## 2. Two-state rotation in the store and controls

- [x] 2.1 Replace the session-only `rotation` `$state<0 | 90 | 180 | 270>` in `src/state/workspace.svelte.ts` with a derived value from `state.packageRotation` and a two-state `toggleRotation()` that commits one history entry; remove the reset in `openMcu`; verify tests show `0` to `-90` to `0` toggling, correct undo and redo, and unchanged assignments, labels, locks, modes, remaps, and PIO bindings.
- [x] 2.2 Update the `rotation` prop type and rotate callback in `src/components/workspace/TopToolbar.svelte` and `src/pages/WorkspacePage.svelte`, including degree labels and titles; verify `npm run check` passes and a source scan finds no `90`, `180`, or `270` rotation state remaining in workspace UI code.

## 3. Canvas zoom input

- [x] 3.1 Replace the Svelte wheel attribute in `src/components/workspace/PackageCanvas.svelte` with a native `wheel` listener registered with `{ passive: false }` in `onMount` and removed on cleanup; keep the plain-wheel step and add a fine ctrl/meta step; verify a static test finds the non-passive registration and cleanup and that wheel zoom leaves the document unscrolled.
- [x] 3.2 Add non-passive `gesturestart` and `gesturechange` listeners and two-pointer tracking that applies the pointer-distance ratio to the existing cursor-centred zoom around the pinch midpoint, re-baselining on pointer count changes; verify static assertions cover the listeners and pinch path and a manual touch or simulator check confirms page zoom stays unchanged.
- [x] 3.3 Add a scoped `touch-action: none` rule to `src/app.css` and apply its class to the canvas stage; verify the existing document overflow and height strings in `tests/viewport-layout.test.ts` remain intact and a new assertion covers the touch rule.

## 4. Upright labels in both rotation states

- [x] 4.1 Remove the CSS rotation wrapper in `PackageCanvas.svelte`, pass `rotation` to both renderers, and add viewBox-centre geometry rotation plus anchor-local counter-rotation for centre markings, pad names, pin position numbers, and tag groups in `src/components/workspace/PerimeterPackage.svelte`; verify `formatMuxLabel`, `twoSidedPackage`, `hasExposedPad`, `bondedNames`, `data-pin-pos`, `set.add(pos)`, and tag suppression below zoom `0.6` remain present and the existing static contract tests pass.
- [x] 4.2 Apply the same rotation and counter-rotation to `src/components/workspace/GridPackage.svelte` for row and column headers, ball labels, the A1 marker, and the footer; verify the static renderer assertions pass and both zoom limits render without overlapping text in light and dark themes.
- [x] 4.3 Change the `fitView` effective-dimension check in `PackageCanvas.svelte` to `rotation === -90` and update the canvas HUD degree label; verify a rotated non-square package fits inside the stage at both rotation states and that pin focus, hover tooltip, and overlay clamping tests still pass.

## 5. Integration verification

- [x] 5.1 Extend the static source-contract tests in `tests/viewport-layout.test.ts`, `tests/pin-placement-affinity.test.ts`, `tests/theme-tokens.test.ts`, and `tests/ui-multi-vendor.test.ts` with the new gesture, rotation, and counter-rotation assertions without deleting existing overflow, height, highlight-set, token, or mux-label strings; verify `npm test` passes with no failures.
- [x] 5.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; verify zero warnings, no Svelte or DOM imports added under `src/core/`, no raw color literals or emojis in touched files, no new npm dependency, and no STM32 rendering or diagnostic regression.

## Workflow follow-up

- Archive the change after all tracked tasks and verification pass, as required by the repository operating contract.
- Report validation, unit test, type-check, and production build output as evidence.

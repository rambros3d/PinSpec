# Tasks

## 1. Canvas controls and find bar

- [x] 1.1 Remove the floating placement card, Crosshair/Orbit buttons, its furniture marker, and `onPlacementToggle` prop from `PackageCanvas.svelte`; derive ring visibility from enabled bubbles; verify viewport and placement suites pass
- [x] 1.2 Move the find bar from `top-14 right-3` to `top-14 left-3` without changing search focus, clear, or shortcut behavior; verify search and shell suites pass

## 2. Panel rotation and preferences

- [x] 2.1 Add a `Rotate placements` button to `PlacementPanel.svelte` that advances `placementOverlayRotation` by 90 with clear accessible wording and is disabled without enabled bubbles; verify placement and rotation persistence suites pass
- [x] 2.2 Retire `placementOverlayVisible` from `workspace-preferences.svelte.ts`, its stored shape, normalizer, and tests; confirm no share or project schema change; verify preference and core-IO suites pass

## 3. Verification and closeout

- [x] 3.1 Update static shell, placement, preference, and viewport tests deliberately for the removed toggle, derived visibility, panel rotation control, and find-bar position; preserve rotation persistence and search-focus coverage; verify `npm test` passes
- [x] 3.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no solver, allocation, data, exporter, dialog, or global shell change and no new dependency
- [x] 3.3 Run `openspec validate placement-controls-relocation --strict`, archive with `openspec archive placement-controls-relocation -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

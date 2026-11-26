# Tasks

## 1. Pin-based reference radius

- [x] 1.1 Add a pure farthest-corner helper and update `placementRingRadii` to take a pin reference radius while keeping factors 1.4 / 1.55 / 1.7; add host tests for corner distance and fallback; verify `npm test` and `npm run check` pass
- [x] 1.2 Mark perimeter pad rectangles with `data-pin-bounds`, and wrap each grid ball circle plus visible text with the same marker; verify package render and rotation suites pass
- [x] 1.3 Measure pin bounds in `PackageCanvas.svelte`, derive the reference radius from the body centre, and keep the body half-diagonal fallback; verify placement and viewport suites pass

## 2. Ring styling

- [x] 2.1 Render all three placement rings with `stroke-dasharray="2 3"` and `stroke-width="1"`, removing the low-ring exception and leaving indicator handles unchanged; verify placement interaction and theme suites pass

## 3. Verification and closeout

- [x] 3.1 Update static placement tests for the new markers, reference radius, and ring stroke, preserving ring-selection, allocation, persistence, rotation, and enable-fit coverage; verify `npm test` passes
- [x] 3.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no persistence, solver, data, exporter, dialog, or shell change and no new dependency
- [x] 3.3 Run `openspec validate placement-pin-ring-refinement --strict`, archive with `openspec archive placement-pin-ring-refinement -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

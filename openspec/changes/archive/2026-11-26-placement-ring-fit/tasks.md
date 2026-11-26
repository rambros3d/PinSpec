# Tasks

## 1. Pure ring geometry

- [x] 1.1 Add pure helpers in `src/core/` for ring radii and placement zoom limit using a 1.1 inner-clearance factor and the furniture-safe outer radius; add Vitest cases for clearance, clamping, and zoom limit; verify `npm test` and `npm run check` pass
- [x] 1.2 Keep `measuredSafeRadius` unchanged and verify its existing tests still pass with arbitrary centres

## 2. Measured body and overlay

- [x] 2.1 Mark the main IC body with `data-ic-body` in `PerimeterPackage.svelte` and `GridPackage.svelte`; verify package render and rotation suites pass
- [x] 2.2 Measure the body rectangle in `PackageCanvas.svelte`, derive ring centre and radii, and pass them to `PlacementOverlay.svelte`; include pan and zoom in the re-measure effect; verify viewport and placement suites pass
- [x] 2.3 Remove fixed `RING_FACTORS` from `PlacementOverlay.svelte` and use the computed radii for drawing, labels, pointer selection, and keyboard changes; verify placement interaction suite passes
- [x] 2.4 Apply automatic zoom-out around the body centre on overlay enable, chip/rotation change, and resize with an epsilon guard and no pointer-move trigger; verify gesture and placement suites pass

## 3. Verification and closeout

- [x] 3.1 Update the static placement tests that asserted fixed ring factors, deliberately preserving allocation, ring-selection, persistence, and furniture-safety coverage; verify `npm test` passes
- [x] 3.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no persistence, solver, data, exporter, or shell change and no new dependency
- [x] 3.3 Run `openspec validate placement-ring-fit --strict`, archive with `openspec archive placement-ring-fit -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

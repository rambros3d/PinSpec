# Tasks

## 1. Stable ring geometry

- [x] 1.1 Change `src/core/placement-rings.ts` to fixed body-relative factors 1.4 / 1.55 / 1.7, remove the furniture-safe argument from `placementRingRadii`, and redefine `placementZoomLimit` for the enable-only stage fit; update pure tests for ratios, ordering, and enable fit; verify `npm test` and `npm run check` pass
- [x] 1.2 Remove placement furniture measurement and low-ring clamping from `PackageCanvas.svelte` while keeping body-centre measurement on pan and zoom; verify viewport and placement suites pass

## 2. Enable-only fit and overlay

- [x] 2.1 Restrict automatic zoom to the overlay-enable transition, removing chip, rotation, resize, pan, wheel, and pinch triggers; verify gesture and placement suites pass
- [x] 2.2 Keep `PlacementOverlay.svelte` using the single radii object for drawing, labels, and `ringFromEvent`; remove dead safe-radius props or markers; verify placement interaction suite passes
- [x] 2.3 Update static placement tests for the new ratios and removed clamp, preserving ring-selection, allocation, persistence, and rotation coverage; verify `npm test` passes

## 3. Verification and closeout

- [x] 3.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no persistence, solver, data, exporter, dialog, or shell change and no new dependency
- [x] 3.2 Run `openspec validate placement-ring-stability --strict`, archive with `openspec archive placement-ring-stability -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

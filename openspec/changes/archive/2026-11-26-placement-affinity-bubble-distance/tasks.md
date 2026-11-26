# Tasks

## 1. Pure bubble geometry

- [x] 1.1 Extend `PinGeometry` with `x`/`y` in `perimeterGeometry` and `gridGeometry`, keeping `angle`/`radius` for existing consumers; add host tests for both package kinds; verify `npm test` and `npm run check` pass
- [x] 1.2 Add a pure bubble-point helper from `{ angle, ring }` and the shared geometry using ring factors 1.4 / 1.55 / 1.7; verify unit tests pass

## 2. Affinity scoring

- [x] 2.1 Replace angular/radial penalties in `placementAffinityForPin` with normalized bubble-to-pad-centre distance in `0–60`, keeping rank × 10000 and disabled zero; verify affinity tests pass
- [x] 2.2 Ensure allocation and matrix alternate ranking reuse the same geometry cache and keep scarcity, electrical penalties, and candidate caps unchanged; verify solver and multi-vendor suites pass
- [x] 2.3 Update static placement source contracts deliberately, preserving persistence, ring-selection, and rotation coverage; verify `npm test` passes

## 3. Verification and closeout

- [x] 3.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no share/project schema, persistence, data, exporter, dialog, or shell change and no new dependency
- [x] 3.2 Run `openspec validate placement-affinity-bubble-distance --strict`, archive with `openspec archive placement-affinity-bubble-distance -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

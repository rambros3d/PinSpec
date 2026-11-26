# Tasks

## 1. Pure canvas view module

- [x] 1.1 Add `src/core/canvas-view.ts` with `fitViewTransform`, `zoomAtPoint`, `wheelZoomFactor`, and `pinchTransform`, preserving clamps, quarter-turn extents, and rounding; add Vitest cases for each path; verify `npm test` and `npm run check` pass
- [x] 1.2 Wire `PackageCanvas.svelte` to use the helpers while keeping its exported `fitView()`, pointer state, listeners, and markup; verify package gesture, rotation, and viewport suites pass

## 2. Contracts and verification

- [x] 2.1 Update the static view assertions that expected inline arithmetic to check the helper module and call sites; verify `npm test` passes
- [x] 2.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` with zero warnings; confirm STM32 rendering, share URLs, and persistence are unchanged and no dependency was added
- [x] 2.3 Run `openspec validate canvas-view-extraction --strict`, archive with `openspec archive canvas-view-extraction -y`, fix any archived spec purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit code, specs, and archive artifacts

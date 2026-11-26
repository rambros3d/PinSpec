# Tasks

## 1. Pure eligibility helper

- [x] 1.1 Add a pure `src/core/` helper classifying configured non-GPIO peripherals as eligible, locked-only, or ineligible using `findAlternatePins` with one-hop occupied mobility; add host tests for free, one-hop, locked-only, no-alternate, and GPIO cases; verify `npm test` and `npm run check` pass

## 2. Panel and canvas wiring

- [x] 2.1 Filter `PlacementPanel.svelte` rows through the helper, render locked-only rows disabled with explanatory title/aria text, hide ineligible rows, and update the empty-state copy; verify placement and accessibility suites pass
- [x] 2.2 Derive `placementOptions` in `PackageCanvas.svelte` from the same eligibility result so indicators match the panel, without deleting stored preferences; verify overlay and placement suites pass
- [x] 2.3 Update static placement-panel tests deliberately for disabled rows and hidden peripherals, preserving allocation, persistence, ring-selection, and rotation coverage; verify `npm test` passes

## 3. Verification and closeout

- [x] 3.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings; confirm no solver, allocation, persistence, data, exporter, dialog, or shell change and no new dependency
- [x] 3.2 Run `openspec validate placement-eligibility-filter --strict`, archive with `openspec archive placement-eligibility-filter -y`, fix any archived spec Purpose placeholder, run `openspec validate --all --strict`, confirm no active changes remain, and commit and push

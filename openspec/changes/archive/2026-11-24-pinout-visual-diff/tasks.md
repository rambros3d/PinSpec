# Tasks

## 1. Pure core comparison module

- [x] 1.1 Add `src/core/project-diff.ts` with snapshot and change types for `added`, `removed`, `moved`, `relabeled`, and `reassigned`, a position-first/name-second matching index, and a sorted change result; verify `npm run check` passes and the module contains no Svelte or DOM import.
- [x] 1.2 Implement classification and deterministic ordering (position or pin name, then change kind), keeping one change row per matched physical pin and carrying before/after assignment, label, and position values; verify new unit tests cover same-chip and cross-chip cases.
- [x] 1.3 Add tests in `tests/project-diff.test.ts` for malformed JSON, missing `mcuId`, and unsupported version through the `parsePinoutJson()` path, plus a deep-equality assertion that neither input snapshot nor the active workspace state changes after comparison; verify `npx vitest run tests/project-diff.test.ts` passes.

## 2. Diff modal component

- [x] 2.1 Add `src/components/workspace/PinoutDiffModal.svelte` with two independent file slots, per-slot `idle`/`loading`/`ready`/`error` state, `parsePinoutJson()` validation, and a `.ioc` unsupported-format message gated on an importer being registered; verify `npm run check` passes and a source-contract test in `tests/ui-multi-vendor.test.ts` confirms both file inputs and per-slot error rendering.
- [x] 2.2 Render two read-only previews using `catalogStore.loadChip()` with each snapshot's `mcuId` and `PerimeterPackage.svelte` or `GridPackage.svelte` selected by `chip.package.kind`, passing no interaction callbacks and deriving a status map from the loaded chip; verify a source-contract test confirms no callback props are passed and no workspace store is written.
- [x] 2.3 Overlay the five diff marker kinds as rings or edge badges with a dedicated legend and render a summary table with change kind, position, pin name, and before/after values, leaving the existing pin status fill untouched; verify a source-contract test confirms the marker palette and the absence of status-fill replacement.
- [x] 2.4 Ensure the modal produces no KiCad or other symbol artifact; verify a source-contract test confirms no `.kicad_sym` string appears in the component.

## 3. Workspace wiring

- [x] 3.1 Add an `onOpenDiff` callback and button to `src/components/workspace/TopToolbar.svelte` and a `showDiff` flag plus modal instance to `src/pages/WorkspacePage.svelte`; verify a source-contract test confirms the button, callback, and modal import are present and that open/close writes nothing to `workspaceStore`.
- [x] 3.2 Confirm the project-file schema is unchanged and no exporter is modified; verify `npm test` passes with no changes to `src/core/exporters/`.

## 4. Integration verification

- [x] 4.1 Run `npm test && npm run check && BASE_PATH="/pincraft/" npm run build` and confirm zero warnings, no subpath asset failures, and no STM32 regressions; verify all three commands exit successfully.

## Workflow follow-up

- Archive the change with `openspec archive pinout-visual-diff -y` after all tracked tasks pass, and include the archived spec in the implementation commit.

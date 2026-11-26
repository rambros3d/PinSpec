# Proposal

## Why

Pin assignments are currently reviewed one project at a time, so comparing a saved pinout with a proposed revision, or with the same design on a different MCU, requires reading two JSON files by hand. A visual diff lets a user see which pins were added, removed, moved between positions, relabeled, or reassigned, directly on the familiar package diagrams.

## What Changes

- Add a pure core module `src/core/project-diff.ts` that compares two parsed project snapshots (`WorkspaceState` plus MCU identity) and returns a deterministic list of pin-level changes.
- Match pins by physical position first and pin name second, so diffs between different MCUs remain meaningful even when package layouts differ.
- Classify changes as `added`, `removed`, `moved`, `relabeled`, or `reassigned`, with a stable ordering suitable for a summary table.
- Add `PinoutDiffModal.svelte`, a dedicated workspace modal with two file inputs, per-file load and error states, two read-only package previews with color-coded change markers, and a summary table of changes.
- Reuse `PerimeterPackage.svelte` and `GridPackage.svelte` as read-only previews driven by the diff result; do not add interaction handlers or mutation paths.
- Add a workspace toolbar entry point that opens the modal without altering current workspace state.
- Accept two `PinSpecProjectFile` version 2 files via the existing `parsePinoutJson()` parser. `.ioc` input is optional and only supported once the separate importer change lands; this change does not depend on it.
- Add unit tests for same-chip diffs, cross-chip diffs, malformed files, and non-mutation of the active workspace.
- Explicit out of scope: KiCad `.kicad_sym` symbol export. This change produces a visual comparison only, no symbol or library output.

## Capabilities

### New Capabilities

- `pinout-visual-diff`: Comparing two PinSpec project snapshots and presenting pin-level differences on read-only package previews and in a summary table.

### Modified Capabilities

None. This change adds a new capability and does not alter the requirements of existing specs.

## Impact

- New pure module `src/core/project-diff.ts`; no Svelte or DOM imports in `src/core/`.
- New component `src/components/workspace/PinoutDiffModal.svelte`.
- Wiring in `src/components/workspace/TopToolbar.svelte` (a new button/callback) and `src/pages/WorkspacePage.svelte` (modal state and handler).
- Reuses `parsePinoutJson()` from `src/core/exporters/json.ts`, `WorkspaceState`/`PinAssignment`/`ChipData` from `src/core/types.ts`, the package renderers, and the `catalogStore.loadChip()` shard-loading pattern for both preview chips.
- Depends on the shard-loading pattern already used by the workspace; remains independently implementable without the in-flight `ioc-import-board-presets` change.
- No new npm dependency. No changes to exporters, the solver, or generated data.

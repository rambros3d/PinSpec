# Design

## Context

See `proposal.md` for motivation and `specs/pinout-visual-diff/spec.md` for the behavior contract. The workspace already stores state as `WorkspaceState` keyed by physical pin position, serializes it as `PinCraftProjectFile` version 2 through `exportPinoutJson()` and `parsePinoutJson()`, and lazily fetches chip shards through `catalogStore.loadChip()`. Both package SVG renderers already accept assignments, labels, locks, status, and highlight sets, so they can serve as read-only previews without changes to their rendering contracts. `SummaryDrawer.svelte` has fixed tabs and `ExportModal.svelte` has a fixed tab list, so neither is extended; a separate modal is used.

## Goals / Non-Goals

**Goals:**
- Keep all comparison logic in pure TypeScript under `src/core/`, testable with Vitest on the host.
- Produce stable, readable change records for both same-chip and cross-chip comparisons.
- Reuse existing parsers, types, shard loading, and SVG renderers rather than duplicating them.
- Keep the active workspace strictly read-only during the entire diff workflow.

**Non-Goals:**
- No KiCad `.kicad_sym` export or other symbol-library output.
- No `.ioc` parser in this change; that belongs to the separate `ioc-import-board-presets` change.
- No changes to the solver, exporters, generated data, or catalog schema.
- No new npm dependency and no backend or runtime service.

## Decisions

**Decision: Standalone pure diff module.** `src/core/project-diff.ts` exports a function that accepts two parsed snapshot inputs (each holding an MCU identifier and a `WorkspaceState`) and returns a sorted change array plus per-side marker maps. No Svelte or DOM import is permitted. Alternative considered: computing the diff inside the modal component. Rejected because it would make the core logic untestable without a DOM and would scatter classification rules into UI code.

**Decision: Position-first, name-second matching.** Build an index for each snapshot keyed by physical position, then by pin name. Prefer a position match; if a position is absent on the other side, attempt a pin-name match and treat a differing position as `moved`. This makes cross-chip diffs meaningful when package position keys differ. Alternative considered: position-only matching. Rejected because it degrades cross-chip comparisons into unrelated additions and removals.

**Decision: Five-class change model.** Classification order for a matched pin is: `moved` when the matched name differs in position; `reassigned` when the assignment (peripheral, signal, af, funcLabel, remapId, resourceId) differs; `relabeled` when only the label differs; pins present on only one side are `added` or `removed`. A moved pin that also changes assignment is reported once with both facts attached, so the table stays one row per physical pin. Alternative considered: one row per field. Rejected because it obscures which pin changed.

**Decision: Reuse existing parsers and renderers.** The modal calls `parsePinoutJson()` for both files and passes its `WorkspaceState` into the diff. Previews call `catalogStore.loadChip()` with each snapshot's `mcuId` and select `PerimeterPackage.svelte` or `GridPackage.svelte` from the loaded `ChipData.package.kind`. The renderers receive the snapshot's own assignments, labels, locks, and a synthesized status map; all interaction callbacks are omitted, and `compact` is enabled where supported. Change markers are supplied through a dedicated overlay computed from the diff result, not through the existing `highlightedPins` prop, so the remap/search cyan meaning is unchanged. The table presents the change kind and values in text, so color is not the sole indicator.

**Decision: Per-file load state machine.** Each file slot tracks `idle`, `loading`, `ready`, and `error`. Selecting a file parses it immediately; errors are stored per slot and do not clear the other slot. Both slots must be `ready` before a diff is computed. Shard fetch errors are stored in the same slot state. Alternative considered: a single shared error. Rejected because it hides which input failed.

**Decision: Separate modal and minimal toolbar wiring.** Add one button to `TopToolbar.svelte` with an `onOpenDiff` callback, a boolean flag in `WorkspacePage.svelte`, and `PinoutDiffModal.svelte` rendered alongside the existing modals. No toolbar or modal state is written into `workspaceStore`. Alternative considered: adding a diff tab to `ExportModal.svelte`. Rejected because that modal's tab list is hardcoded and its purpose is serialization, not comparison.

**Decision: Diff marker palette.** Use a separate legend keyed to the five change kinds: added emerald, removed red, moved cyan, relabeled amber, reassigned orange. These are drawn as outline rings or edge badges over the existing pin fill, never as a replacement fill, so the established pin status colors remain authoritative. Destructive and positive meanings match the landing and workspace palette.

## Risks / Trade-offs

- Ambiguous name matches on chips with duplicated or bonded pad names: exact position match takes priority; name matching applies only when the position key is absent on the other side, and ties are resolved deterministically by sorted key. Trade-off: a rare bonded-name ambiguity may be reported as a move rather than a direct match.
- Cross-chip diffs compare label and assignment strings without validating that the signal exists on both chips; this is intentional, because the purpose is to show the saved configuration, not to validate it.
- Two shards must be fetched for cross-chip previews; network failure is isolated to the affected slot and never mutates workspace state.
- The overlay marker is added by the modal rather than the shared renderers, so future changes to pin geometry need a matching overlay adjustment. Mitigation: derive overlay placement from the same pin position keys the renderers use and cover both renderer kinds in verification.
- `.ioc` support is deliberately deferred; the UI must present an unsupported-format message until the separate importer exists.

## Migration Plan

No data migration is required. Project files continue to use schema version 2. Rollback consists of removing the toolbar button, the modal component, and the diff module; no persisted state is affected.

## Open Questions

None. KiCad symbol export is explicitly out of scope by user decision, and `.ioc` support is intentionally deferred to the in-flight importer change.

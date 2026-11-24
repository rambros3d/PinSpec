# Design

## Context

See `proposal.md` for motivation. `src/core/types.ts` already declares `VendorId`, `MuxModel`, `funcLabel`, `remapId`, `resourceId`, `activeRemaps`, `pioAssignments`, and the unused `formatMuxLabel()` helper, but the four exporters, `url-state.ts`, and `workspace.svelte.ts` still hardcode STM32 AF semantics and version 1. The core layer must stay pure TypeScript so all new behavior is host-testable.

## Goals / Non-Goals

**Goals:**
- One mux-label source of truth shared by every export format.
- Vendor-correct Rust, C, and CSV output driven only by data already present on `ChipData`/`WorkspaceState`.
- Lossless, deterministic project and share serialization for the new fields.
- Undo, recent-session, and share round trips that include remaps and PIO bindings.

**Non-Goals:**
- No version-1 compatibility shims, CSV header migration, or old-state conversion (user decision).
- No changes to solver diagnostics or UI widgets (owned by earlier/later changes).
- No new external dependency or runtime service.

## Decisions

- **Single label helper**: all formats call `formatMuxLabel(signal, muxModel)` with `getChipMuxModel(chip)` and fall back to the GPIO mode text for plain GPIO. Alternative considered: per-format switch statements; rejected because nine hardcoded sites already drifted.
- **Dispatch inside existing exporter entry points**: keep `exportEmbassyRust`, `exportCHeader`, `exportCsv` signatures and the `ExportModal` tab contract; each delegates to a private per-vendor formatter. Alternative: new exporter modules per vendor; rejected as unnecessary churn for consumers.
- **Pico SDK and ch32v003fun macro sets**: RP emits `GPIO_FUNC_*` plus PWM slice/channel macros derived from `resourceId`; CH32 emits ch32v003fun macros and a remap-summary comment derived from `activeRemaps` and `PeripheralRemapOption`. STM32 macros remain unchanged.
- **Version bump without shim**: JSON and URL payloads move to the single current version, drop all `v === 1` branches, and store `activeRemaps`/`pioAssignments` only when non-empty to keep share URLs short. Keys remain deterministically sorted for stable diffs and tests.
- **State flows through existing history/clone path**: add small store methods that clone state, set a remap or PIO binding, and commit via `HistoryStack`; hydration uses `cloneWorkspaceState`, so handoff, recent sessions, undo, and redo gain the fields without a parallel state structure.
- **Strict validation**: malformed or wrong-version payloads return typed errors so the existing dismissible-banner path stays uniform.

## Risks / Trade-offs

- [Breaking exports and links] -> Accepted by user decision; no shim is written and tests pin the new formats.
- [RP/CH32 chip JSON missing optional fields] -> Exporters use `getChipVendor`/`getChipMuxModel` defaults and render GPIO-style labels rather than throwing.
- [Share URL growth from remap/PIO maps] -> Omit empty maps and reuse the existing deflate step.
- [Label helper diverging from UI] -> The same helper is consumed by the workspace UI change; spec text pins expected labels.

## Migration Plan

No data migration: the single version replaces v1 outright, catalog data is generated in CI, and nothing is committed under `public/data/`. Verify with `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`.

# Proposal

## Why

The catalog is expanding from STM32-only to CH32 and RP parts, but every exporter, the share codec, the project-file format, and the workspace store still assume a single AF-based STM32 mux model. Until those outputs and state paths are vendor-aware, CH32 remap groups and RP FUNCSEL/PIO bindings cannot be exported, shared, saved, or undone, so the earlier phases cannot be used end-to-end.

## What Changes

- Vendor-dispatch the Rust exporter: emit `embassy_stm32`, `embassy-rp`, or `ch32-hal` bindings/crates from the chip's vendor, with mux comments derived from the declared mux label helper instead of hardcoded `AF<n>` text. **BREAKING**: output is no longer STM32-specific.
- Vendor-dispatch the C header: STM32 keeps `PORT`/`PIN`/`AF` macros; RP emits Pico SDK `GPIO_FUNC_*` plus PWM slice/channel macros; CH32 emits ch32v003fun macros plus a remap-group summary. **BREAKING**: non-AF muxes no longer emit `_AF`.
- Replace the CSV header with `Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked`, where `Mux` uses the vendor mux label and `Resource` carries shared-hardware keys. **BREAKING**: column set and header change.
- Use a single project-file schema version that includes per-assignment `funcLabel`/`remapId`/`resourceId` and top-level `activeRemaps`/`pioAssignments`. **BREAKING**: no version-1 import shim is retained.
- Extend the share-link codec to serialize the new state fields only when non-empty, and to reject payloads of any other single version. **BREAKING**: version-1 links are no longer accepted.
- Hydrate, persist, and undo the new fields in the workspace store, including recent sessions and shared-link round trips.
- Add host-runnable tests covering each vendor's Rust/C/CSV output, JSON and URL round trips, and store undo/persistence of remaps and PIO assignments.

## Capabilities

### New Capabilities
- `multi-vendor-exports`: Vendor-dispatched code/CSV/project-file/share serialization and workspace-state hydration, persistence, and undo behavior for STM32, CH32, and RP pinouts.

### Modified Capabilities
None. The main spec inventory is empty; this capability is introduced here.

## Impact

- `src/core/exporters/embassy-rust.ts`, `src/core/exporters/c-header.ts`, `src/core/exporters/csv.ts`, `src/core/exporters/json.ts`, `src/core/url-state.ts`.
- `src/state/workspace.svelte.ts` and `src/core/history.ts` / `src/core/types.ts` field flow.
- `src/components/workspace/ExportModal.svelte` (preview tab dispatch) consumes the new outputs.
- `tests/` for exporter and state round-trip coverage.
- Depends on `multi-vendor-core-solver` for the vendor, mux-model, remap, and PIO field semantics; no STM32 export or state behavior is preserved as a compatibility path by user decision.

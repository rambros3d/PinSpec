# Design

## Context

See `proposal.md` - Why. `src/core/solver.ts` currently emits six STM32 diagnostics; `isSwdPin()` hardcodes PA13/PA14, HSE conflict detection depends on `peripheralModes.RCC`, `findAlternatePins()` / `remapPinAssignment()` / `findOneHopFixForSignal()` are one-hop STM32 pin moves, and `analyzeDma()` is STM32-channel based. `src/core/types.ts` already declares the generalized fields and diagnostic codes, and `getChipVendor` / `getChipMuxModel` / `formatMuxLabel` exist but are unused. About eleven sites reconstruct `PinAssignment` literally and drop extended fields. `src/core/` must stay pure TypeScript with no Svelte/DOM imports.

## Goals / Non-Goals

**Goals:**
- Make diagnostics and mux operations vendor-driven from emitted tags/signals/remaps/resourceIds, with STM32 outcomes unchanged.
- Implement remap groups, resource collisions and RP PIO/GPIOBASE validation as pure functions in the solver.
- Preserve all extended `PinAssignment` fields across every core operation.

**Non-Goals:**
- No UI components or Svelte stores (owned by `multi-vendor-workspace-ui`).
- No exporters or version-2 URL/JSON codec changes (owned by `multi-vendor-exporters-state`); this change only avoids dropping fields those layers will consume.
- No backward-compatibility shims or version-1 import path.
- No data generation changes; consumes the RP and CH32 adapter outputs.

## Decisions

1. **Tag-driven detection over pin-name checks.** Replace `isSwdPin` PA13/PA14 logic with `pin.tags` (`debug-swd`, `debug-sdi`) and `PinSignal` roles. HSE/clock overlap becomes a generic clock-pin-occupancy check driven by tagged clock signals instead of the `RCC` mode string; STM32 data gains equivalent tags during adapter emission. Alternative: a vendor switch in the solver - rejected because it duplicates data knowledge in code.
2. **Remap groups as atomic plan objects.** Compute a full remap plan from `PeripheralRemapOption.signals` before applying it: validate every target (locked/occupied), then produce a single cloned state with all assignments moved. `OneHopFix` gains optional group fields so diagnostics can offer group moves. Alternative: sequential per-signal moves - rejected because a mid-move lock would leave a half-remapped peripheral.
3. **Resource collisions by `resourceId` grouping.** Build a map of active assignments grouped by non-empty `resourceId`; any group with two distinct pins emits `RESOURCE_CONFLICT`. RP PWM slice A/B wrap falls out naturally from the emitted table-derived IDs; no modulo math in the core.
4. **PIO reservation and GPIOBASE windows.** Validate PIO assignments against `ChipPioConfig`: reserve (instance, sm) pairs detectably, and check each pin's GPIO number against a valid 32-pin window derived from `gpioBaseOptions` (0 or 16). Invalid pins emit `PIO_GPIOBASE_CONFLICT`. Alternative: validate in UI - rejected because core must stay deterministically unit-testable.
5. **Spread-based preservation.** Replace literal `{ peripheral, signal, af }` reconstructions with `{ ...source, signal, af }` at every site (remap, one-hop fix, allocation, URL/state import, export helpers). This is a mechanical invariant enforced by a test that feeds an extended assignment through each operation.
6. **Report extension.** Add `infoCount` to `SolverReport` and the new codes to the existing `DiagnosticItem.code` union; no separate report type per vendor.
7. **No compatibility layer.** Legacy version-1-only state shapes are unsupported; consumers must supply the generalized schema.

## Risks / Trade-offs

- [STM32 diagnostic regressions] -> Keep existing codes/messages for STM32 scenarios and add regression tests using the current `STM32G431CBU6` / `STM32F103C8T6` fixtures before changing detection logic.
- [Tag data missing from legacy STM32 shards] -> Generation is regenerated in CI (no committed data), so tags are present; solver treats absent tags as "no special rule" rather than crashing.
- [Remap plan complexity] -> Validate the whole plan before mutating; tests cover locked, occupied and success cases.
- [PIO window math off-by-one] -> Table-driven tests for GPIO0-31 and GPIO16-47 boundaries.
- [Lossy reconstruction sites missed] -> Grep-based inventory plus a field-preservation test covering each operation path.

## Migration Plan

1. Inventory and convert all `PinAssignment` reconstruction sites to spread form; add the preservation test first.
2. Introduce tag-driven debug/clock/warning diagnostics with STM32 regression fixtures.
3. Add remap-group planning, resource collision grouping and PIO/GPIOBASE validation to `evaluateWorkspace()` and helpers.
4. Extend `SolverReport` / `OneHopFix` types and update unit tests in `tests/core-solver.test.ts` and `tests/core-io.test.ts`.
5. Verify with `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`; confirm zero STM32 diagnostic regressions.

## Open Questions

None. The solver's consumption contract is fixed by the data adapters and the emitted types; no deferrable question changes the specs or tasks.

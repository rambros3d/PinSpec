# Tasks

## 1. Assignment field preservation

- [x] 1.1 Inventory every `PinAssignment` reconstruction site in `src/core/` (remap, one-hop fix, allocation, history, URL state, exporter helpers) and convert each to spread-based reconstruction that retains `funcLabel`, `remapId` and `resourceId`; verify a grep audit finds no remaining literal `{ peripheral, signal, af }` constructors.
- [x] 1.2 Add a field-preservation unit test in `tests/core-solver.test.ts` (plus `tests/core-io.test.ts` for URL/export round-trips) that feeds an extended assignment through remap, one-hop fix and import/export paths; verify `npm test` shows all extended fields survive every operation.

## 2. Tag-driven diagnostics

- [x] 2.1 Replace hardcoded PA13/PA14 and `RCC`-mode-based debug/clock detection in the solver with `PinInfo.tags` and signal-role checks, emitting `DEBUG_PIN_REPURPOSED`, `BONDED_PIN_NOTE` and `RP_HARDWARE_HINT`; verify unit tests assert tag-driven warnings and that STM32 SWD/HSE diagnostic fixtures from `STM32G431CBU6` / `STM32F103C8T6` produce identical outcomes.
- [x] 2.2 Extend `DiagnosticItem.code` and `SolverReport` with `infoCount` and update report counting; verify tests assert info diagnostics are counted and existing error/warning counts are unchanged for STM32 fixtures.

## 3. Remap groups and resource collisions

- [x] 3.1 Implement atomic remap-group planning from `PeripheralRemapOption.signals` with locked-target blocking (`REMAP_LOCKED`) and occupied-target detection (`REMAP_MISMATCH`), and add group-move fields to `OneHopFix`; verify tests cover a successful atomic CH32 remap, a locked target leaving state unchanged, and an occupied target diagnostic naming both assignments.
- [x] 3.2 Implement shared `resourceId` collision grouping over active assignments, emitting `RESOURCE_CONFLICT` errors that list and mark both pins; verify tests assert RP PWM slice A/B wrap errors, distinct-slice pairs are allowed, and both pins are marked as conflicting.
- [x] 3.3 Make `findAlternatePins()` / `remapPinAssignment()` mux-model aware so `funcLabel`, `remapId`, `resourceId` and alternate candidates reflect the chip's mux model; verify tests assert alternates for `funcsel-pio` and `remap-group` chips return correct labels and preserved fields.

## 4. RP PIO and GPIOBASE validation

- [x] 4.1 Implement PIO state-machine block reservation and GPIO window validation against `ChipPioConfig.gpioBaseOptions`, emitting `PIO_GPIOBASE_CONFLICT` for pins outside every valid 32-pin window; verify tests assert RP2350B accepts GPIO0-31 and GPIO16-47 windows with `[0,16]`, rejects out-of-window pins, and flags overlapping PIO state-machine reservations as resource conflicts.

## 5. Integration verification

- [x] 5.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify zero warnings, no Svelte/DOM imports under `src/core/`, no STM32 diagnostic regressions, and that the expanded `SolverReport` is consumable by downstream UI work.

# Tasks

## 1. State model and core persistence

- [ ] 1.1 Add the `GpioConfig` value type and optional `WorkspaceState.gpioConfig` field keyed by physical position in `src/core/types.ts`; verify `tsc --noEmit` passes and existing state literals still compile unchanged.
- [ ] 1.2 Thread the field through `cloneWorkspaceState()` and `statesEqual()` in `src/core/history.ts`; verify a unit test shows a cloned state retains settings and states differing only in settings compare unequal.
- [ ] 1.3 Add a compact key for the field to `CompactUrlPayload` in the URL codec, omitting it when empty; verify a unit test round-trips configured settings and that v1/v3 payloads are still rejected.
- [ ] 1.4 Extend the version-2 JSON codec to serialize and parse the field with sorted keys; verify a unit test round-trips settings and that a v2 payload without the field still loads.

## 2. Inspector UI

- [ ] 2.1 Add a GPIO electrical inspector tab in `SummaryDrawer.svelte` bound to the selected pin, with controls for output level, drive, pull, and speed that commit through workspace history; verify a test or manual check shows edits on the selected pin are undoable and do not affect other pins.

## 3. Exporters

- [ ] 3.1 Extend the Rust exporter to emit embedded-HAL-style configuration content when settings are present; verify a test asserts configured content and that default STM32 Rust output is byte-for-byte unchanged.
- [ ] 3.2 Extend the C header exporter to emit per-pin `_LEVEL`, `_DRIVE`, `_PULL`, and `_SPEED` macros when settings are present; verify a test asserts configured macro values and that default STM32 C output is byte-for-byte unchanged.
- [ ] 3.3 Extend the CSV exporter with the four new columns and update its schema tests in the same task; verify tests assert configured values, empty cells when unset, unchanged pre-existing columns, and the new header.
- [ ] 3.4 Verify JSON export inherits the field from state; verify a test asserts a serialized project file contains configured settings with sorted keys.

## 4. Integration verification

- [ ] 4.1 Run project verification (`npm test`, `npm run check`, and the subpath production build); verify all pass with no new warnings, no STM32 regressions, and unchanged default exporter snapshots.

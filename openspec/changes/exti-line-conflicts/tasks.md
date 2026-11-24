# Tasks

## 1. Pure EXTI derivation

- [ ] 1.1 Add a pure helper that derives an `EXTI<n>` line identifier from the numeric GPIO index in a pin name for STM32 and CH32; verify unit tests assert `PA0`, `PB0`, and `PC0` derive `EXTI0`, `PA13` derives `EXTI13`, and non-GPIO pins return no identifier.
- [ ] 1.2 Add the `EXTI_LINE_CONFLICT` code to the diagnostic code union; verify `npm run check` passes and a test asserts the new code is counted in `SolverReport`.

## 2. Solver integration

- [ ] 2.1 Hook derivation into `evaluateWorkspace()` before `analyzeResourceConflicts()`, attaching derived identifiers only to `GPIO` / `EXTI` assignments through local cloned assignments; verify tests assert `PA0` and `PB0` emit an `EXTI_LINE_CONFLICT` naming and marking both pins, `PA0` and `PB1` emit no conflict, and no chip shard on disk is changed.
- [ ] 2.2 Add regression tests confirming non-GPIO pins, non-EXTI assignments, and all existing STM32 diagnostic counts are unchanged; verify `npm test` passes with the existing `STM32G431CBU6` and `STM32F103C8T6` fixtures.

## 3. Workspace display

- [ ] 3.1 Display the derived EXTI line identifier for `GPIO` / `EXTI` assignments in `PinPopover.svelte`, `PinContextMenu.svelte`, and the hover tooltip; verify inspection shows a value such as `EXTI0` and a repository grep finds no emojis introduced.

## 4. Integration verification

- [ ] 4.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify zero warnings, no Svelte or DOM imports under `src/core/`, and no STM32 diagnostic regressions.

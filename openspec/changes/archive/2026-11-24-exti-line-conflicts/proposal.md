# Proposal

## Why

When two GPIO pins are both assigned the `GPIO` / `EXTI` signal, they often share the same hardware EXTI line: PA0, PB0, and PC0 all map to EXTI0, but only one pin can own that line at a time. `src/core/solver.ts` already detects shared `resourceId` collisions for RP PWM slices, but no generated shard emits EXTI signals, so this common STM32 (and CH32) misconfiguration currently goes unreported.

## What Changes

- Add a pure helper that derives an EXTI resource id (`EXTI<n>`) from a pin's name or GPIO index, so pins at the same numeric index across ports (PA0/PB0/PC0 -> EXTI0) resolve to the same line. The rule applies to STM32 and CH32.
- Hook the derivation into `evaluateWorkspace()` before `analyzeResourceConflicts()`, attaching a derived `resourceId` to `GPIO` / `EXTI` assignments at evaluation time without mutating generated shard data.
- Emit an explicit `EXTI_LINE_CONFLICT` diagnostic listing both conflicting pins and marking both as conflicting, so it integrates with the existing one-hop-fix and diagnostics UI.
- Display the derived EXTI line in the pin popover, context menu, and hover tooltip.
- Add unit tests covering a shared-line conflict, distinct lines allowed, and non-GPIO pins unaffected, and verify that non-EXTI assignments and all existing diagnostics remain unchanged.
- Explicitly out of scope: generated shards and data generation are not changed; CH32 upstream `index/exti_lines.csv` is not consumed in this change.

## Capabilities

### New Capabilities
- `exti-conflict-detection`: Derivation of EXTI lines from GPIO pin names in the pure core and detection of shared-line conflicts between `GPIO` / `EXTI` assignments, with a dedicated diagnostic and UI display.

### Modified Capabilities
(None. All capabilities in this proposal are new; no existing spec requirements change.)

## Impact

- Pure core (TypeScript, no DOM/Svelte imports): `src/core/solver.ts` gains a derivation hook in `evaluateWorkspace()` and a new diagnostic code in the `DiagnosticItem.code` union; a small helper module derives the line id from a pin name. `src/core/types.ts` is touched only if the new diagnostic code is declared there.
- UI: `src/components/workspace/PinPopover.svelte` and `src/components/workspace/PinContextMenu.svelte` display the derived EXTI line.
- Tests: `tests/core-solver.test.ts` gains EXTI scenarios; existing STM32 diagnostic fixtures are rerun as regression checks.
- Data: no changes to generated shards, `public/data/`, `.cache/`, or the data generator. STM32 and CH32 catalog output is unchanged.
- Verification: `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` must pass with no STM32 diagnostic regressions.

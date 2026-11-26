# Design

## Context

See `proposal.md` - Why. `src/core/solver.ts` already implements `analyzeResourceConflicts()` over active assignments with a non-empty `resourceId` and emits `RESOURCE_CONFLICT` diagnostics that mark both pins. `GPIO_MODES` includes `EXTI`, and `PinPopover.svelte` assigns `{ peripheral: 'GPIO', signal: 'EXTI', af: null }` with no `resourceId`. No generated shard emits EXTI signals: ST XML carries EXTI only as an I/O mode and the generator deliberately filters non-SYS/RCC XML signals. Under the stated rule, `EXTI<n>` is derivable from the GPIO index in the pin name for STM32 and CH32. The core must remain pure TypeScript with no Svelte or DOM imports.

## Goals / Non-Goals

**Goals:**
- Derive EXTI line identifiers in a pure, unit-testable helper.
- Integrate derivation into `evaluateWorkspace()` so existing resource-conflict analysis detects shared lines.
- Surface a clear, dedicated diagnostic and display the derived line in the workspace.

**Non-Goals:**
- No changes to generated shards, `public/data/`, `.cache/`, or the data generator.
- No consumption of CH32 upstream `index/exti_lines.csv`.
- No behavior changes for non-EXTI assignments or existing diagnostics.

## Decisions

1. **Derive from pin names in the core.** Add a pure helper that extracts the GPIO bank and numeric index from a pin name and returns `EXTI<index>` or null. Alternative: emit a `resourceId` in generated shards - rejected because it changes generated data and the data-gen release gates, and the rule is already determined by the pin name.
2. **Attach identifiers during evaluation, not in stored data.** Build a local map from physical position to derived EXTI identifier in `evaluateWorkspace()` and pass assignments with the identifier into conflict analysis. Alternative: mutate `ChipData` or persisted `WorkspaceState` - rejected because it pollutes shards and share links with derived data.
3. **Dedicated diagnostic code.** Add `EXTI_LINE_CONFLICT` to the diagnostic code union and emit it from the EXTI-aware analysis path, marking both pins. Alternative: reuse `RESOURCE_CONFLICT` - rejected because the message would not identify EXTI lines to the user; the underlying marking behavior is unchanged.
4. **Limit scope to EXTI assignments.** Apply derivation only when the peripheral is `GPIO` and the signal is `EXTI`; every other assignment passes through untouched. Alternative: attach identifiers to all GPIO signals - rejected because it would create spurious conflicts.
5. **UI reads the derived value.** The popover, context menu, and tooltip read the derived line identifier from the evaluation result or the same pure helper, requiring no new Svelte store.

## Risks / Trade-offs

- [Pins without a numeric GPIO index] -> The helper returns null; no identifier and no conflict are produced.
- [Parts with more complex EXTI multiplexing than the index rule] -> The index rule is the documented behavior for this phase; document the limitation and keep derivation isolated so a future data-driven rule can replace it.
- [Regression in existing diagnostics] -> Keep derivation behind the EXTI-only guard and rerun all STM32 solver fixtures as regression checks.
- [Conflicting pins not visually marked] -> Emit the diagnostic through the existing conflict-marking path and assert both pins in tests.

## Migration Plan

1. Add the pure derivation helper and unit tests for same-index, distinct-index, and non-GPIO pins.
2. Integrate derivation into `evaluateWorkspace()` before shared-resource conflict analysis.
3. Add the `EXTI_LINE_CONFLICT` code and the UI display in the popover, context menu, and tooltip.
4. Verify with `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; confirm existing STM32 diagnostics are unchanged.

## Open Questions

None. The derivation rule and the integration point are fixed by the current solver and the stated upstream behavior.

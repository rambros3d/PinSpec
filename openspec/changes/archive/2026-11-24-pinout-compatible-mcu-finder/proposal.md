# Proposal

## Why

Users planning a board sometimes need to move a pinout to a different part, including across STM32, CH32, and RP families. The catalog currently exposes only part-level index fields and cannot tell whether another MCU can host the same signals on the same physical pins, so this comparison must be done by hand.

## What Changes

- Add a pure TypeScript `src/core/compatibility.ts` module that builds a compatibility signature from a workspace (pin names and types, power/reset pins, required signals of active peripherals, and mux model) and scores catalog candidates for exact pin-for-pin match, functional match, and flash/RAM delta, with a vendor filter.
- Add a `CompatibleMcuFinder.svelte` workspace component with vendor and package filters, a bounded candidate list (20 results), bounded concurrent shard loading (4 `loadChip()` calls), and cancellation of pending loads on unmount.
- Add a toolbar entry point that opens the finder against the current workspace without modifying that workspace.
- Surface a warning when a candidate shard lacks enough pin-level data to score it, and skip that candidate rather than failing.
- Add unit tests with synthetic chip fixtures and bounded-fetch/cancellation behavior.

No new dependency is introduced. The finder reads catalog shards through the existing lazy `catalogStore.loadChip()` and navigates through the existing `router.navigateMcu()`.

## Capabilities

### New Capabilities
- `compatible-mcu-finder`: Computing a pinout compatibility signature from a workspace, scoring catalog candidates for pin-for-pin and functional compatibility across vendors, and presenting a bounded, cancellable candidate list that can open a selected part without changing the source workspace.

### Modified Capabilities
None. Existing workspace, mux, and export requirements are unchanged; the finder is additive and read-only with respect to workspace state.

## Impact

- New core: `src/core/compatibility.ts` (pure, no Svelte or DOM imports).
- New component: `src/components/workspace/CompatibleMcuFinder.svelte`; toolbar entry in `TopToolbar.svelte`.
- Reuses `catalogStore.loadChip()` (which caches shards by uppercase ID with no eviction) and `router.navigateMcu()`; the finder must cap loaded shards to avoid unbounded cache growth.
- `index.json` has only part-level fields, so candidate shards must be fetched on demand and scored from full `ChipData`.
- Tests added under `tests/` using synthetic `ChipData` fixtures.

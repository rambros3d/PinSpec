# Proposal

## Why

`src/core/solver.ts` encodes STM32-specific assumptions: `isSwdPin()` hardcodes PA13/PA14, HSE conflicts are keyed to the `RCC` mode, remapping is a one-hop STM32 pin move, and DMA analysis is STM32-channel based. Meanwhile ~11 `PinAssignment` reconstruction sites drop the already-declared vendor fields (`funcLabel`, `remapId`, `resourceId`). With RP and CH32 catalog data arriving, the pure core must make mux resolution and diagnostics vendor-driven before the workspace UI can expose those parts.

## What Changes

- Replace hardcoded debug/clock detection with tag- and signal-driven diagnostics: use `PinInfo.tags` (`debug-swd`, `debug-sdi`, `usb`, `qspi`, `hstx`, `adc`, `boot`) and signal roles instead of PA13/PA14 and `RCC`-only HSE checks; emit `DEBUG_PIN_REPURPOSED`, `BONDED_PIN_NOTE` and `RP_HARDWARE_HINT` vendor diagnostics. STM32 behavior stays identical via its emitted tags/signals.
- Add coupled remap-group switching: selecting `WorkspaceState.activeRemaps[peripheral]` atomically moves all signals of that remap option; a locked target blocks the move, an occupied target produces a clear `REMAP_MISMATCH` / `REMAP_LOCKED` diagnostic. Extend `OneHopFix` with group-move fields and teach `findAlternatePins()` / `remapPinAssignment()` to be mux-model aware.
- Add active `resourceId` collision detection: two pins activating the same shared hardware resource (RP PWM slice A/B wrap, `EXTI0`, shared PIO resource) become a `RESOURCE_CONFLICT` error highlighting both pins; include the result in `SolverReport`.
- Add an RP PIO manager: contiguous block reservation across PIO instances/state machines and RP2350B 32-pin `GPIOBASE` window validation (GPIO0-31 or GPIO16-47), emitting `PIO_GPIOBASE_CONFLICT` for pins outside every valid window.
- Extend `SolverReport` (including `infoCount`) and the diagnostic code union; fix every lossy `PinAssignment` reconstruction site via object spread so `funcLabel`, `remapId` and `resourceId` survive moves, fixes and exports.
- **BREAKING**: no legacy import/compatibility shims. Version-1-only state shapes are not supported; consumers must use the generalized schema.
- Keep `src/core/` pure TypeScript with no Svelte/DOM imports and no `std`-style assumptions.

## Capabilities

### New Capabilities
- `multi-vendor-mux`: vendor-driven mux resolution and diagnostics for the pure core, covering tag-based debug/clock warnings, coupled remap groups, shared `resourceId` collisions, and RP PIO/GPIOBASE validation.

### Modified Capabilities
(None. `openspec/specs/` is empty; there are no existing specs to modify.)

## Impact

- Core (pure TS): `src/core/types.ts` (already declares the fields), `src/core/solver.ts` (diagnostics, remap, resource/PIO analysis), `src/core/history.ts`, `src/core/url-state.ts`, `src/core/exporters/*` (spread-preservation of extended assignment fields).
- Tests: `tests/core-solver.test.ts`, `tests/core-io.test.ts` add CH32 atomic remap, locked/occupied remap blocks, resource collisions, RP PWM slice wrap, GPIOBASE valid/invalid window, and export round-trips.
- Downstream consumers (separate change `multi-vendor-workspace-ui`): Svelte state stores and components read `SolverReport`; new diagnostic codes and PIO panel are consumed there. This change does not modify application UI.
- Depends on data adapter changes `ci-native-data-generation`, `ch32-data-adapter` and `rp-data-adapter` for the emitted tags/remaps/pio data.
- Verification: `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build` with no STM32 regressions.

# Tasks

## 1. Shared mux-label wiring in exporters

- [x] 1.1 Replace every hardcoded `AF<n>`/`AFIO` annotation in `src/core/exporters/` with `formatMuxLabel()` driven by `getChipMuxModel(chip)`; verify with `npm run check` and a unit test asserting `AF7`, `F6`, `RM1`, and GPIO-mode labels.

## 2. Vendor-dispatched Rust and C exporters

- [x] 2.1 Dispatch `exportEmbassyRust` to `embassy_stm32`/`embassy_rp`/`ch32_hal` with matching `Peripherals` initializer and unique snake_case fields; verify with `npm test` cases for all three vendors plus an empty board.
- [x] 2.2 Dispatch `exportCHeader` to STM32 PORT/PIN/AF macros, RP Pico SDK `GPIO_FUNC_*` plus PWM slice/channel macros, and CH32 ch32v003fun macros with a remap summary; verify with `npm test` assertions per vendor and no `_AF` macro on RP.

## 3. Vendor-neutral CSV schema

- [x] 3.1 Emit the exact header `Vendor,Position,Pin,Type,Peripheral,Signal,Mux,Resource,Label,Locked` with vendor/mux/resource values and quote escaping; verify a unit test checks the header, mixed-vendor rows, and a comma-containing label.

## 4. Project-file and share-link codecs

- [x] 4.1 Move the project file to the single current version with per-assignment `funcLabel`/`remapId`/`resourceId` and top-level `activeRemaps`/`pioAssignments`, sorted keys, and no v1 shim; verify round-trip and rejected-version tests in `npm test`.
- [x] 4.2 Extend the URL codec to encode remaps/PIO only when non-empty, accept only the current version, and return dismissible-banner errors otherwise; verify round-trip, omission, and outdated-link tests in `npm test`.

## 5. Workspace state fields

- [x] 5.1 Add store methods that commit remap and PIO changes through history and hydrate `activeRemaps`/`pioAssignments` on open, share handoff, and recent-session restore; verify undo/redo and persistence round-trip tests in `npm test`.

## 6. Integration verification

- [x] 6.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify zero warnings and confirm no version-1 branch or STM32-only export path remains via repository search.

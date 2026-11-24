# Tasks

## 1. Schema additions in the pure core

- [x] 1.1 Add `esp32` to `VendorId`, `gpio-matrix` to `MuxModel`, the new values
  (`strapping`, `input-only`, `adc-only`, `rtc`, `lp`, `jtag`, `flash`, `psram`,
  `cap-restricted`) to `PinTag`, optional `direction` to `PinSignal`, and the
  four new codes to `DiagnosticItem.code` in `src/core/types.ts`; verify with
  `npm run check` and by reusing the existing `usb` and `adc` tags without
  duplicate union members.
- [x] 1.2 Resolve `vendor: 'esp32'` to `gpio-matrix` in `getChipMuxModel()` when
  `muxModel` is absent, and add a matrix branch to `formatMuxLabel()` that uses
  the route display label or signal name; verify by extending
  `tests/core-multi-vendor.test.ts` with fallback and label cases and running
  that test file.

## 2. Synthetic matrix fixtures and routing rules

- [x] 2.1 Create synthetic `gpio-matrix` chip fixtures under `tests/fixtures/`
  with input and output signal directions, electrical tags, and an optional
  declared matrix route capacity; verify the fixtures parse as `ChipData` in a
  focused matrix test.
- [x] 2.2 Implement direction-dependent duplicate handling in
  `evaluateWorkspace()` so matrix outputs may fan out while matrix inputs and
  all non-matrix chips keep the single-source error; verify with tests for
  output fan-out, single-source input, GPIO input fan-out not being a driver
  conflict, and unchanged STM32 duplicate errors.

## 3. Pin capability gating and diagnostics

- [x] 3.1 Gate `pinSupportsSignal()` so pins tagged `input-only` reject
  peripheral output and GPIO output requests while accepting input roles; verify
  through allocation, one-hop fix, and alternate-discovery tests that use the
  shared helper.
- [x] 3.2 Emit `STRAPPING_REPURPOSED`, `INPUT_ONLY_OUTPUT`,
  `ADC2_WIFI_CONFLICT`, and `MATRIX_ROUTE_LIMIT` with the specified severities,
  pin lists, and trigger conditions; verify with focused diagnostic tests and
  by asserting existing STM32, CH32, and RP diagnostics and severities are
  unchanged.

## 4. Scoring and alternate candidates

- [x] 4.1 Add the additive matrix term to `computePinScarcityScore()` gated on
  `gpio-matrix`, preferring direct IO_MUX routes for speed-critical signals and
  penalizing strapping, input-only, and capability-restricted candidates; verify
  with synthetic matrix scoring tests and STM32 score snapshots that are
  byte-identical for scores, assignments, and diagnostics.
- [x] 4.2 Bound `findAlternatePins()` results for matrix chips after status
  ranking and numeric name sorting, leaving non-matrix results complete; verify
  with a bounded-list test, deterministic ordering assertions, and an unchanged
  non-matrix alternate list.

## 5. Integration verification

- [x] 5.1 Confirm no `WorkspaceState` field was added and that
  `src/core/url-state.ts`, `src/core/history.ts`, and `src/core/exporters/json.ts`
  are unchanged; verify with `tests/core-io.test.ts`,
  `tests/workspace-state.test.ts`, and a version-2 round-trip test.
- [x] 5.2 Run `npm test`, `npm run check`, and
  `BASE_PATH="/pincraft/" npm run build`; verify all three pass with zero
  warnings and no broken subpath requests.

## Workflow follow-up

- After every tracked task passes, run `openspec validate esp32-schema-and-core-mux --strict`.
- Archive the change with `openspec archive esp32-schema-and-core-mux -y`; the
  implementation agent owns this step.
- Include the archived spec under `openspec/specs/esp32-schema-and-core-mux/`
  and the moved change under `openspec/changes/archive/` in the implementation
  commit.
- Report validation, unit test, type check, build, and archive output as evidence.

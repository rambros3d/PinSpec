# Proposal

## Why

ESP32 parts cannot be represented by the current three mux models. The ESP32
GPIO matrix lets a peripheral output drive several GPIOs and lets one GPIO input
feed several peripheral inputs, while the core treats every repeated
`(peripheral, signal)` pair as an error. Adding ESP32 as a fourth vendor
requires additive schema, tag, and solver work before a data adapter, placement
logic, UI, or exporters can rely on it.

## What Changes

- Add `esp32` to `VendorId` and `gpio-matrix` to `MuxModel` as distinct values.
  The existing `af`, `remap-group`, and `funcsel-pio` values are unchanged and
  are not overloaded for matrix routes.
- Resolve `vendor: 'esp32'` to `gpio-matrix` in `getChipMuxModel()` when a chip
  shard omits `muxModel`.
- Add a matrix branch to `formatMuxLabel()` that renders the `funcLabel` or
  signal name of a matrix route. Existing label branches keep their output.
- Extend `PinTag` with `strapping`, `input-only`, `adc-only`, `rtc`, `lp`,
  `jtag`, `flash`, `psram`, and `cap-restricted`. The existing `usb` and `adc`
  tags are reused rather than duplicated.
- Add optional signal direction metadata to chip data on `PinSignal` so the
  solver can distinguish matrix inputs from outputs. This is generated
  reference data, not workspace state, so version-2 share URLs and project
  JSON are unchanged.
- Add diagnostic codes `STRAPPING_REPURPOSED`, `INPUT_ONLY_OUTPUT`,
  `ADC2_WIFI_CONFLICT`, and `MATRIX_ROUTE_LIMIT` with defined severities and pin
  reporting.
- Relax duplicate `(peripheral, signal)` errors only for matrix OUTPUT fan-out.
  Matrix INPUT routes keep the single-source rule, and STM32, CH32, and RP keep
  the current duplicate check.
- Gate `pinSupportsSignal()` on tag capability so `input-only` pins cannot be
  assigned peripheral output signals. Allocation, one-hop fixes, and alternate
  discovery use the same gate.
- Add an additive matrix term to `computePinScarcityScore()` that prefers
  direct IO_MUX routes for speed-critical signals and penalizes strapping,
  input-only, and flash-reserved pins. The term is zero for non-matrix chips,
  keeping STM32 scores byte-identical.
- Cap alternate-pin candidates for matrix chips in `findAlternatePins()` with
  deterministic ordering.
- Keep `src/core/` pure TypeScript with no Svelte or DOM imports.

No breaking changes. Every addition is optional and existing vendor behavior is
preserved.

## Capabilities

### New Capabilities

- `esp32-schema-and-core-mux`: Vendor identity, mux model, pin tags, signal
  direction, GPIO-matrix routing semantics, solver invariants and diagnostics
  for ESP32, and STM32 non-regression guarantees in the pure TypeScript core.

### Modified Capabilities

None. No existing requirement in `multi-vendor-mux` or
`pin-placement-affinity` changes; the new ESP32 behavior is additive and owned
by the new capability.

## Impact

- `src/core/types.ts`: `VendorId`, `MuxModel`, `PinTag`, `PinSignal`,
  `DiagnosticItem.code`, `getChipMuxModel()`, and `formatMuxLabel()`.
- `src/core/solver.ts`: `pinSupportsSignal()`, `computePinScarcityScore()`,
  `findAlternatePins()`, and `evaluateWorkspace()` duplicate handling and
  diagnostics.
- Tests: new synthetic `gpio-matrix` chip fixtures, ESP32 direction and
  diagnostic tests, and STM32 score snapshots that assert byte-identical
  output. Updates to `tests/core-multi-vendor.test.ts`,
  `tests/core-solver.test.ts`, and a new focused matrix test file.
- No workspace-state field is introduced, so `src/core/url-state.ts`,
  `src/core/history.ts`, `src/core/exporters/json.ts`, and the rest of the
  version-2 codecs remain unchanged.
- Downstream changes (ESP32 data adapter, matrix placement, workspace UI,
  exporters, and documentation) consume this schema in separate changes.

## Out of Scope

- ESP32 source acquisition, all-family coverage (`esp32`, `s2`, `s3`, `c2`,
  `c3`, `c6`, `h2`, `p4`, `s31`, `c5`, `c61`, `h4`), and per-module or MPN flash
  shards belong to the data adapter change.
- Full electrical correctness for placement is deferred to the placement
  change. This change adds tags and scoring only.
- Starter chips only; board presets are not added.
- UI presentation, export formatting, catalog gates, and documentation updates
  are handled by the UI, exporters, and documentation change.

# Design

## Context

See `proposal.md` for motivation. The core already supports three mux models
(`af`, `remap-group`, `funcsel-pio`) through `src/core/types.ts` and
`src/core/solver.ts`. Assignments are keyed by physical pin position, duplicate
`(peripheral, signal)` pairs are errors, and scarcity scoring has an additive
placement term that is exactly zero when no preference is enabled. ESP32 adds a
GPIO matrix whose outputs may fan out to several GPIOs and whose inputs have a
single source; its pins also carry electrical restrictions that affect which
signals a pin can drive. This change stays inside the pure core and defines the
contract that later ESP32 data, placement, UI, and export changes consume.

## Goals / Non-Goals

**Goals:**

- Represent ESP32 as a fourth vendor with a distinct `gpio-matrix` mux model.
- Carry matrix direction and electrical tags in chip data without changing
  version-2 workspace state or its codecs.
- Apply the matrix routing rules only to matrix chips while keeping STM32,
  CH32, and RP outputs byte-identical.
- Keep all new logic host-testable with no Svelte or DOM imports.

**Non-Goals:**

- ESP32 source acquisition, family coverage, module or MPN flash shards, and
  gate assertions belong to the data adapter change.
- Full electrical correctness for placement is deferred to the placement
  change; this change only adds tags and scoring inputs.
- No board presets; only starter chips are in scope for the wider family.
- No UI, exporter, or documentation edits, and no edits to existing main specs.

## Decisions

### D1: Extend enumerations, do not overload existing mux models

Add `esp32` to `VendorId`, `gpio-matrix` to `MuxModel`, and the new values to
`PinTag` and `DiagnosticItem.code`. Reuse the existing `usb` and `adc` tags
instead of creating duplicates. Alternatives considered: mapping ESP32 onto
`funcsel-pio` (rejected because it conflates RP PIO semantics with matrix
routing) and a parallel chip schema keyed by vendor (rejected because it would
duplicate every consumer of `ChipData`).

### D2: Resolve mux model by explicit value, then vendor

`getChipMuxModel()` keeps its current precedence: an explicit `muxModel` wins.
When it is absent, `vendor: 'esp32'` resolves to `gpio-matrix`; the existing
`ch32` and `rp` fallbacks and the `af` default are unchanged. An explicit
`gpio-matrix` value is accepted for any chip so synthetic test fixtures do not
depend on a vendor field.

### D3: Matrix labels come from route names

`formatMuxLabel()` keeps its `funcLabel` and GPIO early returns. A matrix branch
returns the route display label when present, otherwise the signal name, and
never formats an AF or FUNCSEL index. Existing `funcsel-pio`, `remap-group`, and
`af` branches are untouched.

### D4: Signal direction is chip data, not workspace state

Add optional `direction?: 'input' | 'output'` to `PinSignal`, emitted by the
ESP32 data adapter. It is generated reference data loaded from a chip shard, so
it does not enter share URLs, project JSON, or undo history. Alternatives
considered: inferring direction from signal suffixes (rejected as vendor-specific
and fragile) and adding a direction map to `WorkspaceState` (rejected because it
would require codec changes and a shareability declaration). When direction is
absent the solver applies the conservative single-source rule.

### D5: Duplicate policy is direction-dependent

Group assignments by `(peripheral, signal)`. For `gpio-matrix` signals marked
`output`, multiple physical positions are valid fan-out and produce no
`DUPLICATE_SIGNAL` error. For matrix inputs and for every non-matrix chip, the
existing single-source error remains. The physical-pin map still holds at most
one assignment per position; `resourceId` collision handling and SWD, clock,
bonded, and PIO diagnostics are unchanged. This avoids adding a second
assignment representation to the state model.

### D6: Capability gate lives in signal support resolution

`pinSupportsSignal()` rejects a peripheral output or a GPIO `Output` request on
a pin tagged `input-only`. Because allocation, one-hop fixes, remapping, and
alternate discovery all call this helper, the gate applies to every path
without separate branch logic. Input roles on the same pin remain valid. Other
new tags feed diagnostics and scoring rather than support resolution, so a
missing tag never silently hides a route.

### D7: Additive, gated scarcity scoring

Add a matrix term inside `computePinScarcityScore()` that runs only when the
chip's mux model is `gpio-matrix`. It adds a preference for a direct IO_MUX
route when a signal is marked speed-critical, and adds penalties for strapping,
input-only, `cap-restricted`, and flash-reserved candidates. The existing
alternate-function count and placement terms are unchanged, including the
zero-when-disabled placement term. For non-matrix chips the matrix term is
exactly zero, so scores and tie-breaking remain byte-identical. Speed-critical
classification is derived from chip data rather than hardcoded part numbers.

### D8: Bound matrix alternate discovery

`findAlternatePins()` keeps its status ranking (`free`, `occupied`, `locked`)
and numeric name sort, then truncates matrix results to a fixed deterministic
limit after sorting. Non-matrix chips return the full list. Limiting before
sorting was rejected because it would make the visible candidates depend on
shard order.

### D9: Diagnostics are additive and narrowly triggered

`STRAPPING_REPURPOSED` and `INPUT_ONLY_OUTPUT` are emitted from pin tags during
assignment validation. `ADC2_WIFI_CONFLICT` requires an ADC2 channel assignment
and an enabled Wi-Fi peripheral, so it cannot fire on chips without Wi-Fi.
`MATRIX_ROUTE_LIMIT` requires a declared matrix capacity on the chip; absent
capacity means no limit. Codes keep the existing id and pin-list conventions,
with warnings for repurposing, conflict, and capacity cases and an error for an
input-only pin driven as an output. No existing code or severity changes.

### D10: No new persisted workspace state

No field is added to `WorkspaceState`, so there is no persistence-category
declaration to make and no change to `url-state.ts`, `history.ts`, or the JSON
exporter. Matrix routes are described by existing `funcLabel` and `resourceId`
fields on assignments, which already round-trip through version-2 codecs. If a
future change needs a matrix-specific workspace field, it must be declared as
shareable pin configuration and added to every codec in that same change.

### D11: Verification contract

Synthetic matrix chip fixtures cover output fan-out, single-source inputs,
input-only gating, direct-route preference, constrained-pin penalties, bounded
alternates, and the four new diagnostics. Existing STM32 fixtures assert
byte-identical scores, assignments, and diagnostics through snapshot-style
comparisons. The phase ends with unit tests, strict type check, and the
production subpath build.

## Risks / Trade-offs

- [Matrix term leaks into existing vendors] Gate the term on mux model and
  assert STM32 score snapshots in tests.
- [Legitimate ESP32 output fan-out reported as duplicate] Use direction from
  chip data and cover fan-out with a synthetic fixture.
- [Missing direction hides a real input conflict] Default to the conservative
  single-source rule when direction is absent.
- [Matrix alternates overwhelm the UI] Truncate after deterministic sorting.
- [Sibling changes assume different field names] Treat the enum and chip-data
  names in this document and the spec as the contract for the ESP32 adapter.

## Migration Plan

Additive only. No catalog rewrite, schema version bump, or compatibility shim
is required; existing shards keep their current fields and behavior. Rollback
consists of removing the additive branches, with no stored state to undo.

## Open Questions

None. Family coverage, flash shards, electrical placement, and presentation are
decided by the sibling changes and do not affect this core design.

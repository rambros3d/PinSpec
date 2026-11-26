# Design

## Context

See `proposal.md` - Why for the motivation and the spec delta for the behavior contract.
`src/core/types.ts` already defines `PinTag` with `5v-tolerant`, `PinInfo.tags`, `PinInfo.bondedNames`,
`WorkspaceState.labels`, and `WorkspaceState.gpioConfig`. `src/core/solver.ts` owns diagnostics and
keeps `pinHasTag` and `isDebugPin` private; the workspace computes `report = $derived.by(...)` from
`evaluateWorkspace`. `SummaryDrawer.svelte` has a component-local tab union of `pins`, `diagnostics`,
`dma`, `pio`, and `gpio`; `ExportModal.svelte` has a component-local union of `rust`, `c`, `csv`,
`json`, and `share`. Neither union is persisted.

The CH32 adapter currently reads only manifest-verified `index/` CSVs. `index/pinout.csv` has no
electrical `type` column, while `evidence/pins.csv` carries `type: I/O/FT` rows and is not listed in
`index/manifest.csv`. No generated shard currently carries `5v-tolerant`. The
`viewport-locked-workspace` change defines a portrait dock with its own persisted active-tab field
and tabs Peripherals, Pins, Diagnostics, DMA, and PIO; that change is implemented separately and is
not edited here. Core code must stay free of Svelte and DOM imports, no npm dependency is added, and
no user setting is introduced.

## Goals / Non-Goals

**Goals:**

- Build a deterministic, read-only audit report from chip shards, upstream dataset rows, and
  user-entered workspace state only.
- Keep hardware guidance out of solver diagnostics; leave diagnostic codes and counts unchanged.
- Make strapping, interface, unused-pin, and tolerance facts visible in the right pane, in the
  portrait dock when that layout is present, and in a plain-text export.
- Emit `5v-tolerant` on CH32 shards from upstream `I/O/FT` evidence and record the evidence digest.
- Prove the behavior with per-vendor tests and the full verification sequence.

**Non-Goals:**

- No recommended pull directions, resistor or capacitor values, VCAP tables, unused-pin policy
  prose, analog-mode recommendations, or voltage claims for unknown pins.
- No new workspace state field, schema version, URL field, project-file field, or `localStorage`
  setting; the audit is derived on demand.
- No solver change, no new diagnostic, no change to Rust, C, CSV, or JSON exporters.
- No edit to the `viewport-locked-workspace` change or its artifacts.

## Decisions

- **Separate pure module, not solver integration.** Add `src/core/hardware-audit.ts` exporting a
  `buildHardwareAudit(chip, state)` function that returns a `HardwareAuditReport` with four sections
  and an evidence source on every fact. Use local pure predicates for tag and name checks instead of
  exporting `pinHasTag` from `solver.ts`. Alternative: append audit items to `SolverReport` - rejected
  because it changes diagnostic counts and the exact-count tests, and it mixes advisory facts with
  correctness errors.
- **Structured facts with enumerated fields.** Report types use closed string unions for roles,
  evidence sources, and tolerance values, plus chip identifiers (`pos`, pin name, peripheral name,
  domain name). Unknown and data-unavailable are explicit enum values. A pure
  `formatHardwareAuditText(report)` renders the same facts in deterministic order for export. This
  keeps the UI read-only and leaves no place for hand-authored prose guidance.
- **Strapping classification from shard fields only.** Classify by `PinInfo.type` for dedicated boot
  and reset pins, by name suffix `-BOOT0` and `-NRST` for `io` pins, by `SYS.SWDIO` and `SYS.SWCLK`
  signal roles, and by `debug-sdi`, `debug-swd`, and `qspi` tags. Treat an RP `RUN` pin as
  reset-and-boot. Never synthesize a BOOTSEL role because no shard declares one. Pull is read only
  from `state.gpioConfig[pos].pull`; label only from `state.labels[pos]`. Absent pull means unknown.
  Alternative: a hand-authored per-vendor strapping table - rejected because upstream provides no
  required pull directions and the table would become unverified guidance.
- **Interface presence from parts and names.** I2C and USB come from `chip.peripherals` keys filtered
  by `state.peripheralModes`; oscillators come from emitted pin signal names beginning with `OSC`;
  power domains come from pins typed `power`, using their names as domain identifiers. Fields with no
  upstream rows are reported as data-unavailable. Crystal load-capacitance evidence in CH32
  `index/operating_conditions.csv` is used only to mark presence and source, never as a numeric
  output. Alternative: emitting known-value tables - rejected because the user constraints forbid
  numeric passive constants and most fields have no upstream data at all.
- **Implicit unused and shard-backed bonded listings.** An unassigned `io` pin is unused by
  definition. Bonded pads come only from pins that have both multiple `bondedNames` and the `bonded`
  tag; STM32 slash names without those fields are not bonded. No analog-mode suggestion is emitted.
- **Tag- or label-driven tolerance.** A `5v-tolerant` tag yields `5v-tolerant`. Without the tag, a
  label matching `5V_*` or `UART_5V` yields `user-labeled-5v` with user state as evidence and no
  device claim. All other pins are `unknown`. This handles STM32 and RP shards that have no per-pin
  tolerance data and avoids asserting a voltage value.
- **CH32 evidence join with explicit provenance.** Add `evidence/pins.csv` as a declared CH32 source
  outside the manifest-verified `index/` surface. Verify the file exists, has the required
  `part_number`, `pin`, `pad`, and `type` columns, and compute its SHA-256 into `meta.json` under the
  CH32 source record. Join rows to emitted pins by normalized part number, physical pin position,
  and pad name. A row with `type` exactly `I/O/FT` after trimming and case folding adds
  `5v-tolerant`; plain `I/O` does not. Keep the existing condition-based tagging path and deduplicate
  tags. Add a CH32 gate assertion that a priority part has at least one tagged pin. Regenerate shards
  without a compatibility shim. Alternative: deriving tolerance from `index/pinout.csv` - rejected
  because that table has no electrical `type` column.
- **One shared panel component.** Add `HardwareAuditPanel.svelte` under `src/components/workspace/`.
  Mount it as a sixth, read-only tab in `SummaryDrawer.svelte` and as a dock body in the portrait
  layout. The panel derives its report from the `chip` prop and `workspaceStore.state`; it exposes
  no commit callback. `ExportModal.svelte` gains an `audit` tab that uses the pure text formatter and
  the existing copy and download controls. Neither tab union becomes persisted state.
- **Portrait dependency is integration, not duplication.** The `viewport-locked-workspace` change
  owns the persisted dock-tab field and normalizer. When that change is present, the audit body is
  added to its dock and the existing field gains the `audit` value; no second tab state is created.
  If that change has not landed, the right-pane tab alone satisfies reachability. This change does
  not edit the other change's artifacts.
- **Regression proof by unchanged solver.** Keep `evaluateWorkspace` and its helper set untouched.
  Add a regression test that compares diagnostic ids, codes, severities, and counts for fixed
  STM32, CH32, and RP fixtures against saved expectations, and keep all existing exact-count solver
  tests passing unchanged.

## Risks / Trade-offs

- **`evidence/pins.csv` is outside the upstream manifest.** Mitigation: treat the file as an
  explicitly declared extra source, record its SHA-256 in `meta.json`, fail CH32 generation on a
  missing or malformed file, and document the exception in README attribution text.
- **Join misses across part, position, and pad spellings.** Mitigation: normalize case and trim
  whitespace, match on all three fields, keep the gate assertion on priority parts, and leave
  unmatched rows untagged rather than guessing.
- **Portrait dock lands in a separate change.** Mitigation: keep the audit panel independent of the
  dock implementation and add the integration task only after that change is applied.
- **Users may expect prescriptive hardware advice.** Mitigation: the audit is explicitly a list of
  facts with evidence sources; absent upstream data is labeled data-unavailable, not filled in.
- **Regenerated CH32 shards differ from the prior catalog.** Mitigation: no compatibility shim by
  decision; gates and tests are updated in the same change and the full generation sequence runs
  before merge.

## Migration Plan

1. Extend the CH32 adapter and provenance, regenerate `public/data/`, and confirm the CH32 gate and
   `meta.json` provenance checks pass.
2. Add the pure audit module and formatter with per-vendor unit tests, including the unchanged
   solver-diagnostics regression check.
3. Add the read-only panel and export tab, then integrate the panel into the portrait dock when
   `viewport-locked-workspace` is applied.
4. Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`. The audit is derived
   on demand, so rollback consists of removing the new panel, export tab, module, and evidence
   mapping and regenerating shards from the unmodified adapter.

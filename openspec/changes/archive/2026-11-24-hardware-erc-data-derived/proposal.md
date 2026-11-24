# Proposal

## Why

The workspace currently reports only solver diagnostics, so engineers have no way to inspect
hardware-connection facts such as strapping pins, interface presence, unused pins, or pin voltage
tolerance that are available in generated chip data and their own labels and GPIO settings. A
data-derived audit surface can expose those facts without changing solver behavior or inventing
values that upstream datasets do not contain.

## What Changes

- Add a pure TypeScript audit module that builds a structured report from chip data and the current
  workspace state. The report covers four areas: strapping-pin facts, interface and power presence,
  unused I/O pins and bonded pads, and voltage-tolerance facts.
- Derive every reported value from generated chip shards, upstream dataset fields, or user-entered
  state. Do not hand-author pull directions, passive component values, VCAP tables, unused-pin
  policy text, or numeric resistor and capacitor constants. Where upstream has no data, report the
  absence explicitly instead of supplying guidance.
- Keep the audit out of `evaluateWorkspace` and the diagnostics array. Add a separate read-only Audit
  tab to the right-pane summary drawer, plus a plain-text export of the same structured facts.
- Add no workspace setting: the audit is derived on demand, so no new field is added to history,
  share URLs, project JSON, or `localStorage` sessions.
- Change the CH32 adapter to emit the existing `5v-tolerant` pin tag for rows whose upstream
  `evidence/pins.csv` `type` is `I/O/FT`, record the file digest in generated provenance, and
  regenerate shards. **BREAKING:** regenerated CH32 shards differ from the previous catalog; no
  backward-compatibility shim is provided.
- Update CH32 generation assertions and tests for the new tag, add tests for audit output on STM32,
  CH32, and RP chips, and add a regression check that solver diagnostic counts and codes are
  unchanged.

## Capabilities

### New Capabilities

- `hardware-erc-data-derived`: A read-only, data-derived hardware audit that classifies strapping
  pins and voltage tolerance from chip shards and user state, lists interface presence and unused
  or bonded pins, and exposes those facts in the workspace and a text export without altering
  solver diagnostics.

### Modified Capabilities

None. The existing `ch32-chip-data` requirement already permits evidence-backed `5v-tolerant`
tags, and the generation gate requirements are unchanged in behavior; this change extends the
evidence source used to satisfy them. No existing spec requirement is rewritten.

## Impact

- New pure core module `src/core/hardware-audit.ts` with no Svelte or DOM imports.
- New right-pane panel component and an additional tab in `SummaryDrawer.svelte`; an additional
  format tab in `ExportModal.svelte` backed by a pure text formatter.
- `tools/data-gen/adapters/ch32.ts` consumes `evidence/pins.csv` in addition to the manifest-verified
  `index/` table surface, with its SHA-256 recorded in `meta.json` provenance.
- Regenerated `public/data/chips/CH32*.json` shards, CH32 gate assertions, and Vitest fixtures.
- Dependency on `viewport-locked-workspace`: its portrait dock owns the persisted active-tab field,
  so the audit panel must be added to that dock without a second unpersisted tab state. This change
  does not edit that change's artifacts.
- No new npm dependency, no backend, no new setting, and no solver change.

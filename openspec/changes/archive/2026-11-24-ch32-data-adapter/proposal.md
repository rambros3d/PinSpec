# Proposal: CH32 Data Adapter

## Why

PinSpec currently serves only STM32 parts, but the project roadmap adds WCH CH32 support and a machine-readable, daily-regenerated source now exists at `ch32-riscv-ug/ch32-device-data`. Adding a CH32 adapter turns its CSV parts, pins, and remap evidence into `ChipData` catalog entries without hand-maintained JSON.

## What Changes

- Add `tools/data-gen/adapters/ch32.ts`, registered under the `ci-data-generation` orchestrator, consuming the MIT-licensed `ch32-riscv-ug/ch32-device-data` CSVs (`index/parts.csv`, `pinout.csv`, `routes.csv`, `packages.csv`, `manifest.csv`, `evidence/remap_fields.csv`, `evidence/pins.csv`).
- Verify each consumed source file against `index/manifest.csv` SHA-256 digests before parsing; fail generation on a digest mismatch rather than emit corrupt parts.
- Emit all 105 covered parts as `ChipData` with `vendor: 'ch32'`, `muxModel: 'remap-group'`, physical positions, power/reset/boot/analog/NC types, GPIO and peripheral signals, selector/value remap metadata, memory sizes, and semantic pin tags.
- Tag WCH 1-wire debug (`debug-sdi` on PD1-class pins), SWD pairs, USB/PD pins, bonded pins, and `5v-tolerant` / `boot` where the source evidence supports them; populate `bondedNames` for multi-pad SOP8 leads.
- Group signals by route into `PeripheralInfo.remaps` with `remapId`, `funcLabel`, and `registerNote` derived from remap evidence; keep `af: null` for CH32 mux semantics.
- Defer uncovered stems and low-confidence records to `build-warnings.json` with explicit reasons; never fail the catalog for a subset of parts.
- Add reference assertions for CH32V003F4P6 (20 pins), CH32V003J4M6 (8 bonded pins), CH32V203C8T6 (48 pins), and CH32X035G8U6 (28 pins).
- Document source attribution in `README.md` and the landing footer via `meta.json.sources`.

## Capabilities

### New Capabilities

- `ch32-chip-data`: Build-time conversion of WCH CH32 reference CSVs into complete, provenance-tagged `ChipData` entries with remap groups, bonded pins, and warning-backed deferral.

### Modified Capabilities

- None. `openspec/specs/` is empty. Behavior depends on `ci-data-generation` from the `ci-native-data-generation` change but does not alter that capability's requirements.

## Impact

- New `tools/data-gen/adapters/ch32.ts`; new unit tests for CSV normalization, manifest verification, remap grouping, bonded pins, tags, and warnings.
- New `public/data/chips/<CH32_PART>.json` shards and `index.json` entries with `vendor: 'ch32'`; `meta.json.sources.ch32` counts/SHA/license; `build-warnings.json` deferred-part records.
- Reuses existing `src/core/types.ts` fields (`PinTag`, `PeripheralRemapOption`, `ChipData.vendor/muxModel`); no core solver or UI changes in this change.
- `README.md` upstream credits; `.github/workflows/deploy.yml` gains the CH32 source fetch via the shared orchestrator (no new workflow logic).
- No committed generated data, no new runtime dependency, no backend.

## Dependencies

- `ci-native-data-generation` (`ci-data-generation`): orchestrator, `sources.ts`, provenance, warnings, and per-vendor gates must exist first.

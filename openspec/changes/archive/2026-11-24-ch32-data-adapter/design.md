# Design: CH32 Data Adapter

## Context

See `proposal.md` for motivation and `specs/ch32-chip-data/spec.md` for the behavior contract. The source is the MIT-licensed `ch32-riscv-ug/ch32-device-data` repository, regenerated daily by its own Actions: `index/parts.csv` lists 105 covered parts, `index/pinout.csv` gives physical lead (`pin`, with `EP` for exposed pad), `pad`, `port`, `gpio`, `kind`, `peripheral`, `role`, `signal`, `route`, `selector`, `value`, `af`, `condition`, `confidence`, and `basis`; `index/routes.csv` and `evidence/remap_fields.csv` carry remap selector/register/bit/value detail; `evidence/pins.csv` carries electrical type; `index/manifest.csv` carries SHA-256 digests; `index/packages.csv` gives package metadata. `ch32-rs/ch32-data` is not used. `src/core/types.ts` already declares all required CH32 fields but nothing emits them. This change depends on the adapter contract introduced by `ci-native-data-generation`.

## Goals / Non-Goals

**Goals:**

- Emit complete `ChipData` for all 105 covered parts with CH32-specific mux, tag, and remap semantics.
- Make deferral explicit and non-fatal, so daily upstream regeneration cannot break the whole catalog.
- Keep STM32 output untouched and avoid touching solver, exporters, or UI.

**Non-Goals:**

- CH32 remap solving, diagnostics, UI badges, and exporters (separate changes).
- Curated hand-maintained CH32 overlays for the ~40 uncovered stems; those are warnings only.
- RP data, JSON/URL schema version bumps, and new runtime dependencies.

## Decisions

1. **CSV adapter under the shared orchestrator.** `tools/data-gen/adapters/ch32.ts` implements the vendor-adapter contract from `ci-native-data-generation`: it receives resolved source paths and a warning collector, and returns chips, index entries, and gate results. Alternative: a standalone script, rejected because it would duplicate output and gate logic.
2. **Manifest-verified reads.** Every consumed CSV is hashed (SHA-256) and compared to `index/manifest.csv` before parsing; a mismatch aborts only CH32 generation with a named file error. Alternative: trust upstream files, rejected because the source is regenerated daily and CI must fail loudly on corruption.
3. **Physical pins keyed by `pin`.** One `PinInfo` per lead position, including `EP`; `kind` maps `gpio` to `io`, `power`/`reset` to their types, `analog` to `io` with an `adc` tag, `nc` to `nc`, and other kinds to `other` behavior without inventing types. When several `gpio`/`pad` values share a `pin`, merge signals, set `bondedNames`, and add the `bonded` tag (CH32V003J4M6 SOP8). Alternative: one pin per pad, rejected because it would break physical-position rendering.
4. **Route-driven remaps.** Group `pinout.csv` rows by `peripheral` and `route`: `main`/`default` are `remapId: 0`, `remap-N` becomes `remapId: N`. `selector`/`value` and `evidence/remap_fields.csv` produce `registerNote`; `funcLabel` uses the upstream `route`/`af` label; all CH32 signals keep `af: null`. A signal without a matching route still emits at remap zero. Alternative: flatten all routes into duplicate signals, rejected because it loses coupled-remap semantics needed by the solver change.
5. **Evidence-based tags only.** `debug-sdi` for 1-wire SWIO pins (PD1-class), `debug-swd` for SWD pairs, `usb` for USB/PD pins, `adc` for analog-capable GPIOs, `boot` and `5v-tolerant` only when `condition`/`basis` evidence supports them. Alternative: tag by part family heuristic, rejected because it mislabels variant-specific pins.
6. **Warn-and-continue deferral.** Parts missing from `parts.csv` pinouts, low-confidence rows, and parse failures get a warning with part stem and reason. Alternative: hard fail, rejected by the project rule that a malformed subset must not fail the catalog; the ~40 uncovered stems are accepted scope.
7. **Fixed assertions before gate pass.** Verify CH32V003F4P6 (20), CH32V003J4M6 (8 bonded), CH32V203C8T6 (48), and CH32X035G8U6 (28) inside the CH32 gate; count all 105 parts and log the total. Alternative: assert only aggregate counts, rejected because it hides package and bonding regressions.

## Risks / Trade-offs

- [Upstream CSV schema changes on daily regeneration] -> Parse by stable column names with explicit required-column checks and emit a named warning for unknown values rather than guessing.
- [Manifest digests change between generation and CI fetch] -> Fetch the repository and manifest in one acquisition step per CI run; pin the commit in `meta.json.sources.ch32` for reproducibility.
- [Route evidence incomplete for some peripherals] -> Emit default-route signals with no fabricated register note and record a warning when a remap lacks selector evidence.
- [Bonded pins could double-count signals] -> Merge by physical `pin`, deduplicate by `(peripheral, signal, remapId)`, and assert pin counts in the reference gate.
- [105 parts increase output size] -> CH32 chips are small; the existing 150 MB aggregate cap remains enforced by the STM32 gate, and per-chip shards stay compact.
- [Low-confidence rows may still be partially useful] -> Defer the whole affected part with a confidence reason; revisit when upstream improves confidence labels.

## Migration Plan

1. Land `ci-native-data-generation` first; confirm the adapter contract and warning collector are available.
2. Add CH32 source acquisition to `sources.ts` with manifest verification and license metadata.
3. Implement the adapter in small units: part/index parsing, pin geometry/bonding, signals/remaps, tags, warnings.
4. Add tests for manifest failure, bonded pins, remap grouping, tags, deferral, and the four reference gates.
5. Verify `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; confirm STM32 golden hashes unchanged. Rollback is a git revert plus regenerating data; no committed generated artifacts exist.

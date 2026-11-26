# Design

## Context

See `proposal.md` - Why. The existing generator in `tools/data-gen/index.ts` is a single STM32 CLI: it clones two repos into `.cache/`, joins ST XML with Embassy chip JSON, emits `ChipData` shards, runs Gate 1 reference assertions and writes `meta.json` / `index.json` / `build-warnings.json` plus the checked-in hero snapshot. `src/core/types.ts` already declares `vendor`, `muxModel`, `PinTag`, `funcLabel`, `remapId`, `resourceId` and `ChipPioConfig`, but no adapter emits them. All generated data is gitignored and produced in GitHub Actions.

## Goals / Non-Goals

**Goals:**
- Refactor generation into an orchestrator plus vendor adapters so RP data is emitted in the same run as STM32/CH32 without changing STM32 output.
- Derive every RP fact from machine-readable upstream references fetched in CI; no committed pin tables.
- Emit RP gate assertions and provenance/warning records that CI enforces.

**Non-Goals:**
- No application UI, solver or exporter changes (owned by later changes).
- No Rust-side or device runtime code; no direct hardware access.
- No modification of upstream reference data under `.cache/`.

## Decisions

1. **KiCad symbols as the physical-pin source.** KiCad `MCU_RaspberryPi.kicad_symdir/{RP2040,RP2350A,RP2350B,RP2354A,RP2354B}.kicad_sym` gives physical pad numbers, multi-name pads, electrical types and (via footprints) geometry. Research confirmed no better machine-readable physical source exists; `black-wire-pinouts` is board-level images only. Alternative: hand-curated pin tables - rejected because the user requires all data auto-generated in CI.
2. **FUNCSEL from picotool / pico-sdk.** `pin_functions_rp2040` / `pin_functions_rp2350` arrays (or pico-sdk `hardware/gpio.h` Doxygen tables) provide GPIO-indexed F0-F11 mappings with function labels. Join to KiCad pins by GPIO number parsed from the pad name (first token before `/`). `funcLabel` is preserved verbatim; `af` is the FUNCSEL index. Alternative: Zephyr pinctrl bindings - rejected as incomplete for HSTX/PIO.
3. **PWM `resourceId` from table values.** Parse `PWM{slice}{A|B}` from the FUNCSEL entry label instead of computing slice from GPIO modulo; this is the only way to capture RP2350B slice 8-11 mapping correctly.
4. **Variant metadata from Zephyr + documentation.** Zephyr `rp2040.dtsi` / `rp2350*.dtsi` supplies memory sizes; `raspberrypi/documentation` `rp2040.adoc` / `rp2350.adoc` supplies the variant table (RP2354A/B 2 MB stacked flash, RP2350B ADC0-7 on GPIO40-47, slices 8-11 package-exclusive).
5. **PIO config emitted, not inferred by the solver.** `ChipPioConfig` carries PIO instances, state machines and `gpioBaseOptions` (`[0]` or `[0,16]`); validation logic lives in the core solver change.
6. **Warnings over hard failure.** Unresolved symbols or FUNCSEL entries go to `build-warnings.json`; generation continues, matching the STM32 policy for malformed parts.
7. **Attribution in `meta.json` `sources.rp`.** KiCad CC-BY-SA-4.0 (generated-file exception), pico-sdk/picotool BSD-3-Clause, Zephyr Apache-2.0; consumed by the landing footer and displayed with upstream SHAs.

## Risks / Trade-offs

- [KiCad s-expression schema drifts between versions] -> Parser tolerates unknown s-expression nodes and fails per-file into `build-warnings.json`.
- [FUNCSEL table source switches between picotool arrays and pico-sdk Doxygen] -> Parser normalizes both into the same intermediate FUNCSEL record; tests cover both shapes.
- [RP2350B ADC/pin exclusivity is easy to mis-map] -> Gate assertions explicitly verify GPIO40-47 and slice 8-11 presence/absence.
- [Extra CI clone/fetch time] -> Cache existence check only (no refresh) mirrors STM32; SHAs recorded in `meta.json`.
- [Generated JSON growth] -> RP shards are small (6 parts); monitor the existing 150 MB budget in the gate.

## Migration Plan

1. Introduce `tools/data-gen/adapters/rp/` with pure parser/normalizer helpers and unit tests in `tests/data-gen.test.ts`.
2. Wire the RP adapter into the orchestrator after STM32 emission, reusing shared emitters for `index.json` / `meta.json` / `build-warnings.json`.
3. Add RP gate assertions and attribution fields; run `npm run gen-data` locally with fresh `.cache/` once.
4. Verify with `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`. No committed generated data; CI regenerates.

## Open Questions

None. The source set and join keys were verified during research; no deferrable choice changes the specs or task breakdown.

# Design: CI-Native Data Generation

## Context

See `proposal.md` for motivation. Today `tools/data-gen/index.ts` is a single ~734-line `main()` that clones two STM32 repositories, parses XML and Embassy JSON, writes all artifacts, writes a committed hero snapshot, and applies global gates. `src/pages/LandingPage.svelte` imports `src/data/hero-chip.json` at build time, while `src/state/catalog.svelte.ts` already fetches chip shards from `${import.meta.env.BASE_URL}data/chips/<ID>.json`. `public/data/` and `.cache/` are gitignored; CI already rebuilds on push, dispatch, and a weekly cron. No existing capability specs constrain this work.

## Goals / Non-Goals

**Goals:**

- Establish an adapter boundary that later CH32 and RP work can plug into without editing the STM32 logic.
- Prove STM32 output is unchanged by the refactor, using pinned-source golden comparisons.
- Make every source revision, license, warning, and gate result visible in generated artifacts and CI logs.
- Make generated data the only source of hero chip data at runtime.

**Non-Goals:**

- Adding CH32, RP, solver, exporter, or UI behavior beyond the hero data source.
- Preserving the committed hero snapshot or any legacy `version: 1` data path (no backward compatibility required).
- Adding a runtime backend, new npm dependency, or committed generated output.

## Decisions

1. **Thin orchestrator + `sources.ts` + `adapters/stm32.ts`.** The orchestrator owns argument parsing, output directory reset, shared warning collection, artifact writing, gate dispatch, and logging. `sources.ts` owns clone/refresh, revision resolution, and license constants; an adapter receives resolved source paths and a writer context, and returns chips, index entries, warnings, and gate results. Alternative: keep one file with vendor branches, rejected because each new vendor would duplicate gate/warning logic and risk STM32 regressions.
2. **Golden byte comparison before removing the monolith.** Capture STM32 chip shards from the current generator at two pinned commits, then compare adapter output after normalization of the `generatedAt` timestamp only. Alternative: rely on existing reference assertions alone, rejected because they check a handful of fields, not whole-file drift.
3. **Provenance in `meta.json.sources`.** Each vendor entry carries `commit`/content SHA, `license`, and `chipCount`; existing STM32 top-level fields stay untouched so the landing footer and tests keep working. Alternative: a separate provenance file, rejected because consumers already load `meta.json`.
4. **Warning collector with mandatory vendor attribution.** Extend `BuildWarning` with `vendor: VendorId` and keep `file`/`refName`/`reason`; orchestrator writes `build-warnings.json` once after all adapters run, including empty results. Alternative: per-vendor warning files, rejected because it fragments diagnostics.
5. **Hero via `catalogStore.loadChip()`.** `LandingPage.svelte` replaces the JSON import with a `$state<ChipData | null>` plus `loading`/`error` states populated in `onMount`, and all derived demos/exports/navigation read the resolved value. The generator stops writing `src/data/hero-chip.json` and the file is deleted. Alternative: keep a build-time import and regenerate the snapshot in CI, rejected because it violates the "no committed generated data" rule and cannot reflect registry changes.
6. **Per-vendor gates with asymmetric strictness.** STM32 keeps every current assertion and threshold as hard failures. Other vendors run their own reference assertions; a missing subset emits warnings instead of failing the build, so future adapters can land incrementally. Alternative: global thresholds applied to combined output, rejected because CH32/RP counts would mask STM32 regressions.
7. **CI fetches sources explicitly.** The deploy workflow gains a step that runs the orchestrator's source acquisition (or `npm run gen-data`, which performs it) after `npm ci`; the existing push/dispatch/weekly triggers and `BASE_PATH` build remain. Alternative: commit a source cache, rejected by the no-generated-data rule.

## Risks / Trade-offs

- [Upstream schema drift changes STM32 bytes] -> Pin golden sources by commit in the verification step and require exact chip-shard equality before merging.
- [Existing `.cache/` checkouts are existence-only and may be stale] -> CI starts from a clean checkout each run; document that local refreshes require deleting the cache directory.
- [Hero fetch briefly leaves no chip for export previews] -> Guard derived previews until the chip resolves and render an explicit loading/error state; keep navigation disabled until loaded.
- [Deleting the committed hero snapshot breaks external deep links that depended on it] -> No backward compatibility is required; workspace routing continues to use `#/mcu/<PART>` and generated shards.
- [Loose non-STM32 gates could hide a broken vendor] -> Each vendor declares explicit reference parts; counts and match rates are logged and warnings are surfaced in `build-warnings.json` for CI review.
- [Golden comparison retains two pinned fixtures in tests] -> Store hashes rather than full catalogs; keep test data under 150 MB rule and gitignore rules intact.

## Migration Plan

1. Capture golden STM32 output hashes from the current generator at pinned upstream commits.
2. Introduce `sources.ts` and `adapters/stm32.ts`, leaving the old entry point temporarily delegating to the orchestrator; verify byte equality.
3. Switch the landing hero to `catalogStore.loadChip()`, delete `src/data/hero-chip.json`, and remove the hero write from generation.
4. Move gates to per-vendor functions and centralize warnings/provenance; update CI to fetch all sources.
5. Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; remove the old monolith once all checks pass. Rollback is a git revert plus regenerating data; no persisted state exists.

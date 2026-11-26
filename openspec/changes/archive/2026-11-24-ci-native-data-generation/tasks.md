# Tasks: CI-Native Data Generation

## 1. Baseline and source acquisition

- [x] 1.1 Capture golden STM32 output hashes from the current generator at two pinned upstream commits and record them in a deterministic fixture; verify a repeat run produces identical chip-shard hashes apart from `generatedAt`.
- [x] 1.2 Create `tools/data-gen/sources.ts` with clone-if-absent acquisition, short-SHA resolution, a literal `unknown` fallback, and license constants for ST open pin data and Embassy; verify with a unit test in `tests/data-gen.test.ts` covering resolved and unresolved revisions.
- [x] 1.3 Define the shared vendor-adapter contract and output context (paths, warning collector, gate registry) in `tools/data-gen/types.ts`; verify `npm run check` passes with strict TypeScript and no `src/core/` DOM imports.

## 2. STM32 adapter and byte stability

- [x] 2.1 Move all STM32-specific parsing, matching, normalization, and chip emission from `index.ts` into `adapters/stm32.ts`; verify every STM32 chip shard matches the golden hashes from task 1.1 exactly.
- [x] 2.2 Reduce `index.ts` to an orchestrator that resolves sources, resets output directories, invokes registered adapters, and writes artifacts once; verify `npm run gen-data` emits at least 1,000 MCUs with the expected `meta.json`, `index.json`, and `build-warnings.json`.
- [x] 2.3 Add a regression test that pins the six STM32 reference parts (package, pin count, power pins, key AF/SYS/DMA/BGA fields) and compare adapter output against golden hashes; verify `npm test` passes.

## 3. Provenance and warnings

- [x] 3.1 Emit `meta.json.sources` with per-vendor commit/SHA, license, and chip count while preserving existing STM32 top-level fields; verify a unit test asserts all source entries are non-empty and legacy fields remain.
- [x] 3.2 Centralize warning collection so each record carries `vendor`, optional `refName`/`file`, and `reason`, and write `build-warnings.json` even when empty; verify tests cover an unmatched STM32 variant and the zero-warning case.
- [x] 3.3 Update `README.md` upstream credits and the landing footer data source to reflect `meta.json.sources`; verify the documented provenance fields match a generated `meta.json` after `npm run gen-data`.

## 4. Lazy hero chip data

- [x] 4.1 Replace the `hero-chip.json` import in `src/pages/LandingPage.svelte` with a `$state` chip resolved via `catalogStore.loadChip('STM32G431CBU6')`, including loading/error states and null-guards for demos, exports, and navigation; verify `npm run check` passes and the page renders the hero in `npm run dev` without the import.
- [x] 4.2 Delete the committed `src/data/hero-chip.json` snapshot and remove its write from the generator; verify a fresh `npm run gen-data` does not recreate the file and that the generated `public/data/chips/STM32G431CBU6.json` loads at runtime.
- [x] 4.3 Assert in a test that `LandingPage.svelte` contains no static hero-chip JSON import and that the catalog store fetch path uses `import.meta.env.BASE_URL`; verify `npm test` and `npm run check` pass.

## 5. Per-vendor gates and CI

- [x] 5.1 Replace global thresholds with a per-vendor gate registry; keep STM32's six reference assertions plus >=1,000 MCUs, >=95% match rate, and <150 MB as hard failures, and make non-STM32 shortfalls warnings; verify by injecting a corrupted reference chip in a test and observing a named gate error.
- [x] 5.2 Update `.github/workflows/deploy.yml` to acquire all configured sources during the build job before generation, retaining push, manual dispatch, weekly schedule, and `BASE_PATH` subpath build; verify a clean Actions run produces generated data with no committed source cache.
- [x] 5.3 Log a per-vendor gate summary (chip counts, match rate, warnings, total size) at the end of generation; verify the console output lists each vendor and that `build-warnings.json` counts agree with the log.

## 6. Integration verification

- [x] 6.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` from a clean generated catalog; verify all three succeed with zero TypeScript or build warnings.
- [x] 6.2 Confirm the production build fetches hero and catalog data through `import.meta.env.BASE_URL` with no absolute `/data` requests; verify by inspecting the built `dist` output and previewing under the `/pinspec/` subpath.

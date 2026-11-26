# Tasks

## 1. Gate foundation

- [x] 1.1 Add a pure, orchestrator-level gate module under `tools/data-gen/` invoked after all adapters emit and before final artifact writes; verify `npm run gen-data` still succeeds on the current baseline and that an injected assertion failure aborts with a non-zero exit and no partial catalog
- [x] 1.2 Add Vitest coverage for the gate runner's pass/fail and fail-fast behavior; verify `npm test` passes with zero warnings

## 2. STM32 and global artifact gates

- [x] 2.1 Implement the STM32 gate: at least 1000 parts plus reference assertions for STM32F411CEU6, STM32G431CBU6, STM32F103C8T6 (AFIO), STM32H743VIT6, STM32U575RIT6 (DMA), and STM32H743XIH6 (TFBGA grid); verify a full generation passes and a corrupted reference fixture fails with the offending part named
- [x] 2.2 Implement the 150 MB uncompressed budget check and shard-integrity validation (index entry resolves to a parseable, consistent `chips/<MCU>.json` with no `NaN`/`undefined`); verify a synthetic over-budget and broken-shard fixture each fail with the byte total or shard id reported
- [x] 2.3 Add unit tests for the STM32 assertions and shard/budget checks; verify `npm test` passes

## 3. CH32 generation gate

- [x] 3.1 Implement CH32 coverage and priority-part assertions: all 105 `ch32-device-data` parts emitted, with CH32V003F4P6 (20 pins), CH32V003J4M6 (8 bonded pins), CH32V203C8T6 (48), and CH32X035G8U6 (28) carrying `muxModel: remap-group`, grouped `remaps[]`, `bondedNames`/`bonded` tags, and `debug-sdi` on PD1; verify generation passes and a missing-priority-part fixture fails
- [x] 3.2 Add unit tests for the CH32 coverage and structural assertions; verify `npm test` passes

## 4. RP generation gate

- [x] 4.1 Implement RP assertions: RP2040 (56 pins/30 GPIO), RP2350A (60/30), RP2350B (80/48), exposed pad on QFN packages, `muxModel: funcsel-pio` with `funcLabel`/`resourceId` covering `PWM0A` through `PWM11B`, and HSTX/ADC/QSPI/SWD/PIO tags; verify generation passes and an invalid-slice fixture fails with the offending resource
- [x] 4.2 Add unit tests for the RP pin/GPIO/slice/tag assertions; verify `npm test` passes

## 5. Provenance and warning contracts

- [x] 5.1 Extend `meta.json` with `generatedAt`, a seven-source `sources` map (`st-open-pin-data`, `stm32-data-generated`, `ch32-device-data`, `kicad`, `pico-sdk`, `zephyr`, `raspberry-pi-docs`) carrying `sha`/`url`/`license`, and per-vendor counts and ratios, sourced from centralized license constants; verify a generated `meta.json` satisfies a schema unit test
- [x] 5.2 Implement the always-present `build-warnings.json` as `{ id, vendor, source, reason }[]`, recording deferred/unmapped parts without failing generation; verify unit tests cover a deferred CH32 variant and the empty-array case
- [x] 5.3 Add unit tests asserting complete provenance (no missing SHA or count) and the warning schema; verify `npm test` passes

## 6. CI workflow and subpath verification

- [x] 6.1 Update `.github/workflows/deploy.yml` to fetch all seven reference sources, force-delete `.cache/` on the weekly cron before `npm run gen-data`, and preserve push/manual/weekly triggers plus `upload-pages-artifact@v5` and `deploy-pages@v4`; verify the YAML parses and a step-ordering check confirms generation precedes tests, check, and build
- [x] 6.2 Add a unit test asserting runtime asset/data URLs are built from `import.meta.env.BASE_URL` with no root-absolute `/data/` or `/assets/` literal; verify `npm test` passes
- [x] 6.3 Add a CI smoke step that serves `dist` mounted at `/pinspec/` and requests `index.html`, `data/index.json`, and one sample chip shard; verify a local reproduction returns 200 for all three and fails on an injected absolute path
- [x] 6.4 Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; verify all three pass with zero warnings

## 7. Documentation and attribution

- [x] 7.1 Update `README.md` with the three-vendor `gen-data` sources, the gate and verification commands, and the full upstream license list; verify every documented command runs as written
- [x] 7.2 Update `AGENTS.md` to describe shipped multi-vendor behavior and the new gates, removing stale roadmap claims for now-shipped fields; verify no shipped field is still described as unimplemented
- [x] 7.3 Update the landing technical footer and hero copy to list all seven sources with their licenses and render SHAs/counts from `meta.json` using semantic tokens; verify the footer renders in a subpath build with sample metadata and introduces no raw color literals
- [x] 7.4 Add an automated scan for emoji characters and raw color literals outside `src/themes/daisyui.css`; verify the scan passes across all files touched by this change

## 8. Final integration verification

- [x] 8.1 Run the full sequence: `npm run gen-data` with all sources, `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`, and the subpath smoke check; verify all pass, total generated JSON is under 150 MB, and no STM32 reference assertion regressed
- [x] 8.2 Confirm scope isolation: verify `git status` shows edits only to this change directory and the documented files, with no other change directory or generated data committed

## Workflow follow-up

- Sync delta specs to main specs after review satisfies the project requirements.
- Archive the change and verify the archived result.
- Commit the change with a clear message across the affected files.

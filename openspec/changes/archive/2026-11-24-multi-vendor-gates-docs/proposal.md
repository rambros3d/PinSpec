# Proposal

## Why

The STM32 baseline is green, but the six in-flight multi-vendor changes (CI data generation, CH32 and RP adapters, core solver, exporters/state, and workspace UI) have no shared acceptance contract: nothing yet proves that all three vendors generate deterministically in CI, that emitted shards are structurally valid and within the Pages budget, or that the shipped documentation and landing-page attribution actually reflect the new sources. Without one explicit gate layer, a regression in any vendor silently reaches GitHub Pages. This change defines that single, testable gate and closes the documentation/attribution loop.

## What Changes

- Add a `multi-vendor-ci-gates` build gate that runs inside `npm run gen-data` and fails the build when any vendor assertion, shard-integrity check, byte-budget check, or `build-warnings.json` contract is violated.
- Add STM32 gate assertions (>=1000 parts plus the six reference parts) and CH32 gate assertions (the 105 covered parts from `ch32-device-data` plus explicit priority-part structural checks).
- Add RP gate assertions for RP2040/RP2350A/RP2350B pin counts, GPIO counts, exposed pad, PWM slice boundary keys (`PWM0A`..`PWM11B`), and HSTX/ADC/QSPI/SWD/PIO tags.
- Record per-vendor source SHAs, counts, coverage/match ratios, and `generatedAt` in `meta.json`; record every deferred/unmapped part with a reason in `build-warnings.json` instead of failing generation (per AGENTS.md).
- Extend `.github/workflows/deploy.yml` to fetch all reference sources with a forced weekly refresh, run the full gate/test/check/subpath-build sequence, and verify subpath asset and runtime data fetch URLs.
- Add unit tests that validate the gate helpers, shard integrity, warning contract, and subpath URL construction; run them with the existing `npm test`.
- Update `README.md`, `AGENTS.md`, and the landing-page technical footer to document multi-vendor generation, the new sources, and all upstream licenses/attributions.
- **BREAKING**: Not applicable. No backward-compatibility work is in scope: `version: 1` share/import compatibility is explicitly out of scope, and no legacy-state tests are required.

## Capabilities

### New Capabilities
- `multi-vendor-ci-gates`: Owns the cross-vendor generation assertions, artifact budget and shard-integrity validation, `meta.json`/`build-warnings.json` contracts, CI source-fetch and subpath-verification workflow, and the documentation/attribution requirements that certify a releasable multi-vendor build.

### Modified Capabilities
None. `openspec/specs/` is empty, so no existing capability requirements change.

## Impact

- `tools/data-gen/` (orchestrator and vendor adapters): gate invocation and assertion helpers shared by all three adapters; `meta.json` and `build-warnings.json` emitters gain per-vendor fields.
- `public/data/` (generated, gitignored): `index.json`, `meta.json`, and `chips/<MCU>.json` schemas gain vendor fields consumed by the gate; total output must stay under 150 MB.
- `.github/workflows/deploy.yml`: additional source-checkout/refresh steps and subpath verification while preserving push/manual/weekly triggers, `actions/upload-pages-artifact@v5`, and `actions/deploy-pages@v4`.
- `tests/`: new Vitest gate/shard/warning/URL tests; existing `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` commands remain the verification path.
- `README.md`, `AGENTS.md`, `src/pages/LandingPage.svelte` footer, and landing copy: multi-vendor docs plus credits for ST (BSD-3-Clause), Embassy (MIT/Apache-2.0), ch32-device-data (MIT), KiCad (CC-BY-SA-4.0, generated-file exception), pico-sdk (BSD-3-Clause), Zephyr (Apache-2.0), and Raspberry Pi docs (CC-BY-SA-4.0).
- Depends on `ci-native-data-generation`, `ch32-data-adapter`, `rp-data-adapter`, `multi-vendor-core-solver`, `multi-vendor-exporters-state`, and `multi-vendor-workspace-ui`; no other change directory is edited.
- Zero emojis in any artifact, log, test, or document touched by this change.

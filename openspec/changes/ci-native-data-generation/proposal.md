# Proposal: CI-Native Data Generation

## Why

The STM32 catalog generator is a 734-line monolith that hardcodes STM32 paths, global gates, and a committed hero-chip snapshot; this blocks the CH32/RP adapters and hides source provenance. The catalog must be regenerated entirely in GitHub Actions from reference repos before any multi-vendor data lands.

## What Changes

- Split `tools/data-gen/index.ts` into a thin orchestrator, `sources.ts` (clone/refresh/SHA/license), and `adapters/stm32.ts`, emitting byte-identical STM32 JSON to today.
- Emit per-vendor source SHAs and licenses in `meta.json.sources`, keeping the existing STM32 `meta.json` fields for compatibility with the current footer.
- Centralize `build-warnings.json` emission in the orchestrator so every vendor contributes warnings with a vendor label, reference, and reason; unmatched parts never fail the catalog.
- Landing hero lazy-fetches `data/chips/STM32G431CBU6.json` through `catalogStore` instead of importing the committed `src/data/hero-chip.json`; the snapshot file and the generator's hero write are removed. **BREAKING**: hero rendering becomes async with a loading/error state.
- Replace global gates with per-vendor gate functions while retaining the six STM32 reference assertions and the >=1000 MCU / >=95% match / <150 MB thresholds for the STM32 vendor.
- Update `.github/workflows/deploy.yml` to fetch every configured source in Actions and rebuild on every push, manual dispatch, and the existing weekly schedule.

## Capabilities

### New Capabilities

- `ci-data-generation`: Build-time, CI-executed catalog generation with pluggable per-vendor adapters, source provenance, warning collection, per-vendor gates, and lazy-fetched hero data.

### Modified Capabilities

- None. `openspec/specs/` is empty; there are no existing capabilities to change.

## Impact

- `tools/data-gen/index.ts`, new `tools/data-gen/sources.ts` and `tools/data-gen/adapters/stm32.ts`, `tools/data-gen/helpers.ts`.
- `public/data/{meta,index,build-warnings}.json` shape gains `sources` / vendor-labeled warnings; chip shard bytes stay identical for STM32.
- `src/pages/LandingPage.svelte`, `src/state/catalog.svelte.ts`, removal of committed `src/data/hero-chip.json`.
- `.github/workflows/deploy.yml`, `tests/data-gen.test.ts`, `README.md` provenance/credits.
- No runtime backend, no new dependencies, no `src/core/` DOM imports.

## Dependencies

- None. This is Phase 0; `ch32-data-adapter` and `rp-data-adapter` build on this capability.

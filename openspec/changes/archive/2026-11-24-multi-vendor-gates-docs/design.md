# Design

## Context

See `proposal.md` for motivation. PinSpec currently generates an STM32-only catalog in `tools/data-gen/index.ts` and verifies it with ad-hoc Gate 1 assertions. The six in-flight changes add CH32, RP, vendor-aware core/state/exporters, and workspace UI, but none of them defines a single release gate. `public/data/` is gitignored, `.cache/` clones are existence-only and never refreshed locally, `openspec/specs/` is empty, and the landing footer in `LandingPage.svelte` hardcodes the two STM32 sources. The deploy workflow already runs on push, manual dispatch, and a weekly cron and must keep that shape.

## Goals / Non-Goals

**Goals:**
- One gate that local `npm run gen-data` and CI both run, producing identical pass/fail behavior.
- Assertions that are pure, host-testable, and keyed to stable structural fields, not volatile ordering.
- Machine-readable provenance (`meta.json`) and deferrals (`build-warnings.json`) that the UI can render generically.
- Deployment only when generation, tests, checks, subpath build, and subpath fetch smoke checks all pass.
- Documentation and attribution updated as part of the same change, with no emojis and no raw color literals outside `src/themes/daisyui.css`.

**Non-Goals:**
- Any `version: 1` share-link or import compatibility work; v1 compatibility is explicitly out of scope.
- Editing the other five in-flight change directories or their application source.
- Changing the STM32 normalization rules or upstream reference data under `.cache/`.
- Adding a backend, runtime data generation, or server-side secrets.

## Decisions

- **Gate placement:** A single orchestrator-level check module runs after all three adapters emit and before final artifact writes. Alternatives considered: per-adapter gates (diverge from local/CI parity) and CI-only shell checks (not unit-testable, cannot stop local generation). The orchestrator gate keeps one source of truth and can abort before publishing a partial catalog.
- **Assertion style:** Checks are pure functions over emitted `ChipData`/`index.json`/`meta.json` objects, living under `tools/data-gen/` with Vitest coverage. They read structural invariants (pin counts, exposed pad, `muxModel`, `resourceId` range, tags, bonded names, remap groups, power pins, AF/SYS/DMA entries) rather than exact signal ordering, so benign upstream reordering does not break the weekly build.
- **Provenance schema:** `meta.json` gains a `sources` map keyed by stable id (`st-open-pin-data`, `stm32-data-generated`, `ch32-device-data`, `kicad`, `pico-sdk`, `zephyr`, `raspberry-pi-docs`) carrying `sha`, `url`, `license`, plus per-vendor `counts` and `ratios`. The footer iterates this map instead of hardcoding per-vendor markup, so adding a source later needs no UI change. The license strings are centralized in the generator and emitted into `meta.json` to keep README/AGENTS/footer consistent.
- **Deferrals:** `build-warnings.json` is a flat array of `{ id, vendor, source, reason }`. Missing curated mappings are warnings, never hard failures; structural corruption and failed assertions are hard failures. The file is always emitted, even when empty.
- **Cache refresh:** Local runs keep the existing existence-only cache check. On the weekly scheduled workflow, a step deletes `.cache/` before `npm run gen-data` so upstream SHAs advance; push/manual runs reuse the cache for speed. SHAs come from the cloned repos and are written to `meta.json` by the generator.
- **Subpath verification:** A unit test asserts that runtime fetch helpers build URLs from `import.meta.env.BASE_URL` and contains no root-absolute `/data/` or `/assets/` literal. A CI smoke step serves `dist` mounted at `/pinspec/` and requests `index.html`, `data/index.json`, and one sample chip shard, failing on any non-200. Alternative: build-only check; rejected because it cannot catch broken runtime fetches.
- **Documentation:** README verification section and AGENTS.md status section are updated to `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; the landing footer gains a generic license list and per-vendor SHAs. All added copy must use semantic tokens and contain no emojis.

## Risks / Trade-offs

- **Upstream schema drift** breaks assertions weekly -> fail loudly with the offending part id and recorded SHA; never silently degrade output.
- **150 MB budget pressure** from three vendors -> keep per-chip shards and omit unused register/memory-map fields; the gate reports the byte total so trimming is targeted.
- **Brittle priority assertions** could reject harmless upstream signal reordering -> assert only stable counts and structural tags; keep volatile signal sets out of the gate.
- **Weekly network/flaky clone** -> refresh only on schedule, and because a failed workflow never reaches the upload step, the previously deployed Pages artifact remains live.
- **Generic footer** loses per-vendor wording -> acceptable trade-off for lower maintenance; vendor-specific detail stays in README/AGENTS.
- **Extra subpath smoke step** adds CI time -> bounded to three small requests against a local static server; worth the regression coverage.
- **Docs/license drift** -> emit license and source metadata from one generator constant consumed by footer, README, and AGENTS.md.

## Migration Plan

No data migration is required: v1 compatibility is explicitly out of scope and generated data is never committed. The deploy workflow change is self-contained; a failing verification step prevents artifact upload, so the last successful deployment remains the rollback state.

## Open Questions

- Confirm the exact KiCad GitLab source URL and revision used by the RP adapter once that change lands; the gate only requires that `meta.json` records a SHA and license string, so this does not alter the spec or task breakdown.

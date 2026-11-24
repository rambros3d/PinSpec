# Design

## Context

See `proposal.md` - Why. The repository already ships STM32, CH32, and RP catalogs and a version-2 URL/JSON state codec with no version-1 path. `src/core/` is pure TypeScript with no DOM or Svelte imports. The official STM32 open pin data checkout contains 281 board `.ioc` files using a flat `key=value` format; these are read-only upstream data under the gitignored `.cache/`. The workspace state store already exposes `setPendingHandoff` and `openMcu` for opening an arbitrary MCU, and `src/pages/WorkspacePage.svelte` owns the workspace drop targets.

## Goals / Non-Goals

**Goals:**
- Parse and import `.ioc` files deterministically in pure TypeScript, with no new npm dependency.
- Resolve part IDs and pin names well enough to seed a valid version-2 workspace for catalog-covered STM32 parts.
- Provide a small, checked-in catalog of official ST board presets that reuses the existing MCU-open flow.

**Non-Goals:**
- RP and CH32 board presets (RP board headers are GPIO-indexed and not cached; CH32 has no pin-level board maps).
- Backend services, runtime file upload to a server, or secrets.
- Changes to generated shards, `public/data/`, `.cache/`, or the data generator.
- Backward-compatibility shims for version-1 state.

## Decisions

1. **Pure parser in a new core module.** Implement the `.ioc` reader and signal mapper in a new pure module under `src/core/` using string splitting and a small mapping table. Alternative: a third-party INI parser dependency - rejected because the format is flat and a dependency adds install and license overhead.
2. **Pin-name join, not coordinates.** `.ioc` files have no package positions, so signals join to a physical position by matching a normalized GPIO name against the chip shard's pin names. Alternative: approximate a position from pin order - rejected because it misassigns packages with reordered pins.
3. **Static signal mapping with reported unknowns.** Keep an explicit ST-to-normalized signal table; unmapped signal or mode strings are returned in a warnings list rather than dropped. Alternative: best-effort string passthrough - rejected because it produces invalid peripheral/signal pairs downstream.
4. **Reuse existing part resolution.** Expand variant groups and canonicalize the temperature wildcard using the same naming rules as the STM32 data adapter, then resolve against `index.json`. Ambiguous results never auto-select; the UI requires explicit confirmation.
5. **Board presets as checked-in data.** Curate a small static preset file keyed by MCU ID from the official board `.ioc` files. Alternative: parse `.cache/` files at runtime - rejected because `.cache/` is gitignored and absent in deployed static builds.
6. **Handoff through the existing store.** The UI reads the local file through the browser File API and passes parsed state to `setPendingHandoff` / `openMcu`; the URL and JSON codecs are unchanged.

## Risks / Trade-offs

- [Wildcard part IDs expand to several MCUs] -> Require manual confirmation before opening a workspace; never pick silently.
- [Escaped spaces and pin suffixes break the name join] -> Centralize normalization and test it against sampled real board files plus synthetic fixtures.
- [ST signal vocabulary changes across Cube versions] -> Keep the mapping table data-driven and surface unmapped entries as warnings.
- [Curated presets drift from upstream] -> Record the upstream source and short revision in a source comment; keep the set small and hand-verified.
- [Large or malformed file blocks the UI] -> Use a single linear parse pass; on failure report an error and leave workspace state untouched.

## Migration Plan

1. Implement the pure parser, signal mapper, and unit tests against synthetic fixtures and sampled cached board files.
2. Implement part-ID expansion, canonicalization, and pin-name normalization with resolution tests.
3. Add the checked-in board preset catalog keyed by MCU ID.
4. Wire the drop zone, board selector modal, and ambiguous-part confirmation through the workspace store.
5. Verify with `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; confirm no STM32 regressions.

## Open Questions

None. The importer contract is fixed by the existing version-2 state schema and the cached upstream board files.

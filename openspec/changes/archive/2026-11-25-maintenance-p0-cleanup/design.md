# Design: P0 cleanup

## Context

See `proposal.md` for motivation. The repository is a static Svelte 5 application
with a pure TypeScript core, runes stores, a build-time catalog generator, and
Vitest static-contract tests. Earlier phases replaced the React prototype, moved
provenance from the landing footer to About, moved `.ioc` import to the start
screen, and widened the state schema to version 2 without an import path for
older payloads. Those transitions left declarations, compatibility branches, and
documentation behind. No generated data or STM32 shard bytes are in scope.

## Goals / Non-Goals

- Goals: reduce the manifest and runtime API surface to what is used; make
  version-2 codecs reject legacy shapes instead of translating them; give
  `meta.json` one explicit type; align docs, specs, and copy with shipped behavior.
- Non-goals: no new feature, no state-schema version bump, no change to solver
  results, exporters, routing, theme tokens, generated chip shards, or CI
  triggers. No migration path for legacy payloads is added.

## Decisions

1. **Manifest first, then resolution check.** Edit `package.json`, regenerate
   `package-lock.json` with `npm install --package-lock-only`, and verify
   `npm ci --dry-run` before deciding on `.npmrc`. The override exists only for
   the `svelte-check@4` peer range; if removing that package makes npm resolve
   cleanly, delete the file rather than leaving an unexplained setting. Otherwise
   keep it with a comment naming the remaining conflict.
2. **Remove APIs, leave behavior paths intact.** Delete only fields and helpers
   with no callers. `themeStore.cycle()`, `HistoryStack.canUndo/canRedo`, and
   `validateMatrixPlan()` remain because they are used; their alias methods,
   counters, and discarded invocation do not. Tests that used `primeChip()` as a
   cache shortcut switch to spying on `loadChip()`, which is the real loader.
3. **Strict version-2 normalization.** `normalizePackageRotation()` accepts only
   `0`, `90`, `180`, `270`. `normalizePlacementRing()` accepts only `high`,
   `medium`, `low`. Codecs keep ignoring fields that were never part of the
   shareable schema, but tests assert those fields never appear in decoded state
   and that legacy ring/rotation values resolve to defaults or no value.
4. **Explicit metadata type.** Replace the intersection of two partial records
   with an explicit `CatalogMetaSources` interface naming each vendor key and
   each canonical source key. `buildMetaDocument(generatedAt, sources)` drops
   the legacy parameter object. `meta.json` keeps the flat `sources` map so the
   About table and provenance gate keep working; only the redundant top-level
   STM32 fields disappear. Per-vendor `chipCount` remains the gate's index check.
5. **Docs and specs through targeted edits.** Update `AGENTS.md`, `README.md`,
   the four contradictory main spec requirements, and the attribution test with
   minimal replacements rather than rewriting whole documents. Delta specs carry
   the same requirement text that is written to the main specs so archive sync is
   idempotent.
6. **Copy follows capability.** The start screen names all six vendors, drops the
   offline-ready badge because fonts are fetched remotely, points "Browse Catalog"
   at the catalog route, and the compare modal accepts JSON only because its
   loader rejects `.ioc`.

## Risks / Trade-offs

- Removing `primeChip()` changes test setup → replace it with a single reusable
  `loadChip()` spy helper so every affected test uses the production loader path.
- Removing legacy mappings changes behavior for old payloads → acceptable because
  backward compatibility is explicitly out of scope; tests switch to asserting
  rejection or default normalization.
- Changing `meta.json` shape affects the provenance gate and generated artifact →
  update gate inputs and rerun `npm run gen-data` to verify no partial catalog and
  unchanged chip shards.
- Editing main specs directly and through delta specs could drift → keep exact
  requirement text in both, then verify `openspec validate --all --strict`.

## Migration Plan

No shipped data migration is provided. Existing version-2 share links and project
files are unaffected. Links or files using removed legacy tokens normalize to the
documented default. Generated catalog data is regenerated locally; no committed
data changes.

## Open Questions

None.

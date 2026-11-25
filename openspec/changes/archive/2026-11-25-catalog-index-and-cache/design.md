# Design

## Context

See `proposal.md` for motivation. Every shard already contains an exact `PackageInfo`; the compact index only exposed a package string and pin count. `CatalogPage.svelte` fetched visible shards to recover geometry. `catalog.svelte.ts` cached chips without a size bound or request dedupe. CI acquired sources on every run, cloning `nrf-pacs` for three SVD files and declaring Zephyr twice.

## Goals / Non-Goals

**Goals:**

- Make `index.json` self-sufficient for package outlines and vendor identity.
- Remove all presentation-time chip shard fetches.
- Bound and cancel chip loading while keeping `loadChip(id)` compatible.
- Reduce CI acquisition work without changing weekly freshness or provenance.

**Non-Goals:**

- Changing version-2 share links, project files, workspace state, or pin-planning behavior.
- Adding dependencies, a backend, new localStorage preferences, or raw color literals.
- Changing STM32 chip shard bytes or vendor gate thresholds.

## Decisions

1. **Geometry copied from each adapter's `ChipData.package`.** A shared pure helper maps a generated shard's `PackageInfo` into the compact index shape (`kind`, `sides`, `rows`, `cols`, `hasExposedPad`). Each adapter calls it at index-entry construction, so no chip fact is hand-authored and all six vendors stay consistent. Alternatives: recomputing geometry from package strings in the UI (rejected: approximate) or fetching shards (rejected: latency and complexity).
2. **Index fields removed rather than deprecated.** `peripherals` counts and `series` have no runtime consumer. Removing them reduces index size; the shard keeps all facts. The gate rejects their reintroduction. Backward compatibility for catalog index shape is not required.
3. **Strict vendor identity.** All adapters emit `vendor`, so display/filter paths drop `?? 'stm32'`. `getChipVendor()` is retained for shard-side normalization of older in-memory fixtures but display code uses the entry directly.
4. **Thumbnail helper reduces to one function.** `thumbnailGeometryFromIndex(entry)` converts index geometry to SVG mark positions; the approximate package-string helper, shard conversion, fidelity flag, refinement cap, and concurrency helper usage in the catalog are removed. The component drops `data-fidelity` and projects cards keep a minimal saved-field fallback derived from the same pure mark helper.
5. **LRU chip cache with in-flight map.** A `Map` keyed by uppercase id holds either a promise (in-flight) or chip (settled); access order is tracked by deletion/reinsertion on hits. A constant cap (48) bounds retention. The optional `AbortSignal` is linked to the underlying `fetch`; a shared request tracks signal consumers so one abort does not discard a request another caller still needs. Failed/aborted requests are removed from both maps. Alternatives: no eviction (rejected: unbounded memory) or per-caller fetches (rejected: duplicate requests).
6. **Abort propagation where generations exist.** Compatibility finder and project diff create an `AbortController` per generation and pass its signal to each `loadChip`; stale generations abort promptly in addition to the existing token checks.
7. **CI source caching.** `actions/cache@v4` keyed on hashes of `tools/data-gen/sources.ts`, `tools/data-gen/adapters/**/sources.ts`, and `package-lock.json`, with a vendor-independent prefix. Scheduled runs delete `.cache/` after restore and skip cache save so SHAs advance; push/manual runs save after acquisition. `nrf-pacs` becomes a raw-file source with three pinned URLs; Nordic readers move to that raw cache directory. Zephyr RP and Nordic declarations merge under `zephyr` in `.cache/zephyr`, and the Nordic gate checks the consolidated source ids via canonical provenance ids.

## Risks / Trade-offs

- [Index size grows with geometry] → Removing `peripherals` and `series` offsets most growth; the 150 MB generation budget still gates the result.
- [Thumbnails lose a fallback for missing index geometry] → The helper normalizes absent/non-finite fields to a plain outline, so a stale or partial index never breaks a row.
- [Abort sharing could discard a request a caller still wants] → Track remaining non-aborted consumers before aborting the shared fetch and only evict the in-flight entry when no consumer remains.
- [CI cache could pin stale sources] → Weekly schedule always deletes `.cache/` and does not save the restored cache; push builds reuse only unchanged declarations.
- [Nordic provenance source count changes] → Keep the canonical `nrf-pacs`, `zephyr`, and `kicad` records and adapt the Nordic gate and tests to the consolidated ids.

## Migration Plan

1. Add geometry to index entries and gate checks; regenerate the catalog and record size and chip-count deltas.
2. Switch thumbnails to index geometry and delete refinement code and tests.
3. Remove vendor fallbacks and index-only fields from types/tests/docs.
4. Upgrade the chip cache and propagate abort signals.
5. Update source acquisition and CI caching; re-run `acquire-sources` and all verification.
6. Archive the change and commit the archived artifacts with the implementation.

## Open Questions

None.

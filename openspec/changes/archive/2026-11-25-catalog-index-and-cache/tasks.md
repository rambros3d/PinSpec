# Tasks

## 1. Index geometry and generated data

- [x] 1.1 Add exact `geometry` to `CatalogIndexEntry`, make `vendor` required, and remove `peripherals`/`series` from the index type; verified with `npm run check`.
- [x] 1.2 Add a pure adapter helper that copies generated `ChipData.package` geometry into the index shape; verified all six index-entry builders call it and `npm test` passes.
- [x] 1.3 Emit `vendor: 'stm32'` in the STM32 adapter and update all six adapters' index entries; verified `npm run gen-data` passes every gate (2894 chips, 605.4 KB index).
- [x] 1.4 Extend the shard-integrity gate to compare index geometry and vendor against shards and reject reintroduced `peripherals`/`series`; verified gate tests fail on injected divergence and pass on generated data.
- [x] 1.5 Confirm STM32 chip shards are byte-identical to the pre-change baseline while index/meta shape changes; verified aggregate SHA-256 `601a7f4a2fe8a5e7dd7275cd902263bd8fcf1a03303a4255605e5cc512e45726` before and after.

## 2. Thumbnails from index data

- [x] 2.1 Reduce `src/core/package-thumbnail.ts` to exact index geometry plus a minimal saved-field fallback, removing approximation, fidelity, shard conversion, and the refinement cap; verified pure-module tests pass.
- [x] 2.2 Simplify `PackageThumbnail.svelte` to render exact geometry with theme tokens, no fidelity attribute, interaction, texture, or raw color; verified thumbnail source tests pass.
- [x] 2.3 Remove `refineVisible`, `visibleIds`, `exactGeometry`, `MAX_THUMBNAIL_REFINEMENTS`, `IntersectionObserver`, generation token, and shard `loadChip` calls from `CatalogPage.svelte`, keeping table, filters, and Open handoff; verified no thumbnail fetch remains by source assertions and `npm test`.
- [x] 2.4 Update projects cards and all thumbnail-related tests to the new helper surface; verified `npm test` and `npm run check`.

## 3. Explicit vendor identity

- [x] 3.1 Remove all index-entry `?? 'stm32'` fallbacks from catalog store, vendor view, compatibility finder, catalog page, quick search, MCU switcher, and data-gen gates; verified by repository grep and `npm run check`.
- [x] 3.2 Update affected tests and documentation to describe explicit vendors and the new index shape; verified `npm test` and docs-attribution tests pass.

## 4. Chip cache upgrade

- [x] 4.1 Add in-flight promise dedupe, a documented 48-entry LRU cap, and `AbortSignal` support to `catalogStore.loadChip()` while preserving the single-argument API; verified six new Vitest cases for shared loads, retries, eviction, and cancellation.
- [x] 4.2 Pass abort signals from the compatibility finder and project diff generation-token callers; verified their existing tests and `npm run check` pass.
- [x] 4.3 Confirm no dead `primeChip` helper exists and document the cache cap in code; verified by source inspection.

## 5. CI source acquisition

- [x] 5.1 Convert `nrf-pacs` to raw SVD fetches for the three consumed files and point Nordic readers and gates at the raw cache; verified `npm run acquire-sources` and Nordic gate tests pass.
- [x] 5.2 Consolidate RP and Nordic Zephyr declarations into one source id and cache directory, preserving complete provenance and all raw files; verified source tests, `npm run gen-data`, and provenance tests pass.
- [x] 5.3 Add `actions/cache` for `.cache/` keyed on source declarations and `package-lock.json`, with weekly deletion and no cache save on scheduled runs; verified workflow assertions in tests pass.
- [x] 5.4 Update README and AGENTS descriptions of the index shape, thumbnails, and source acquisition; verified documentation tests pass.

## 6. Full verification

- [x] 6.1 Ran `npm run acquire-sources`, `npm run gen-data`, `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; all succeeded with no warnings, index grew from 573,307 to 619,954 bytes, and all 2,894 chips emitted.
- [x] 6.2 Confirmed no emoji characters, raw color literals in changed source, or whitespace errors in the diff.

## Workflow follow-up

- Validate `openspec validate --all --strict` with no active changes after archiving.
- Archive this change with `openspec archive catalog-index-and-cache -y`.
- Commit the archived artifacts with the implementation; do not push.

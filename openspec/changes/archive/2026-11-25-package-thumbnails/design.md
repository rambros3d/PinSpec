# Design

## Context

See proposal.md for motivation and the delta specs for behavior. Current state:

- `src/pages/CatalogPage.svelte` renders a text-only table over `searchCatalogEntries(..., 500)`. It has local query, vendor, family, and package filters, a retry/loading/empty row block, and an Open button calling `router.navigateMcu(entry.id)`.
- `src/pages/ProjectsPage.svelte` renders `workspaceStore.recentSessions.slice(0, 10)` as a table with Open, Export, and Delete controls. `RecentSession` carries `mcuId`, `packageName`, `pinCount`, `assignedCount`, `updatedAt`, and `state` from `pinspec:recent_sessions_v1`.
- `src/core/types.ts` `PackageInfo` carries `name`, `kind`, `pinCount`, `sides`, `rows`, `cols`, and `hasExposedPad`; `CatalogIndexEntry` carries only `package`, `pinCount`, `vendor`, and `module`. Index-only geometry is ambiguous: package strings alone cannot resolve 17 perimeter variants, about 100 perimeter entries, or grid `rows`/`cols` from a count.
- `src/state/catalog.svelte.ts` `loadChip()` caches every fetched chip without eviction. It is the correct fetch boundary but must not be called for every row. It already resolves paths through `dataUrl()` and `import.meta.env.BASE_URL`.
- `src/core/compatibility.ts` provides the proven pattern: `mapWithConcurrency` with `MAX_CONCURRENT_SHARD_LOADS = 4`, a generation token, an `isCancelled` predicate, and a token check before applying results. `CompatibleMcuFinder.svelte` demonstrates it in a Svelte component.
- `PerimeterPackage.svelte` and `GridPackage.svelte` are interactive, carry SVG defs and `feTurbulence`, per-pin groups, and pointer handlers. `tests/theme-tokens.test.ts` locks the texture primitive to exactly those two files.
- Static contracts that can be affected: `tests/global-app-shell.test.ts`, `tests/start-screen.test.ts`, `tests/theme-tokens.test.ts`, `tests/ui-multi-vendor.test.ts`, `tests/subpath-contracts.test.ts`, and `tests/view-preferences.test.ts`.
- Two other changes are pending in this repo: `global-top-bar` and `about-provenance-consolidation`. This design edits only the catalog table body, the projects card grid, new core/component files, and shared tests. It does not edit either pending change's artifacts and does not move page headers.

## Goals / Non-Goals

**Goals:**

- Give every catalog result and every recent-session card an immediate package silhouette that needs no shard fetch.
- Replace that silhouette with exact generated geometry only for catalog rows the user can see, under a bounded and cancellable fetch path.
- Keep the dense catalog table and all existing filters, caps, load states, handoffs, import, export, and empty states.
- Keep share URLs, project files, workspace state, undo history, recent-session records, and localStorage preference keys unchanged.
- Keep thumbnails static, theme-token driven, dependency-free, and subpath safe.

**Non-Goals:**

- No generated data change: no new index field, shard field, gate, or build-warning contract.
- No per-chip silhouette table, transcribed datasheet value, or hardcoded part identifier.
- No rewrite of `PerimeterPackage.svelte` or `GridPackage.svelte`, and no reuse of their interactive markup or texture filters.
- No shard fetch on the projects route and no preview or hero surface on the start screen.
- No new state field in share URLs, project JSON, workspace state, or localStorage.
- No change to the mux model, solver, exporters, or generated output bytes.

## Decisions

1. **Pure geometry helper in core with two entry points.** Add `src/core/package-thumbnail.ts` with no Svelte or DOM import. It exposes an `approximateThumbnailGeometry(packageName, pinCount, options?)` function for index and session fields, a thin `approximateThumbnailFromIndex(entry)` wrapper, a `thumbnailGeometryFromChip(chip)` function for exact shard geometry, a `ThumbnailGeometry` type carrying `kind`, side/grid counts, `hasExposedPad`, `pinCount`, and `fidelity`, and a fixed `MAX_THUMBNAIL_REFINEMENTS` cap. Approximate rules are deterministic: QFP/QFN/DFN style names map to four equal sides, SOP/SO/DIP/SSOP/TSSOP style names map to two vertical sides, BGA/WLCSP/CSP style names map to a square grid derived from the pin count, and any other string maps to a plain rectangle. The grid rule explicitly reports approximate fidelity and never claims exact ball labels. Alternative considered: adding geometry fields to `index.json`; rejected because it changes generated artifacts and gates, and because grid `rows`/`cols` cannot be derived from a count without inventing data.

2. **Refinement is page-level Svelte state, not a new store API.** Keep the fetch and generation token in the catalog page or a small component-local helper under `src/state/`. An `IntersectionObserver` action marks table rows as visible; a `$effect` over the visible id set starts a pass for ids that are not yet exact. Each pass calls `mapWithConcurrency(ids, MAX_CONCURRENT_SHARD_LOADS, worker, () => token !== generation)`, where the worker calls `catalogStore.loadChip(id)` and maps `chip.package` with `thumbnailGeometryFromChip`. Results are applied only when the token still matches. The token increments on query/filter/result-set change and on destroy, matching `CompatibleMcuFinder.svelte`. A component-local `Map<string, ThumbnailGeometry>` remembers exact geometry for revisited rows; this is a view cache only and does not add a method to `catalogStore` or rely on its unbounded `chipCache` for correctness. Alternative considered: fetching shards for all 500 results up front; rejected by the fetch budget. Alternative considered: rendering thumbnails with the full package renderers; rejected because they are interactive, heavy, and texture-filtered.

3. **One shared non-interactive SVG component.** Add `src/components/catalog/PackageThumbnail.svelte` with props for geometry, a 40-48px size (default 44), and an optional label. It draws a body outline plus simple pad or ball marks from side and grid counts, and a plain exposed-pad outline only when declared. It uses theme utility classes such as `fill-base-100`, `stroke-base-300`, and `fill-base-content/40`, emits `pointer-events-none`, carries a stable `package-thumbnail` class and a `data-fidelity` attribute for tests, and is `aria-hidden` because the row already exposes package text. It contains no `<defs>`, `<filter>`, `feTurbulence`, click handler, or focusable node. Alternative considered: a CSS box with no geometry; rejected because it cannot distinguish two-sided, four-sided, and grid packages.

4. **Catalog column is additive to the table body.** Add one leading header cell and one thumbnail cell per row in `CatalogPage.svelte`. Do not change the search card, filter controls, 500 limit, retry/loading/empty blocks, or Open handler. Attach visibility observation to rows through a small Svelte action so core stays DOM-free. When `IntersectionObserver` is unavailable, all rows keep their approximate silhouettes and refinement is skipped. Alternative considered: virtualizing the table; rejected because it changes the dense table contract and the 500-result behavior.

5. **Projects cards derive thumbnails from stored session fields.** Replace the table in `ProjectsPage.svelte` with a responsive grid of cards. Each card passes `session.packageName` and `session.pinCount` through the same approximate helper, then shows MCU ID, package, assigned/total pins, relative time, and Open, Export, and Delete controls. Import, New project, empty state, the 10-session limit, and the existing handoff and exporter/parser calls remain. No `loadChip` call is added to this route. Alternative considered: refining cards from shards; rejected because the route is a localStorage index, has at most 10 entries, and the request explicitly limits shard refinement to visible catalog rows.

6. **Persistence boundary stays explicit.** Thumbnail geometry, fidelity, visibility, and refinement state are component-local. No new localStorage key or preference field is introduced. Opening a workspace from a catalog row or project card continues through the same workspace handoff, so share encoding and project export remain byte-compatible with the version-2 schema. Tests assert that neither payload contains thumbnail fields and that preference/session key sets are unchanged.

7. **Test updates are scoped to changed contracts.** Add `tests/package-thumbnails.test.ts` for pure geometry derivation, exact shard mapping, concurrency/cancellation with an instrumented worker, pass cap, failed-shard fallback, and static thumbnail-source checks. Update `tests/global-app-shell.test.ts` for the leading catalog column and projects cards while keeping filter, cap, retry, handoff, import, export, and empty-state assertions. Update `tests/ui-multi-vendor.test.ts` to assert that refined thumbnails follow generated package geometry and that interactive renderer contracts are unchanged. Review but keep `tests/start-screen.test.ts`, `tests/theme-tokens.test.ts`, `tests/subpath-contracts.test.ts`, and `tests/view-preferences.test.ts` green without weakening their texture, no-raw-color, no-emoji, subpath, or preference-key contracts.

## Risks / Trade-offs

- [Approximate silhouette can disagree with the shard] Mitigation: mark fidelity explicitly, refine visible rows first, and never derive exact ball labels from a count.
- [Fast scrolling can enqueue repeated work] Mitigation: a component-local exact-geometry map, the fixed pass cap, generation cancellation, and the existing chip loader cache avoid duplicate loads per pass.
- [Visibility API may be unavailable in tests or older browsers] Mitigation: skip refinement and keep approximate silhouettes; no correctness path depends on the observer.
- [Theme audit can flag raw colors or texture] Mitigation: use theme utility classes only and keep the texture primitive in the two existing renderers.
- [Source-string tests can overfit SVG internals] Mitigation: assert stable class names, attribute markers, and absent handler tokens instead of path coordinates.
- [Pending global bar and about changes may reshape page headers] Mitigation: this change edits only page bodies and new files, does not touch either pending change, and keeps existing page header contracts intact.
- [Static tests may break when table rows become cards] Mitigation: update only assertions that describe the changed surface and keep version-2 persistence assertions byte-for-byte.

## Migration Plan

1. Add the pure geometry helper and its unit tests, including the fixed cap and fidelity markers.
2. Add the thumbnail SVG component and confirm the theme and texture audits still pass.
3. Add the leading catalog column, visibility action, bounded refinement pass, and cancellation; keep filters, cap, load states, and Open handoff unchanged.
4. Replace the projects table with cards and verify Open, Export, Delete, Import, New project, empty state, and the 10-session limit.
5. Update the affected static tests and README wording; confirm share, project, preference, and session storage contracts remain unchanged and no pending change artifact is edited.
6. Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` with zero warnings. The implementation agent then runs `openspec archive package-thumbnails -y` and includes the synced spec and archived files in the implementation commit. This planning step makes no commit.

## Open Questions

None. The surfaces, fidelity rules, fetch bounds, persistence boundary, and test mapping are fixed by the request and the inspected source.

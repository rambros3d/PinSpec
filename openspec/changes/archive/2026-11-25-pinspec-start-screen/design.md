# Design

## Context

`src/pages/LandingPage.svelte` currently owns a narrative hero split into two
columns. The left column holds the heading, `QuickSearchBar`, and a
pinout.json file input. The right column lazy-loads `STM32G431CBU6` through
`catalogStore.loadChip(HERO_CHIP_ID)` and renders `HeroChipPreview`, which builds
a demo workspace with `buildHeroDemoState()` and switches among `HERO_CHIPS`.
Below the hero, `PresetGrid` renders recent sessions and six starter chips, and
an `#export-preview` section renders four export tabs from the hero demo state
with copy and download buttons. The `#provenance` footer reads `catalogStore.meta`
and lists seven upstream sources with their licenses and SHAs.

`src/pages/WorkspacePage.svelte` currently owns the `.ioc` wiring: a canvas
`FileUp` button, a hidden file input, window-level drag and drop handlers, an
`iocDropActive` overlay, `applyIocRecord()`, `handleIocFile()`, and the
ambiguous-part `<dialog>`. Board presets use `BoardSelectorModal` and
`buildBoardPresetState()`, and the read-only pinout diff uses `PinoutDiffModal`.
`workspaceStore.setPendingHandoff()` plus `router.navigateMcu()` are the shared
handoff path used by both pages.

The pure `.ioc` importer in `src/core/importers/ioc.ts` has no DOM or Svelte
dependency and is not changed. `src/core/` stays pure TypeScript. No new
dependency, generated artifact, backend, raw color literal, or emoji is added.

## Goals / Non-Goals

**Goals:**

- Present `#/` as a three-zone start screen within the existing scrollable
  `.landing-shell`.
- Provide the five left-column actions with behavior delegated to existing
  dialogs, stores, and navigation.
- Remove the interactive chip preview, its demo builder, the hero vendor list,
  and the landing export preview, including their test contracts.
- Move `.ioc` selection, resolution, confirmation, and handoff to the start
  screen and remove all `.ioc` UI from the workspace.
- Keep the provenance footer, the theme control, the navigation anchors that
  remain meaningful, and every existing pin-configuration persistence path.

**Non-Goals:**

- No change to generated data, the data-generation pipeline, or source
  acquisition.
- No change to the solver, URL codec, project-file schema, or exporter modules.
- No change to STM32 workspace behavior or navigation routes.
- No new persisted field and no presentation state in share URLs or project
  files.
- No modification of `openspec/specs/viewport-locked-workspace`: its landing
  scroll-container requirement is still satisfied by `.landing-shell`.

## Decisions

1. **One page, three zones, no route change.** Keep `LandingPage.svelte` as the
   `#/` start screen and restructure its markup into a left action column, a
   central discovery column, and a right rail. Keep the sticky header and
   `.landing-shell` classes asserted by `tests/viewport-layout.test.ts`, keep
   `<ThemePicker />` asserted by `tests/theme-mode-toggle.test.ts`, and remove
   only the `#export-preview` anchor. Keep `#presets` in `PresetGrid.svelte` and
   `#provenance` on the footer. Alternative considered: adding a new route for
   the start screen; rejected because hash-route stability is required.

2. **Action column delegates to existing flows.** New pinout MCU/Board focuses
   the central `QuickSearchBar` input and exposes the existing
   `BoardSelectorModal`; a selected preset goes through
   `resolveBoardPreset()`, `buildBoardPresetState()`, `setPendingHandoff()`, and
   `router.navigateMcu()`. Open project reveals recent local sessions from
   `workspaceStore.recentSessions`; the empty case relies on the hint already
   asserted in `tests/workspace-qol.test.ts`. Import pinout.json keeps the
   current `parsePinoutJson()` path on the start screen. Compare mounts the
   existing read-only `PinoutDiffModal`, which already rejects `workspaceStore`
   imports in its test contract. No action adds a persisted field.

3. **Hero code is deleted, not left as dead code.** Remove `HeroChipPreview.svelte`,
   `src/core/hero-demo.ts`, and `HERO_CHIPS` from `src/core/vendor-view.ts`, plus
   the `HERO_CHIP_ID`, `loadHero()`, `selectHeroVendor()`, vendor-derived crate
   label, and export-preview derived values in `LandingPage.svelte`. The header
   Workspace button depends on a loaded hero chip and is removed; workspace
   entry is provided by the action column and discovery area. `src/data/hero-chip.json`
   is already absent and the generator already avoids emitting it.

4. **`.ioc` import moves; the pure importer does not.** Move `FileUp` entry,
   file input, `prepareIocImport()` resolution, `applyIocRecord()`, the
   ambiguous-part dialog, and the handoff to `LandingPage.svelte`. Reuse
   `catalogStore.ensureLoaded()`, `catalogStore.loadChip()`,
   `buildWorkspaceFromPins()`, `workspaceStore.setPendingHandoff()`, and
   `router.navigateMcu()`. Remove the workspace button, hidden input, window
   drag and drop listeners, `iocDropActive` overlay, ambiguous dialog markup,
   and related state from `WorkspacePage.svelte`. Keep `handleImportState()` in
   the workspace for the `ExportModal` project-file path. Alternative
   considered: keeping workspace drop handling as a shortcut; rejected because
   the requirement is start-screen-only entry.

5. **Provenance stays in the footer; the rail is a summary.** The right rail
   reads `catalogStore.meta` for chip counts, per-vendor counts and ratios, and
   a compact source-revision summary, and it lists keyboard shortcuts as text.
   The footer keeps `id="provenance"`, `PROVENANCE_SOURCES`, the seven license
   strings, and the live SHA rendering required by `tests/docs-attribution.test.ts`
   and the `multi-vendor-ci-gates` and `multi-vendor-workspace` specs.

6. **Test updates are scoped to the removed surfaces.** Rewrite
   `tests/hero-lazy.test.ts` as a no-hero and no-snapshot contract that keeps
   the catalog `BASE_URL` assertion and the generator assertion. Remove hero
   imports, hero strings, and rust crate or export-preview assertions from
   `tests/ui-multi-vendor.test.ts` while keeping the starter part identifiers,
   Cross-Vendor Starter Chips heading, vendor tabs, provenance footer, and
   mux-label contracts. In `tests/workspace-qol.test.ts`, drop the landing
   export failure assertions and keep the first-time recent-sessions hint and
   workspace export assertions. In `tests/viewport-layout.test.ts`, remove the
   `#export-preview` anchor assertion and move ambiguous-dialog source checks
   from `WorkspacePage.svelte` to the new landing dialog location. Review
   `tests/theme-tokens.test.ts`, `tests/docs-attribution.test.ts`, and
   `tests/subpath-contracts.test.ts`; no behavior change is expected there.
   Add `tests/start-screen.test.ts` for the three zones, five actions, right
   rail, removed hero and export strings, and handoff wiring.

7. **Presentation state boundary is explicit.** Quick-search filters, action
   focus, and any rail expansion stay as component-local state. The theme mode
   stays under the existing `pinspec:theme` localStorage key. No field is added
   to `WorkspaceState`, the compact share payload, or version-2 project JSON.
   The state handed to `setPendingHandoff()` remains pin configuration only.

## Risks / Trade-offs

- [Removing the hero deletes demo-state coverage] Mitigation: delete the now
  unused component, builder, and vendor list together and remove their test
  contracts so no dead source-string assertions remain.
- [Moving `.ioc` UI changes which page owns the ambiguous dialog] Mitigation:
  keep the pure importer unchanged, reuse the same dialog markup and focus
  helper on the start screen, and update the dialog-related source assertions
  in `tests/viewport-layout.test.ts`.
- [Landing source-string tests can overfit markup] Mitigation: change only the
  assertions named above and keep theme, subpath, provenance, starter-chip, and
  catalog-error contracts intact.
- [Three-zone layout can overflow short viewports] Mitigation: keep
  `.landing-shell` as the single internal scroll container with the existing
  height, overflow, and scroll-padding rules; stack zones on narrow widths.
- [Workspace regression from removing drop handlers] Mitigation: remove only
  `.ioc`-related listeners and confirm all other workspace shortcuts, dialogs,
  and export paths remain asserted by the existing suite.

## Migration Plan

1. Restructure `LandingPage.svelte` into three zones, add the five actions, and
   keep the header, `#presets`, `#provenance`, `QuickSearchBar`, and
   `PresetGrid` contracts.
2. Delete the hero preview, hero demo builder, hero vendor list, and export
   preview, then update the hero and multi-vendor test contracts.
3. Move `.ioc` entry and the ambiguous dialog to `LandingPage.svelte`, strip the
   workspace wiring, and update the affected dialog and QOL tests.
4. Add the right rail and the start-screen contract test; review theme,
   attribution, and subpath tests.
5. Run `npm test`, `npm run check`, and
   `BASE_PATH="/pinspec/" npm run build`; fix warnings before closeout.

After implementation the owning agent runs
`openspec archive pinspec-start-screen -y` and includes the synced delta specs
and archived change files in the implementation commit. This planning task set
stops before archive and makes no commit.

## Open Questions

None. The zone layout, action list, hero removal, `.ioc` relocation, retained
footer, and localStorage-only presentation boundary are fixed by the request.

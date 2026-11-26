# Proposal

## Why

The `#/` route currently presents a narrative landing page with a large hero
section, an interactive chip preview, and a live export preview. Those surfaces
duplicate workspace behavior and add catalog fetches, demo-state construction,
and source-string test contracts that are unrelated to starting a pinout. `.ioc`
import is wired into the workspace, so a file can only be imported after a
workspace is already open. This change turns `#/` into a start screen organized
around starting, opening, and comparing pinouts, and moves `.ioc` import to that
screen.

## What Changes

- Replace the landing hero and below-the-fold sections with a three-zone start
  screen: left action column, central MCU search with recent sessions and
  starter chips, and a right rail with catalog statistics, provenance summary,
  and keyboard shortcuts.
- Add five left-column actions: New pinout MCU/Board, Open project, Import
  `.ioc`, Import pinout.json, and Compare. Each reuses existing dialogs, stores,
  and navigation paths; no new dependency or backend is introduced.
- Remove `HeroChipPreview`, its demo-state builder, and the hero vendor list.
  The interactive chip preview is no longer part of the application, and its
  lazy-hero and multi-vendor hero test contracts are removed in this change.
- Remove the landing export preview and its copy and download controls.
  The workspace `ExportModal` remains the only export surface.
- Move `.ioc` file selection, part resolution, ambiguous-part confirmation, and
  workspace handoff from `WorkspacePage.svelte` to `LandingPage.svelte`. Keep the
  pure importer in `src/core/importers/ioc.ts`. No `.ioc` file input, drop
  target, or ambiguous dialog remains in the workspace.
- Retain the `#provenance` footer with live `meta.json` counts, source revisions,
  and licenses. Drop the `#export-preview` navigation anchor and keep the brand
  link, the `#presets` and `#provenance` anchors, and `ThemePicker`.
- Keep `.landing-shell` viewport-contained and scrollable. No new persisted
  field is introduced, and no new field is added to share URLs or version-2
  project files.
- Update the affected source-string tests and run the full verification
  sequence.

## Capabilities

### New Capabilities

- `pinspec-start-screen`: the three-zone `#/` start screen, its five entry
  points, retained discovery and provenance surfaces, and the boundary between
  shareable pin configuration and localStorage-only presentation state.

### Modified Capabilities

- `ci-data-generation`: remove the landing "Lazy hero chip data" requirement
  and replace it with a runtime catalog-load requirement for the start screen.
- `multi-vendor-workspace`: remove the hero-switcher half of "Presets and hero
  are cross-vendor" while keeping cross-vendor presets and provenance.
- `ioc-project-import`: change "Import and preset UI entry points are provided"
  to start-screen-only `.ioc` entry with explicit ambiguous-part confirmation
  and no workspace drop handling.
- `workspace-qol`: limit "Copy and download failures are reported" to the
  workspace export dialog.

`viewport-locked-workspace` is not modified because its landing scroll-container
requirement still holds with `.landing-shell`. `theme-mode-toggle`,
`multi-vendor-ci-gates`, and `pinout-visual-diff` are not modified because their
requirements remain satisfied.

## Impact

- Components and pages: `src/pages/LandingPage.svelte`,
  `src/pages/WorkspacePage.svelte`, `src/components/landing/HeroChipPreview.svelte`
  (deleted), `PresetGrid.svelte`, `QuickSearchBar.svelte`, workspace
  `PinoutDiffModal.svelte`, `BoardSelectorModal.svelte`, and `ThemePicker.svelte`.
- Core and state: `src/core/hero-demo.ts` (deleted), `src/core/vendor-view.ts`
  with `HERO_CHIPS` removed, `src/core/importers/ioc.ts` unchanged, and the
  existing router, catalog, and workspace handoff paths reused.
- Tests: rewrite `tests/hero-lazy.test.ts`, update `tests/ui-multi-vendor.test.ts`,
  `tests/workspace-qol.test.ts`, and `tests/viewport-layout.test.ts`; review
  `tests/theme-tokens.test.ts`, `tests/docs-attribution.test.ts`, and
  `tests/subpath-contracts.test.ts`; add `tests/start-screen.test.ts`.
- No change to generated data, the data pipeline, dependencies, or STM32
  behavior.

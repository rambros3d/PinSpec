# Proposal

## Why

The `#/` start screen currently repeats catalog numbers, keeps a shortcut list
that is already available in the global sidebar Hotkeys dialog, and reads more
like a promotional landing page than an application entry point. The declutter
pass reduces repeated information and presentation noise without changing
navigation, discovery, import, or pin-configuration behavior.

## What Changes

- Remove the `match` and `coverage` percentages from the home-screen Catalog
  card. The card shows a vendor label and chip count per row only.
- Make the right-rail Catalog card a compact vendor-count list with the catalog
  sync date, and remove the total indexed count from that rail. The
  `parts indexed` and `families` count stays only in the discovery header above
  `QuickSearchBar`.
- Remove the home-screen Shortcuts card and its `SHORTCUTS` usage. The global
  sidebar Hotkeys entry becomes the single keyboard shortcut reference.
- Rework spacing, card density, and visual hierarchy across all three zones
  (left actions, central discovery, right rail) so the page reads as a focused
  application start screen: dense but scannable, consistent with the global top
  bar, and free of promotional copy.
- Keep the `.landing-shell` scroll container, the single global top bar, hash
  routing, `dataUrl()` fetches, localStorage-only UI preferences, and all
  existing search, import, preset, compare, and export handoff behavior.
- Update the static source assertions in the affected tests deliberately; no
  runtime behavior outside the start screen changes.

No breaking change. No new route, feature, dependency, or shareable state field.

## Capabilities

### New Capabilities

- `landing-declutter`: presentation of the focused start screen, including
  cross-zone spacing, card density, visual hierarchy, and the non-regression
  contract for discovery, import, presets, routes, and shell boundaries.

### Modified Capabilities

- `pinspec-start-screen`: the three-zone layout requirement gains the focused
  presentation constraint; the discovery column owns the only index count; the
  right rail requirement becomes a compact vendor list with a sync date, no
  total, no ratios, and no shortcut card.
- `shell-polish-and-persisted-discovery`: the shortcut help dialog becomes the
  single rendered keyboard shortcut reference in the application.
- `global-app-shell`: the About and route-stability requirements state that the
  sidebar Hotkeys dialog is the only shortcut reference and that the landing
  presentation pass adds no route, feature, or shareable field.

## Impact

- `src/pages/LandingPage.svelte`: zone markup, spacing and card classes,
  discovery header, right rail, and unused icon/constant imports.
- Static source-assertion tests: `tests/start-screen.test.ts`,
  `tests/ui-multi-vendor.test.ts`, `tests/docs-attribution.test.ts`,
  `tests/viewport-layout.test.ts`, `tests/theme-tokens.test.ts`,
  `tests/global-app-shell.test.ts`, and `tests/workspace-qol.test.ts`.
- Generated data, core solver, URL codec, exporters, and workspace behavior are
  unchanged. `npm test`, `npm run check`, and
  `BASE_PATH="/pinspec/" npm run build` must remain green.

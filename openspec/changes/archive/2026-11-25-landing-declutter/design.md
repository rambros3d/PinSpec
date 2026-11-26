# Design

## Context

See `proposal.md` for motivation. The current start screen is a single
`src/pages/LandingPage.svelte` with three zones inside `.landing-shell`: actions
(`data-zone="actions"`), discovery (`data-zone="discovery"`), and rail
(`data-zone="rail"`). The discovery header shows the index count and two
badges. The rail shows a Catalog card with a total, per-vendor counts plus
match/coverage ratios, and a sync date, followed by a Shortcuts card backed by
the shared `SHORTCUTS` list in `src/data/provenance.ts`. The same `SHORTCUTS`
list backs `ShortcutHelpDialog.svelte`, opened from the global sidebar Hotkeys
entry and from the keyboard. Tests in `tests/` assert source strings rather
than rendering the component, so markup and assertions must move together.

Constraints: one global top bar, no per-page navbar, `.landing-shell` scroll
container, hash routing, `dataUrl()` fetches, localStorage-only UI preferences,
daisyUI 5 with theme tokens, no raw color literals outside the vendored theme
file, no emojis, strict TypeScript, no new dependency, no new route or feature.

## Goals / Non-Goals

**Goals:**

- Reduce repeated catalog numbers and remove the duplicate shortcut reference.
- Rework spacing, card density, and hierarchy across all three zones into a
  focused application start screen.
- Keep every existing action, discovery, import, preset, and compare behavior.
- Keep the static source-assertion suite aligned with the markup.

**Non-Goals:**

- Redesigning `QuickSearchBar.svelte` or `PresetGrid.svelte` internals.
- Changing generated data, the solver, URL codec, exporters, or workspace UI.
- Adding routes, features, dependencies, or shareable state fields.
- Adding a separate rail component; the rail remains inline in the page.

## Decisions

### 1. One file, one presentation pass

Keep all layout edits inside `LandingPage.svelte`. No new component is
introduced for the rail or the action list. A single pass can adjust zone
spacing and card framing without creating an indirection layer for markup used
once. Alternative considered: extract `VendorCountCard.svelte`; rejected as
unnecessary structure for one call site and extra test surface.

### 2. Hierarchy and spacing rules

- Keep `start-grid` at `max-w-7xl` with the 12-column `lg` grid and the three
  existing `data-zone` sections; tighten the outer vertical padding and the
  inter-column gap so the three zones read as one application surface.
- Left actions: keep the five entry points and all their existing tokens, but
  group them into one bordered surface with divided rows and tighter padding so
  they read as a compact action list rather than five stacked marketing cards.
  Keep the board-preset button and the inline import error surface.
- Discovery: keep the dot-grid panel, the header count with its two badges,
  `QuickSearchBar`, `PresetGrid`, and the `#presets` anchor. Reduce section
  padding and the gap between the search panel and presets. Discovery stays the
  visually dominant zone.
- Rail: keep one compact card that carries the vendor list and sync date.
  Reduce card padding and per-row spacing; use subdued text tokens so the rail
  reads as tertiary reference information.
- Emphasis comes from size, spacing, and border treatment using existing
  daisyUI/theme tokens (`bg-base-100`, `border-base-300`, `text-base-content`,
  `text-info`, `badge`, `alert`, `loading`). No raw color literal is added.

Alternative considered: a two-column layout that drops the rail. Rejected
because the three-zone contract and the catalog facts are unchanged in scope.

### 3. Rail data shape

Render each available `PROVENANCE_VENDORS` entry that has a matching
`catalogStore.meta.sources` record as one row containing the vendor label and
`chipCount` only. Keep `formatSyncDate(catalogStore.meta.generatedAt)` on the
card. Drop the `ratios.match` and `ratios.coverage` fragments and the
`chipCount.toLocaleString()` total line from the rail. Keep the existing
`alert alert-soft alert-error` message and the `loading loading-spinner
loading-xs` pending row. Keep `PROVENANCE_VENDORS` and `Database`; drop the now
unused `Keyboard` import and the `SHORTCUTS` import and Shortcuts card from the
page. The shared `SHORTCUTS` constant stays in `src/data/provenance.ts` for the
dialog.

### 4. Single count and single shortcut reference

The parts-indexed and families text remains only in the discovery header. The
sidebar Hotkeys entry and `ShortcutHelpDialog` are the only shortcut reference;
neither the start screen nor About lists shortcuts. No shortcut key, action, or
local array is added to the landing page.

### 5. Token-only styling and component boundaries

Use daisyUI component classes and Tailwind utilities with theme tokens. The
existing `list`/`list-row` component could represent vendor rows, but the
current flex rows are retained to minimize static-assertion churn while still
using existing theme tokens. `QuickSearchBar` and `PresetGrid` keep their
internal logic; only their surrounding containers change.

### 6. Test mapping

All tests remain static source assertions. Update deliberately:

| Test file | Change |
| --- | --- |
| `tests/start-screen.test.ts` | Rail test drops `ratios.match`/`ratios.coverage` and rail-total assumptions; assert vendor label plus chip count rows, sync date, no ratio or total in the rail; shortcut test changes from "page contains SHORTCUTS" to "page has no Shortcuts card and no SHORTCUTS use" while the provenance constant remains; add count-only-in-discovery assertion; keep action, import, hero-removal, and share-boundary assertions. |
| `tests/ui-multi-vendor.test.ts` | Remove any rail ratio strings or landing duplicate-count strings; keep vendor tab counts, module tags, vendor tabs, and STM32-only claim scans; assert compact vendor rows and no `ratios.` usage on the landing page. |
| `tests/docs-attribution.test.ts` | Keep the About `SHORTCUTS` absence check; add landing absence of `SHORTCUTS` and `Shortcuts` while retaining provenance checks. |
| `tests/viewport-layout.test.ts` | Keep `.landing-shell` declarations, exact shell class, no `navbar`, no `min-h-screen`, and `#presets`; update any zone spacing or rail structure assertions to the compact layout. |
| `tests/theme-tokens.test.ts` | Confirm no raw color literal was added outside `src/themes/daisyui.css`; update only if a landing-specific assertion references removed markup. |
| `tests/global-app-shell.test.ts` | Keep sidebar Hotkeys and About no-shortcut assertions; add the single-reference assertion for the landing page and the compact rail; keep route-stability and persistence assertions. |
| `tests/workspace-qol.test.ts` | Keep the shared `SHORTCUTS` dialog assertions; add that the dialog is the only rendered shortcut list and that the landing page does not define a local one. |

## Risks / Trade-offs

- [Brittle static assertions] Markup changes can break unrelated string checks.
  Mitigation: change one group at a time and run `npm test` after each group;
  preserve canonical tokens that tests rely on unless the change explicitly
  removes them.
- [Perceived information loss] Removing the rail total and ratios removes
  detail from the home screen. Mitigation: the count remains in the discovery
  header, and full ratios and totals remain on About.
- [Theme contrast] Tighter, subdued rail text can lose contrast in one theme.
  Mitigation: use theme tokens only and check both themes during verification.
- [Unused imports] Removing the Shortcuts card leaves unused imports that fail
  strict checks. Mitigation: remove `Keyboard` and `SHORTCUTS` from the page
  import list while keeping the provenance constant for the dialog.

## Migration Plan

No data or route migration. Implementation order: rail simplifications,
discovery header count, hierarchy/spacing pass, then test updates. After all
groups pass `npm test`, `npm run check`, and
`BASE_PATH="/pinspec/" npm run build`, the implementation agent archives the
change with `openspec archive landing-declutter -y` and includes the archived
files in its commit. Rollback is a revert of the page and test edits; no
generated data is touched.

## Open Questions

None. All presentation decisions and scope boundaries are fixed by the request.

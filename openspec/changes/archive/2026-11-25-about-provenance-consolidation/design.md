# Design

## Context

See proposal.md for motivation. `src/pages/AboutPage.svelte` renders a catalog
summary card, a tab strip from `ABOUT_TABS`, and `ProvenancePanel`. The panel
renders a per-vendor card, an upstream-sources card, a shortcuts tab, and a
duplicate inline shortcuts card under the sources tab. `src/data/provenance.ts`
holds `PROVENANCE_SOURCES`, `PROVENANCE_VENDORS`, and `SHORTCUTS`; live revisions
and counts come from `catalogStore.meta`. `src/components/shell/GlobalSidebar.svelte`
defines `SECTIONS` and renders anchors with router helpers. The existing
`ShortcutHelpDialog` is a native `<dialog class="modal">` with focus handling
from `openDialogWithFocus`, currently mounted by `WorkspacePage` and driven by a
local `showShortcutHelp` flag. The selected About tab is a localStorage-only
preference under `pinspec:shell_preferences_v1`. Most contracts are static
source-string tests, so test edits must land with the behavior change.

The pending `global-top-bar` change is not edited here. It also modifies
`global-app-shell`, renames and reorders sidebar sections, and routes its
shortcuts control to the About Shortcuts tab that this change removes.

## Goals / Non-Goals

**Goals:**

- Present all About provenance in one grouped table without duplicated totals.
- Remove every shortcut listing from About while retaining the reference on
  the surfaces that own it.
- Add a shell-level Hotkeys entry that opens the existing dialog over the
  current route without adding a route or a persisted field.
- Keep generated data, pin configuration, share links, project files, and
  theme-token rules unchanged.

**Non-Goals:**

- No change to `meta.json`, the data generator, upstream sources, solver,
  exporters, URL codec, or workspace state schema.
- No new npm dependency, backend, API key, or runtime service.
- No restyling of the landing right rail, the global top bar, or workspace
  panes; the pending `global-top-bar` change owns those surfaces.
- No new keyboard binding; the `?` binding stays where it is today.

## Decisions

### Merged provenance surface

`AboutPage` drops its summary card and passes the selected tab to
`ProvenancePanel`. The panel renders one grouped Catalog sources table: each
`PROVENANCE_VENDORS` entry produces a vendor row with live chip count, match and
coverage ratios, and formatted sync time from `catalogStore.meta.sources`, and
nested rows for that vendor's repositories. Each `PROVENANCE_SOURCES` entry
produces a nested source row with id, resolved SHA or placeholder, license, and
an external link. The indexed total and family count move into the table
header. Loading, failure, and retry states move into the same surface so no
state depends on the removed cards.

Alternative considered: keep the cards and add a separate combined table.
Rejected because it preserves the duplication the change is intended to remove
and leaves two failure states.

### Shortcut removal and tab preference

`ABOUT_TABS` becomes a single `sources` tab. The tab strip and the `aboutTab`
localStorage preference stay, so `pinspec:shell_preferences_v1` keeps its
shape, `normalizeAboutTab` still maps a stale `shortcuts` value to `sources`,
and `tests/shell-preferences.test.ts` remains unchanged. `ProvenancePanel`
drops the `SHORTCUTS` import and both shortcut blocks. About never falls back
to shortcut content when metadata is unavailable.

Alternative considered: remove the tab strip and the preference entirely.
Rejected because it would be an unnecessary persisted-schema change and would
require rewriting unrelated preference tests; the user decision only removes
the empty tab.

### Hotkeys entry and dialog ownership

`GlobalSidebar` gains a `Keyboard` icon button labelled Hotkeys immediately
above the About entry. It is rendered in the same entry loop structure as the
sections for both rail and expanded states, but it uses a button with no hash
target so no route is added. A component-local `hotkeysOpen` flag in the sidebar
renders `ShortcutHelpDialog` with an `onClose` callback that clears the flag.
The flag is transient view state and is not added to `shellPreferences`,
`workspaceStore`, workspace state, share URLs, project files, recent sessions,
or undo history. The flag lives in the sidebar rather than `AppShell` so this
change needs no shell prop drilling and no new store.

Alternative considered: add `#/hotkeys` as a hash route. Rejected by the user
decision: the dialog must overlay the current route.

### Shared shortcut content

`ShortcutHelpDialog` imports `SHORTCUTS` from `src/data/provenance.ts` and
renders those entries in its existing list markup. The local eight-item array
is deleted, so there is one source of shortcut copy. The native dialog markup,
modal class, focus restoration, Escape cancellation, and backdrop close stay
as they are. `SHORTCUTS` has seven entries and does not include `?`; the `?` key
still opens the dialog through its existing binding, and no hardcoded `?` row
is reintroduced in the dialog. If the project later advertises `?` as text, it
belongs in `SHORTCUTS` and will also appear on the landing rail.

Alternative considered: pass the About shortcut list into the dialog as a prop.
Rejected because it keeps a second list alive and couples a shell dialog to an
About-only surface.

### Coordination with global-top-bar

This change does not edit `openspec/changes/global-top-bar`. Two seams need
attention when both changes are implemented:

- The global bar's shortcuts control currently selects the About Shortcuts tab
  on shell routes. That tab no longer exists, so the integrating implementation
  must retarget that control to the shared `ShortcutHelpDialog` rather than
  reopen an About tab.
- Both changes touch `global-app-shell` and the same static tests. The merged
  sidebar requirement must keep the pending change's reserved rail, toggle
  placement, label wording, and bottom-group ordering, with the Hotkeys button
  placed immediately above About. Keep the original About requirement name
  from the base spec so either archive order resolves the same block.

If both dialog entry points are open at once, use one transient flag for the
dialog rather than mounting two instances. The pending change already proposes
a transient top-bar UI store; the integrating implementation may reuse it for
the Hotkeys entry instead of the sidebar-local flag described above.

### Test contract mapping

- `tests/global-app-shell.test.ts`: replace summary-card and shortcut-panel
  assertions with merged-table assertions; assert the Hotkeys entry and its
  position above About; keep preference and route contracts.
- `tests/docs-attribution.test.ts`: retarget the two provenance-card string
  checks to the grouped table; keep all thirteen source ids, licenses, live
  metadata, and landing footer checks.
- `tests/start-screen.test.ts`: keep the shared `SHORTCUTS` and landing-rail
  assertions; retarget the About assertion from `ProvenancePanel` presence to
  the grouped table and absence of shortcut text.
- `tests/workspace-qol.test.ts`: assert that the help dialog renders the shared
  `SHORTCUTS` reference and no local shortcut array; keep focus, close, and key
  handling contracts.
- `tests/theme-tokens.test.ts`: add the sidebar and dialog sources to the token
  scan; keep the no-raw-color and no-emoji checks.
- `tests/shell-preferences.test.ts`, `tests/core-io.test.ts`,
  `tests/gates-contracts.test.ts`, and all data-gen tests: unchanged, proving
  the persistence and generated-data contracts are intact.
- `README.md`: update the About route description, sidebar entry list, and the
  shortcut-reference ownership statement.

## Risks / Trade-offs

- Static source-string tests are brittle and both pending changes edit them.
  Mitigation: update only assertions whose behavior moved and run the full
  suite before closing tasks.
- A stale localStorage `shortcuts` tab value could select a missing tab.
  Mitigation: rely on the existing `normalizeAboutTab` fallback to `sources`.
- Two dialog instances could open if both the sidebar and workspace trigger
  help. Mitigation: use one transient flag during integration and keep the
  focus helper contract in the dialog itself.
- Nested source rows must not imply source-to-vendor ownership that metadata
  does not declare. Mitigation: nest each canonical source under its declared
  vendor grouping from `meta.json.sources` and render repositories as a plain
  nested list without new attribution claims.
- The merged table could regress readability at narrow widths. Mitigation: use
  existing responsive utility classes and theme tokens only; no raw colors.

## Migration Plan

Implemented by the implementation agent after artifacts are complete:

1. Consolidate `ProvenancePanel` and simplify `AboutPage`; update About
   contract tests.
2. Add the sidebar Hotkeys entry and dialog wiring; retarget
   `ShortcutHelpDialog` to `SHORTCUTS`; update sidebar and dialog tests.
3. Update README and the remaining static contracts, then run `npm test`,
   `npm run check`, and `BASE_PATH="/pinspec/" npm run build`.
4. Run `openspec archive about-provenance-consolidation -y` and report the
   archive output with the test and build evidence. No user data migration is
   required: preferences keep their key and stale tab values normalize.

## Open Questions

None. User decisions fix the table content, removed sections, entry placement,
dialog behavior, and persistence boundary; the two coordination seams with
`global-top-bar` are handled by the integrating implementation.

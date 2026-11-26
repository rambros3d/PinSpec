# Proposal

## Why

About repeats catalog totals and the shortcut list across a summary card, two
provenance cards, and two tabs. The shortcut reference is reachable only by
leaving the current route, and the About surface presents source revisions in
two unrelated layouts. Consolidate the provenance data into one grouped table
and move shortcut reference into a shell-level dialog.

## What Changes

- Replace the About summary card and the separate per-vendor and upstream-source
  cards with one grouped "Catalog sources" table. A vendor row carries chip
  count, match and coverage ratios, and sync time. Nested source rows carry the
  source id, resolved SHA, license, and an external link.
- Show the indexed total and family count in the merged table header. Keep the
  loading, unavailable, and retry states on the merged surface.
- Remove every shortcut listing from About, including the inline list in the
  sources tab. Remove the Shortcuts tab because no non-shortcut tab remains
  besides Sources; keep the Sources tab and its localStorage preference.
- Add a Hotkeys entry to the global sidebar above About. Activating it opens the
  existing `ShortcutHelpDialog` as a native `<dialog class="modal">` over the
  current route. No new route and no new state are introduced.
- Render the dialog from `src/data/provenance.ts` `SHORTCUTS` and remove the
  dialog's separate hardcoded shortcut array. A dialog-open flag, if used, is
  transient component state and stays out of localStorage, share URLs, project
  files, recent sessions, and undo history.
- Update the static contract tests deliberately for the merged table, the
  removed About duplication, the sidebar entry, and the dialog content source.
  Preserve generated-data, pin-configuration, share-link, and route contracts.
- **BREAKING** for About presentation only: the About summary card, the two
  separate provenance cards, and the About Shortcuts tab are removed. No
  share-link, project-file, workspace-state, or generated-data schema change is
  included.

## Capabilities

### New Capabilities

- `about-provenance-consolidation`: One grouped catalog-sources table on About,
  removal of duplicated summary and shortcut listings, and a shell-level
  Hotkeys entry that opens the shared shortcut dialog over the current route.

### Modified Capabilities

- `global-app-shell`: The sidebar gains a Hotkeys entry above About; About
  presents one merged catalog-sources table with no shortcut reference; the
  Hotkeys dialog state is transient while the Sources tab preference stays
  local; opening Hotkeys leaves the active route unchanged.

## Impact

- Files: `src/pages/AboutPage.svelte`,
  `src/components/about/ProvenancePanel.svelte`,
  `src/components/shell/GlobalSidebar.svelte`,
  `src/components/workspace/ShortcutHelpDialog.svelte`, `README.md`, and the
  static contract tests named in tasks.md.
- State: `aboutTab` remains a localStorage-only UI preference under
  `pinspec:shell_preferences_v1` with `sources` as the only tab. The Hotkeys
  dialog flag is transient component state. No pin-configuration field is added
  to workspace state, share URLs, version-2 project files, recent sessions, or
  undo history.
- Data: About continues to read `meta.json` through `catalogStore`; the shared
  source and shortcut references stay in `src/data/provenance.ts`. No generated
  data, data generator, or upstream source changes.
- Dependencies: none added. Colors stay in theme tokens and the vendored theme
  file; icons come from `lucide-svelte`. No emoji.
- Coordination: the pending `global-top-bar` change is not edited by this
  change. It also modifies `global-app-shell` and routes its shortcuts control
  to an About Shortcuts tab. The implementation integrating both changes must
  retarget that control to the shared Hotkeys dialog and merge the sidebar
  requirements so the Hotkeys entry sits above About without losing the rail,
  toggle, label, and ordering behavior from that change.
- Verification: `npm test`, `npm run check`, and
  `BASE_PATH="/pinspec/" npm run build` must pass with zero warnings, followed
  by change archive by the implementation agent.

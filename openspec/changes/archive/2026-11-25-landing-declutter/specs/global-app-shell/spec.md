# Spec Delta

## MODIFIED Requirements

### Requirement: About presents provenance and shortcuts

The `#/about` destination SHALL present catalog statistics, upstream source
revisions, licenses, and the indexed total in one grouped Catalog sources
table. It SHALL read live values from `meta.json`, SHALL keep loading and retry
states on that merged surface, SHALL NOT contain a separate summary card or any
keyboard shortcut reference, and SHALL NOT contain pin configuration or
shareable fields. The sidebar Hotkeys dialog SHALL be the only keyboard shortcut
reference.

#### Scenario: About reports provenance

- **WHEN** generated metadata is available and the user opens About
- **THEN** the merged table shows per-vendor counts, match and coverage ratios, sync time, nested source ids, revisions, licenses, links, and the indexed total in its header

#### Scenario: About lists shortcuts

- **WHEN** the About panel is rendered in any tab or metadata state
- **THEN** it lists no shortcut key, shortcut action, inline shortcut summary, or Shortcuts tab

#### Scenario: About tolerates missing metadata

- **WHEN** `meta.json` has not loaded or cannot be loaded
- **THEN** About shows a loading or unavailable state with a retry control on the merged table and no shortcut reference as a fallback

#### Scenario: About carries no pin configuration

- **WHEN** About is rendered or left
- **THEN** no assignment, label, lock, mode, remap, or PIO field is written to a share URL or project file

#### Scenario: About keeps non-shortcut tabs

- **WHEN** the About tab strip is rendered
- **THEN** only non-shortcut tabs are offered and the Sources tab remains available

#### Scenario: Hotkeys dialog is the only shortcut reference

- **WHEN** the user looks for keyboard shortcuts from any shell route or the start screen
- **THEN** the sidebar Hotkeys entry opens the shared dialog as the only shortcut reference, and neither the start screen nor About repeats the shortcut list

### Requirement: Existing routes and data loading remain stable

Adding the global top bar and the reserved rail SHALL NOT change workspace or
shared-link behavior, the start screen's three zones and quick actions,
hash-based routing under a GitHub Pages subpath, or data fetches through
`dataUrl()`. Pin configuration SHALL remain shareable and presentation
preferences SHALL remain in localStorage only. A presentation-only start-screen
rework SHALL add no route, feature, or shareable field and SHALL keep one top bar
and `.landing-shell`.

#### Scenario: Workspace routes remain unchanged

- **WHEN** the user opens `#/mcu/<PART_NUMBER>` from the shell or directly
- **THEN** the three-pane workspace opens with the same pin canvas, diagnostics, and export behavior

#### Scenario: Shared links remain unchanged

- **WHEN** the user opens a version-2 `#/s/<PAYLOAD>` link
- **THEN** the pinout hydrates in the workspace with the same state it has before this change

#### Scenario: Shell routes work under a subpath

- **WHEN** the built app is served under `/pincraft/` and a shell route is opened
- **THEN** the route resolves from the hash and data requests resolve relative to `import.meta.env.BASE_URL`

#### Scenario: Global bar preserves persistence

- **WHEN** the user navigates through the global bar or toggles the sidebar
- **THEN** no presentation field enters a share URL or project file and all pin configuration is preserved

#### Scenario: Landing presentation pass preserves shell contracts

- **WHEN** the start screen zones are reworked for density and hierarchy
- **THEN** the three zones, quick actions, single global top bar, hash routing, and `dataUrl()` fetches remain unchanged and no new shareable state is introduced

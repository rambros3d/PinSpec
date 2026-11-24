# Proposal: Peripheral Tree Detail Panel

## Why

The workspace peripheral tree currently expands each row into a full detail
body containing the mode selector, remap selector, tag pills, and signal
toggles. This makes rows tall and dense, leaves only about 21 to 30 rows
visible on a fresh STM32G431CBU6 workspace where every peripheral is
unconfigured, and gives the "Other" category the character of a junk drawer
(11 blocks on G431). There is no dedicated surface for the configuration of a
selected peripheral, and the current tree mixes navigation with editing.

The two-category persistence rule in `AGENTS.md` also requires a correction:
selected peripheral, filter text, section expansion, and the active dock tab
are UI preferences and must live only in `localStorage`, while the dock tab is
currently stored in version-2 workspace state, share URLs, and project JSON.

## What Changes

- Add a "Configuration" tab to the existing right `SummaryDrawer`. Host the
  selected peripheral's mode selector, remap selector, tag pills, signal
  toggles, and locate-pin controls in a new detail component rendered by that
  tab. Reuse the existing pin-configuration callbacks so assignment, remap,
  and mode behavior does not change.
- Make left tree rows compact: peripheral name, status dot, and inline mode
  label only. Remove the inline signal list. Clicking a row selects the
  peripheral and opens the Configuration tab. Do not split the left pane into
  two columns and do not add a floating panel.
- Keep category browsing. Within each category, list configured peripherals
  first; show the "Other" category as a collapsed "Other peripherals (N)"
  section. On a fresh workspace, show a short empty-state line above the
  browsable categories instead of an empty pane.
- Persist selected peripheral, filter text, category expansion, and dock tab
  only in `localStorage`. Remove the dock tab from version-2 workspace state,
  undo/redo history, share URL payloads, recent sessions, and project JSON.
  Legacy share links and project files that still carry a dock tab value load
  with the default dock tab and keep their pin configuration.
- Add a DOM-free helper in `src/core/vendor-view.ts` that partitions
  peripherals into configured and unconfigured names from
  `peripheralStatus` and `peripheralModes`, with Vitest cases for
  STM32G431CBU6, STM32F103C8T6, CH32V203C8T6, RP2040, and RP2350B.
- Add Configuration to the portrait dock tab list and to the existing
  `data-dock-tab` selectors in `src/app.css`. Keep one mount each of the tree,
  canvas, and drawer, one portrait media query, and two `grid-template-areas`
  blocks.
- Move the affected static test contracts from `PeripheralTree.svelte` to the
  new detail surface and update the dock-tab persistence contracts to assert
  `localStorage`-only behavior. Update all affected tests in the groups that
  own the corresponding work.
- No new npm dependency. No raw color literal outside
  `src/themes/daisyui.css`, no emoji, no change to solver, data adapters,
  generated shards, routing, or pin-configuration export content.

There is exactly one new capability: `peripheral-tree-detail-panel`. One
existing capability is modified because two of its current requirements
conflict with the approved persistence rule: `viewport-locked-workspace`
currently requires a five-tab dock and requires the active dock tab to
round-trip through share URLs and project JSON.

## Capabilities

### New Capabilities

- `peripheral-tree-detail-panel`: Tree selection and right-drawer detail
  separation, compact tree rows, configured-first grouping, fresh-workspace
  empty state, DOM-free configured/unconfigured partition, and
  `localStorage`-only view preferences.

### Modified Capabilities

- `viewport-locked-workspace`: The dock tab set gains Configuration, and the
  active dock tab becomes a `localStorage`-only UI preference instead of
  shareable version-2 workspace data.

## Impact

Affected code: `src/core/vendor-view.ts`, `src/core/types.ts`,
`src/core/history.ts`, `src/core/url-state.ts`,
`src/core/exporters/json.ts`, `src/state/workspace.svelte.ts`, a new
`src/state/` preferences helper, `src/components/workspace/PeripheralTree.svelte`,
a new `src/components/workspace/PeripheralDetail.svelte`,
`src/components/workspace/SummaryDrawer.svelte`,
`src/pages/WorkspacePage.svelte`, `src/app.css`, and affected tests in
`tests/ui-multi-vendor.test.ts`, `tests/viewport-layout.test.ts`,
`tests/workspace-qol.test.ts`, `tests/hardware-audit.test.ts`,
`tests/theme-tokens.test.ts`, and a new core helper test file.

Pin configuration remains shareable and unchanged: assignments, labels,
locks, peripheral modes, active remaps, PIO bindings, GPIO electrical
settings, placement preferences, and rotation still round-trip through share
URLs and version-2 project JSON. Required verification is `npm test`,
`npm run check`, and `BASE_PATH="/pincraft/" npm run build` with zero warnings.

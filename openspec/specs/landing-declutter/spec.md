# landing-declutter Specification

## Purpose

Defines the focused presentation of the start screen after the declutter pass:
spacing, card density, and visual hierarchy across the action, discovery, and
rail zones, plus the non-regression contract for the behavior those zones host.

## Requirements

### Requirement: The start screen is a focused application surface

The `#/` start screen SHALL present as a focused application start screen
rather than a marketing page. One presentation pass SHALL cover all three zones
with consistent spacing, restrained card density, and a clear hierarchy:
discovery primary, actions secondary, rail tertiary. The layout SHALL remain
dense but scannable at supported
desktop widths and SHALL stack without horizontal overflow at narrow widths.

#### Scenario: Desktop hierarchy emphasizes discovery

- **WHEN** the start screen renders at a supported desktop width
- **THEN** the discovery column is the most visually prominent zone, the action and rail zones are compact, and spacing between zones is consistent

#### Scenario: Narrow viewport keeps one scroll column

- **WHEN** the viewport is too narrow for three side-by-side columns
- **THEN** the zones stack in a single scrollable column inside `.landing-shell`, the root document does not scroll, and no horizontal overflow appears

### Requirement: The start screen keeps its shell frame and content boundaries

The presentation pass SHALL keep one global top bar and the `.landing-shell`
scroll container, with no per-page navbar. No promotional language, emoji, new
route, or new feature SHALL be introduced.

#### Scenario: Shell frame is unchanged

- **WHEN** the start screen renders on any route-supported viewport
- **THEN** one global top bar is present, no page-level navbar is rendered, and the `.landing-shell` container scrolls its own content

#### Scenario: No promotional copy or emoji

- **WHEN** the reworked start screen copy is inspected
- **THEN** no marketing claim or emoji appears in any zone and the text describes what each action does

### Requirement: Landing styling uses tokens and preserves component logic

Styling changes on the start screen SHALL use daisyUI component classes and
active theme tokens only; raw color literals SHALL remain in
`src/themes/daisyui.css`. The internal logic of `QuickSearchBar.svelte` and
`PresetGrid.svelte` SHALL NOT be redesigned; the pass SHALL adjust only their
surrounding spacing, section framing, and placement on the page.

#### Scenario: Theme tokens cover the reworked zones

- **WHEN** the user changes theme while the start screen is open
- **THEN** all three zones remain readable using the active theme tokens and no raw color literal was added outside the vendored theme file

#### Scenario: Search and preset components keep their behavior

- **WHEN** the reworked start screen is compared with the prior screen
- **THEN** `QuickSearchBar` and `PresetGrid` expose the same controls and behavior and only their surrounding layout changed

### Requirement: Landing declutter preserves behavior and share boundaries

The presentation pass SHALL NOT change quick search, its `Ctrl+K` focus
shortcut, vendor tabs, family and package filters, localStorage restoration,
the catalog error and retry row, recent sessions, board presets, starter chips,
`.ioc` and JSON import, the compare dialog, or the five action entry points.
Data fetches SHALL continue through `dataUrl()` with `import.meta.env.BASE_URL`,
hash routing SHALL remain, and no presentation value SHALL enter a share URL or
version-2 project JSON.

#### Scenario: Search, presets, and imports still work

- **WHEN** the user searches for a part, opens a starter chip, and imports a version-2 project file from the reworked start screen
- **THEN** the same routes, dialogs, and workspace handoff used before the change occur

#### Scenario: Share payload stays free of presentation fields

- **WHEN** a workspace opened through a reworked start-screen action is shared or exported as version-2 project JSON
- **THEN** no spacing, rail, card, or shortcut field appears in the share payload or project file and all pin configuration is preserved

#### Scenario: Verification sequence passes

- **WHEN** `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build` are run after the presentation pass
- **THEN** all three exit zero with no build warnings and assets resolve under `/pinspec/`

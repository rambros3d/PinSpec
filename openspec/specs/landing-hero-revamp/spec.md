# landing-hero-revamp Specification

## Purpose

The landing route presents one functional hero for catalog search and part
selection, followed by secondary start actions and compact recent sessions. This
specification records the hero layout, generated catalog facts, compact session
rows, and the factual copy and token constraints that replace the previous
three-zone start screen.

## Requirements

### Requirement: The landing route has one functional hero

The `#/` route SHALL render a full-width hero band inside `.landing-shell` and
`max-w-7xl`. It SHALL contain an `h1` reading `Plan a pinout`, one factual
sentence, a `New pinout` action opening the catalog, and the catalog search
input with vendor, family, and package filters. No chip preview, package
outline, export preview, route title, or technical footer SHALL be rendered.

#### Scenario: Hero opens catalog or searches

- **WHEN** the start screen is opened
- **THEN** the hero shows the headline and both the catalog action and the search input with its filters

#### Scenario: No preview surface

- **WHEN** the hero source is inspected
- **THEN** it contains no package renderer, sample assignment, or export preview component

### Requirement: Generated catalog facts live in the hero

The hero SHALL show generated indexed part count, vendor count, sync date, and
a retry path when the catalog fails. No separate catalog rail or claim badge
SHALL remain on the landing route. Fact values SHALL come from generated
metadata and SHALL NOT be hardcoded.

#### Scenario: Catalog facts are generated

- **WHEN** catalog metadata is available
- **THEN** the hero shows the indexed total, vendor count, and sync date from that metadata

#### Scenario: Catalog failure is retryable

- **WHEN** catalog loading fails
- **THEN** the hero shows the error and a retry control and no rail fallback is rendered

### Requirement: The body has two columns without starter chips

Below the hero, the start screen SHALL use two columns at `lg`: other start
actions and recent sessions. Starter chips, their hardcoded part notes, module
badges, and the `#presets` anchor SHALL be removed. Below `lg` the columns SHALL
stack in one reading order without horizontal overflow.

#### Scenario: Secondary actions remain reachable

- **WHEN** the body renders
- **THEN** board presets, `.ioc` import, version-2 JSON import, and Compare are available without a starter-chip grid

#### Scenario: Narrow viewport stacks cleanly

- **WHEN** the viewport is narrower than `lg`
- **THEN** the action column precedes recent sessions in one scrollable column inside `.landing-shell`

### Requirement: Recent sessions are compact rows

The landing route SHALL render recent sessions as rows showing part, package,
assigned/pins, relative time, Reopen, and Delete. The Projects route remains
the full management surface. The recent-session list SHALL NOT render large
cards or promotional descriptions.

#### Scenario: Reopen from a row

- **WHEN** a recent-session Reopen action is activated
- **THEN** the workspace loads that MCU through the existing navigation path

#### Scenario: Delete from a row

- **WHEN** a recent-session Delete action is activated
- **THEN** the session is removed through the existing store action and no confirmation dialog is introduced

### Requirement: Landing copy and tokens stay factual

The landing page SHALL use daisyUI semantic tokens and reserve monospace for
part numbers, package names, counts, dates, and shortcut keys. It SHALL NOT
contain promotional or marketing language, emojis, claim badges, raw color
literals, or new dependencies. Import, compare, board-preset, and dialog
behavior SHALL remain unchanged.

#### Scenario: Factual copy only

- **WHEN** landing copy is inspected
- **THEN** each label describes an action or a generated value and no claim badge or promotional phrase appears

#### Scenario: Existing behavior remains

- **WHEN** an import, compare, board preset, or ambiguous-part dialog is used
- **THEN** it follows the same code path as before the hero revamp

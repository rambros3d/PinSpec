# Proposal: Landing Hero Revamp

## Why

The `#/` start screen still reads as a dense three-zone dashboard. The action
list, search box, starter-chip table, and catalog rail compete for attention,
and several labels are claims rather than descriptions. The landing route needs
a single hero that orients the user, puts part search first, and shows generated
catalog state, followed by only the secondary actions and recent sessions.

## What Changes

- Replace the three-zone grid with a full-width hero band and a two-column body.
  The hero headline is `Plan a pinout`, with a factual one-line description, a
  `New pinout` primary action, the catalog search input with filters, and a
  compact generated catalog status line with retry.
- Remove the right catalog rail; generated facts appear only in the hero.
- Remove the starter-chip table, its hardcoded part notes, the `#presets`
  anchor, the module-id derivation, and the claim badges. No chip preview or
  export preview is introduced.
- Replace `PresetGrid.svelte` with a focused recent-sessions list rendered as
  compact rows with part, package, assigned/pins, relative time, Reopen, and
  Delete. The Projects route remains the full manager.
- Keep board presets, `.ioc` import, version-2 JSON import, Compare, the
  ambiguous-import dialog, and the drag-and-drop import overlay unchanged.
- Use daisyUI semantic tokens, restrained typography, and monospace only for
  part numbers, package names, counts, dates, and code hints. No promotional
  or marketing copy, no emojis, and no new dependency.
- Amend AGENTS.md and the start-screen/landing specs, and update the static
  tests for the hero and removed zones.

## Capabilities

- `landing-hero-revamp`
- `pinspec-start-screen`
- `landing-declutter`

## Out of scope

No routing, data generation, solver, exporter, dialog, persistence, or share
schema change. The global shell and its thin navigation bar are unchanged.

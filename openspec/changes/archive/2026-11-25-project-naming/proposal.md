# Proposal

## Why

A workspace session is identified only by its MCU part number, so several saved
or shared pin plans for related parts are hard to tell apart in recent sessions,
share links, and project files. A short generated project name gives each new
plan a stable identifier that travels with the pin configuration.

## What Changes

- Add a pure core helper that composes a project name from two curated words and
  a lowercase, sanitized MCU family suffix, using an injectable RNG so the
  result is deterministic in tests.
- Add an optional `projectName` field to `WorkspaceState` and carry it through
  history clone/equality, the version-2 share URL payload, the version-2 project
  file, and localStorage recent sessions. Omit the field when absent; keep the
  schema version at 2.
- Generate a name only when a new workspace for an MCU is first created. Reuse
  the stored name when a recent session, a share link, or a project file is
  opened.
- Show the name as a compact editable pill next to the MCU pill in the workspace
  global top bar. Click changes the pill to an inline input; Enter or blur
  commits, Escape cancels. There is no always-visible input and no modal.
- Show the project name on each Projects card with an inline rename control that
  uses the same commit path as the top-bar pill.
- Keep the word list in pure `src/core/` as UI vocabulary. No MCU fact is
  handwritten and no npm dependency is added.

## Capabilities

### New Capabilities

- `project-naming`: Generation, reuse, shareable persistence, and inline editing
  of a short project name for a workspace session.

### Modified Capabilities

- `multi-vendor-workspace`: Preset and starter-chip activation creates a new
  session, so that handoff must produce a generated name from generated chip
  family data.
- `global-top-bar`: The persistence-boundary requirement must acknowledge the
  optional shareable `projectName` field in the version-2 payloads.
- `global-app-shell`: Recent sidebar entries must display the saved project
  name.
- `workspace-qol`: The shortcut-help text-field guard must cover the new inline
  project-name input.

## Impact

Touched code is the core workspace type and helpers (`types.ts`, a new pure
`project-name.ts`, `history.ts`, `url-state.ts`, `exporters/json.ts`), the
workspace store and its empty-state creation path, the global top bar, the
Projects page, and the static UI and core I/O tests. No generated data, no MCU
facts, no new route, no dependency, no backend, and no STM32 pin-planning
behavior change beyond the added optional field.

# Proposal

## Why

A daisyUI 5 audit found one retired tab style, a misplaced modal backdrop, a
hand-rolled workspace spinner, and error or pending surfaces that do not use
the adopted component classes. Catalog and quick-search discovery filters are
also lost on reload, although they are presentation state that belongs in
localStorage.

## What Changes

- Replace the About `tabs-boxed` style with a supported daisyUI 5 tab style.
- Move the shortcut-help `form.modal-backdrop` out of `.modal-box` to a direct
  child of `<dialog class="modal">`, keeping focus and close behavior.
- Replace the workspace load spinner with `loading loading-spinner loading-lg
  text-info`. Add `loading loading-spinner loading-xs` to the six pending
  messages on the catalog route, MCU switcher, quick search, start-screen
  statistics, About provenance, and compatible-MCU finder.
- Move the error surfaces on the catalog route, start screen, quick search, and
  About provenance panel onto `alert alert-soft alert-error` without changing
  their visible strings or retry controls.
- Split each SummaryDrawer DMA row into either a `card` branch or an `alert`
  branch, never both on one element.
- Add a Workspace entry next to Home in the global sidebar. It opens the
  current chip, or the most recent session when no chip is loaded, and is
  visibly disabled when neither exists. The collapsed rail, expanded overlay,
  and single sidebar mount stay unchanged.
- Persist catalog `query`, `vendorFilter`, `familyFilter`, and `packageFilter`
  plus the equivalent quick-search filters in localStorage only. They never
  enter share URLs, version-2 project JSON, recent sessions, or undo history.
  Pin configuration persistence is unchanged.
- Update the static UI tests deliberately and add a unit test for the new
  browser-local preference store.

## Capabilities

### New Capabilities

- `shell-polish-and-persisted-discovery`: Browser-local discovery filter
  persistence, the direct sidebar Workspace entry, and the daisyUI 5 class
  structure shared by status, pending, and dialog surfaces.

### Modified Capabilities

- `global-app-shell`: Sidebar section entries gain the Workspace entry; the
  catalog route and shell preference contract cover persisted discovery
  filters.
- `global-top-bar`: The shortcut help and MCU switcher surfaces reached from
  the bar keep their dialog and pending-state behavior under the adopted
  classes.
- `pinspec-start-screen`: Quick-search filters persist locally; start-screen
  error and pending surfaces use the adopted classes.
- `workspace-qol`: Catalog failure and pending rows and native dialog focus
  behavior remain intact with the adopted classes.

## Impact

Changed files are the global sidebar, catalog and start-screen discovery
surfaces, About and provenance surfaces, workspace load and DMA views, the
shortcut help dialog, MCU switcher, compatible-MCU finder, the existing static
UI tests, and README shell description. A new localStorage-only state store and
its unit test are added in `src/state/` and `tests/`. No npm dependency, no
`src/core/` change, no generated-data change, no share or project schema
change, and no new backend surface.

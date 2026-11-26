# Proposal: Top Bar Refinements

## Why

The thin navigation bar is functionally complete but visually unbalanced. The
Workspace control sits in the right group, where it repeats the active workspace
context, and GitHub and shortcuts render text labels that compete with the
section names. Product identity is absent from non-workspace routes, and the
36 px bar is taller than necessary for icon-first navigation.

## What Changes

- Reduce the thin navigation bar from `h-9` to `h-8` and update the shell
  scroll offset and Clear All confirmation offset to match.
- Center the Workspace control between the left sections and right resources,
  and hide it entirely on workspace and shared routes where it is redundant.
  Keep its disabled state when no chip or recent session exists.
- Render GitHub and keyboard shortcuts as icon-only controls at every width.
- Show the app icon plus the PinSpec name on non-workspace routes in the thin
  bar; keep the app icon on the workspace action bar for workspace and shared
  routes.
- Update `AGENTS.md`, README, specs, and static shell tests to the refined
  contract.

## Capabilities

- `thin-top-bar-navigation`
- `global-top-bar`

## Out of scope

No routing, data, solver, exporter, dialog, or persistence change. The second
workspace bar keeps its `h-12` height and all existing actions.

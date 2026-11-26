# Proposal: Persistent Navigation Identity

## Why

The centered app icon and `PinSpec` name currently disappear on workspace and
shared routes, even though those routes keep the same global shell. This makes
the thin bar change identity between routes and leaves the product name visible
only in the secondary action bar's icon. The identity should be a stable part
of the global navigation bar on every route.

## What Changes

- Render the centered app icon and `PinSpec` name on all routes, including
  workspace and shared routes.
- Keep the Workspace control conditional on non-workspace routes and keep the
  app icon in the workspace action bar.
- Update AGENTS.md, specs, and static shell tests so the identity is no longer
  described as route-specific.

## Capabilities

- `thin-top-bar-navigation`

## Out of scope

No layout height, action, routing, data, solver, exporter, dialog, or
persistence change.

# Proposal: Top Bar Balance

## Why

The previous refinement centered the Workspace control and placed the product
identity at the left edge. That puts the least useful navigation target at the
visual focal point and crowds the section links. Workspace belongs with the
other action-oriented controls on the right; the product identity is the better
element to center.

## What Changes

- Move the Workspace control back to the start of the right-hand group, while
  keeping it absent on workspace and shared routes.
- Center the app icon and `PinSpec` name on non-workspace routes in the middle
  region of the thin bar.
- Keep the bar at `h-8`, keep GitHub and shortcuts icon-only, and leave the
  workspace action bar unchanged.
- Update the shell contract documentation and static tests.

## Capabilities

- `thin-top-bar-navigation`

## Out of scope

No routing, data, solver, exporter, dialog, or persistence change. The landing
page redesign is a separate exploration.

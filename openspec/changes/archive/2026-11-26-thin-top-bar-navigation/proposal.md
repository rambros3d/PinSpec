# Proposal: Thin Top Bar Navigation

## Why

The collapsible 3rem sidebar reserves width on every route and hides Home,
Projects, Catalog, About, Hotkeys, and recent sessions behind an overlay. The
current h-12 global bar also mixes route navigation with the full workspace
action row, so it becomes crowded on narrow viewports. A thin desktop-style
title bar separates durable navigation from route-specific actions and gives
page content the full viewport width.

## What Changes

- Replace the sidebar with a thin h-9 global navigation bar. Left: Home,
  Projects, Catalog. Right: Workspace, an info icon for About, a GitHub link
  icon, the keyboard-shortcuts icon, and the compact theme picker. The wordmark
  is removed and all labels collapse to icons below the `sm` breakpoint.
- Keep Workspace disabled when neither a loaded chip nor a recent session
  exists, preserving the current sidebar semantics. Remove recent sessions
  from the shell; the Projects route remains their management surface.
- Extract workspace actions into a second h-12 bar mounted once in the shell on
  workspace and shared routes. It owns the project name, MCU switcher, undo,
  redo, Clear All, Compatible MCUs, Compare, Share, and Export. The Clear All
  confirmation anchors below this bar.
- Retire `shellPreferences.sidebarExpanded` and the
  `pinspec:shell_preferences_v1` key. Discovery filters and theme remain the
  only localStorage preferences, and no new field enters share URLs, project
  files, or history.
- Amend `AGENTS.md`, the `global-app-shell` and `global-top-bar` specs, and the
  static shell tests to make the two-bar layout the new contract.

## Capabilities

- `thin-top-bar-navigation`
- `global-app-shell`
- `global-top-bar`

## Out of scope

No change to routing, the six vendors, generated data, solver rules, exporters,
dialog ownership, the canvas search HUD, or npm dependencies. The About route
and its provenance table remain unchanged; only its shell entry becomes an
icon.

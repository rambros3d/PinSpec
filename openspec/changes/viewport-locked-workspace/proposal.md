# Proposal: Viewport-Locked Workspace

## Why

On narrow or portrait viewports the workspace lets the document scroll: `100vh`
exceeds the visible area when mobile browsers show dynamic toolbars, `100vw`
includes the scrollbar width, there is no document-level overflow lock, and tall
modals or a wide toolbar can push content past the viewport. Pin popovers and
context menus can also open partly off-screen. An engineer planning a pinout on
a phone or tablet currently has to scroll the page to reach controls, which
breaks the single-screen IDE model. This change makes the workspace fit the
visible viewport in both orientations.

## What Changes

- Lock the document to the visible viewport: use `100dvh` and `100%` width on the
  workspace root and set `overflow: hidden` plus `overscroll-behavior: none` on
  `html`, `body`, and the root, so the document never scrolls or overscrolls.
- Reposition existing component instances with CSS grid named areas instead of
  duplicating mounts. Landscape keeps the three-pane layout (toolbar, left
  peripheral tree, center canvas, right summary drawer); portrait moves those
  panes into a single bottom dock.
- Add a portrait bottom dock with tabs: Peripherals, Pins, Diagnostics, DMA, PIO.
  One tab body is visible at a time; the dock occupies roughly 40-45% of the
  viewport height and its body scrolls internally.
- Activate the portrait layout with a pure CSS `@media (orientation: portrait)`
  rule only. No JavaScript orientation detection and no width-only breakpoint.
- Compact the top toolbar on narrow widths and let its control row scroll
  horizontally inside the toolbar so it never widens the document.
- Hide the left and right pane resize handles in portrait.
- Cap modal height to the viewport and make modal content scroll internally so
  modals never push the document.
- Keep pin popovers and context menus floating in portrait and clamp their
  coordinates to keep them fully inside the viewport. Clamping lives in
  `PackageCanvas.svelte` or a pure helper under `src/core/` with no DOM imports.
  No bottom sheets.
- Persist the active portrait dock tab as additive version-2 workspace state so
  it survives reload, `localStorage` sessions, share URLs, and project JSON.
  Default to the Peripherals tab when absent. Persistence of existing settings
  is otherwise unchanged.
- Propagate `min-h-0` through flex parents so the peripheral tree, summary
  drawer, dock body, and modal bodies keep their existing internal scrolling.
- Add tests and verification proving the document cannot scroll while internal
  panes still scroll, and that dock-tab persistence round-trips.

Out of scope: this change does not alter data adapters, generated shards, solver
behavior, or the Rust, C, and CSV exporters. It introduces no new npm dependency
and no new UI component library.

## Capabilities

### New Capabilities

- `viewport-locked-workspace`: A workspace layout that fits the visible viewport
  in landscape and portrait, with a tabbed portrait dock, internally scrolling
  panes, viewport-clamped floating overlays, and a persisted active dock tab.

### Modified Capabilities

None. The existing workspace, theme, and mux capabilities keep their current
requirements; this change adds layout behavior without changing solver, data,
or export behavior.

## Impact

Affected code: `src/pages/WorkspacePage.svelte`, `src/app.css`,
`src/components/workspace/TopToolbar.svelte`,
`src/components/workspace/PackageCanvas.svelte`, the modal components
(`McuSwitcherModal.svelte`, `ExportModal.svelte`), the workspace state, URL
codec, and JSON project file for dock-tab persistence, and `tests/`. All styling
uses existing daisyUI theme tokens; no hardcoded colors outside
`src/themes/daisyui.css`. `src/core/` remains pure TypeScript with no Svelte or
DOM imports. No new npm dependency.

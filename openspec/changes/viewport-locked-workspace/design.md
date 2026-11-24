# Design

## Context

See `proposal.md` - Why for the motivation. `WorkspacePage.svelte` currently
mounts a `h-screen w-screen flex flex-col overflow-hidden` root, a `h-12
shrink-0` toolbar, and a `flex-1 flex min-h-0 overflow-hidden` body. The left pane
is `hidden md:block` with a JavaScript-driven `leftWidth`, the center pane is
`flex-1 min-w-0`, and the right pane is `hidden lg:block` with a `rightWidth`;
resizers call `startResize()`. `PeripheralTree.svelte` and
`SummaryDrawer.svelte` already use `h-full flex flex-col overflow-hidden` with an
inner `flex-1 overflow-y-auto`, so their scrolling works only if `min-h-0`
reaches every flex ancestor. `src/app.css` sets font, background, color, margin,
and padding on `html` and `body` but no height or overflow constraint. Modals in
`WorkspacePage.svelte` are `fixed`. Popover, context-menu, and tooltip
coordinates are computed in `PackageCanvas.svelte` from pointer events. The
workspace state is a strict version-2 schema with no v1 path; persistence is
shared across `WorkspaceState`, undo/redo history, `localStorage` sessions,
share URLs, and project JSON. Colors come only from daisyUI tokens in
`src/themes/daisyui.css`, `src/core/` is pure TypeScript with no Svelte or DOM
imports, and no new npm dependency is allowed.

## Goals / Non-Goals

**Goals:**

- Make the document non-scrollable and non-overscrollable while keeping content
  reachable through internal scrolling in every pane and modal.
- Preserve the three-pane landscape layout and reposition the same components
  into a tabbed bottom dock in portrait without duplicate mounts.
- Trigger the portrait layout from CSS orientation only, with no JavaScript
  orientation detection and no width-only rule.
- Keep floating pin overlays fully inside the viewport in both orientations.
- Persist the active dock tab across every version-2 state surface with a
  Peripherals default.
- Prove the layout contract with tests and the full verification sequence.

**Non-Goals:**

- No change to solver behavior, data adapters, generated shards, or the Rust, C,
  and CSV exporters.
- No new npm dependency, UI component library, or extra theme token set.
- No bottom sheets for popovers or context menus; they stay floating.
- No session-only layout preference.

## Decisions

- **Viewport lock at document and root.** Set `height: 100%` and
  `overflow: hidden` on `html` and `body`, add `overscroll-behavior: none`, and
  size the workspace root with `100dvh` and `width: 100%`. `dvh` tracks the
  visual viewport as mobile browser toolbars appear and retract, so `100vh` no
  longer exceeds the visible area. `100%` width avoids the scrollbar-width
  overflow introduced by `100vw`. Neither the document nor its ancestors keep a
  scrollable overflow region, so scrolling is confined to explicitly scrollable
  descendants.
- **CSS grid named areas instead of duplicate mounts.** Give
  `WorkspacePage.svelte` one grid with named areas for toolbar, left pane,
  canvas, right pane, and dock. Landscape assigns the left and right panes to
  their own columns and leaves the dock area empty. Portrait collapses the grid
  to a canvas row plus a dock row. The same `PeripheralTree`, `SummaryDrawer`,
  `PackageCanvas`, and pin-table instances are repositioned by grid-area rules,
  so assignments, history, and local component state survive an orientation
  change without remounting. Alternative: conditioning separate landscape and
  portrait component trees would duplicate mounts, lose local state, and risk
  divergence between the two renderings.
- **Pure CSS orientation selector.** Use `@media (orientation: portrait)` as the
  only layout switch. Do not add resize listeners, `matchMedia` subscriptions,
  or width breakpoints to the Reactivity store layer for this change. The
  browser owns the orientation signal, and the layout follows it without a
  state update or a persisted orientation flag. Alternative: a JavaScript
  `matchMedia` store would introduce an extra reactive source, a persistence
  question, and a width-only fallback that the spec forbids.
- **Single dock with five tabs.** In portrait, place Peripherals, Pins,
  Diagnostics, DMA, and PIO in one dock with a tab strip and one visible body.
  The dock body is sized around 40-45dvh and uses `min-h-0` plus internal
  `overflow-y-auto`; the canvas takes the remaining height. Only the selected
  body is rendered visible, so the document never grows with dock content.
  Alternative: stacking all five panels vertically would force the canvas off
  screen and reintroduce page scrolling.
- **Persist only the active dock tab.** Add one additive optional field to
  version-2 `WorkspaceState` for the dock tab, normalized to `peripherals` when
  absent. Thread it through `cloneWorkspaceState()`, `statesEqual()`, the
  `localStorage` session serializer, `CompactUrlPayload`/`url-state.ts`, and
  `PinCraftProjectFile`/`json.ts` in one pass. The dock tab is a genuine user
  preference and must survive reload and sharing under AGENTS.md; orientation
  itself is derived from the viewport and is not persisted. Alternative: keeping
  the tab only in a component variable would violate the persistence rule and
  desynchronize share links from the saved session.
- **Toolbar compaction and internal horizontal scroll.** Keep the toolbar
  `shrink-0` and capped to one row. On narrow widths, hide nonessential labels
  through token-based utility classes and give the control row
  `overflow-x-auto` with `min-w-0` on its flex parents. A long part number is
  truncated with an ellipsis rather than expanding the row. Alternative:
  wrapping controls to a second row would consume canvas height and push
  content toward the viewport edge.
- **Modal height caps.** Cap fixed modals with a maximum height based on `dvh`
  and make their content area a `min-h-0` flex child with `overflow-y-auto`.
  The dialog frame stays inside the viewport and all actions remain reachable
  by scrolling inside the dialog. Alternative: relying on content height lets a
  tall export preview extend below the visible area.
- **Pure numeric clamping helper.** Add a pure helper under `src/core/` that
  takes an overlay's measured width and height plus viewport width and height
  and returns clamped coordinates. `PackageCanvas.svelte` keeps the DOM
  measurement and pointer math, then feeds dimensions into the helper before
  setting popover, context-menu, and tooltip positions. No DOM or Svelte import
  enters `src/core/`, and the helper is unit-testable on the host. Alternative:
  reading `window.innerWidth` inside core would break the pure-core constraint.
- **Flex chain hygiene.** Ensure every flex ancestor between the root and each
  internal scroller carries `min-h-0` (and `min-w-0` where horizontal scrolling
  is involved), including the grid cells that host the dock and the modal
  content wrapper. This preserves the existing internal scrolling of the
  peripheral tree and summary drawer instead of letting them expand their
  parents.
- **Verification by assertion, not visual inspection alone.** Add unit tests for
  the pure clamping helper across edges and small viewports and for dock-tab
  round-trips through URL, JSON, history, and session serializers. Add static
  assertions or a small DOM-level check in the component tests that the root
  carries the `100dvh`, `overflow-hidden`, and `overscroll-none` classes and that
  the portrait media rule exists exactly once. Manual verification covers
  internal scrolling and theme rendering at supported zooms.

## Risks / Trade-offs

- [Dynamic browser toolbars can change `dvh` during a gesture] -> Use `dvh` for
  the root and avoid fixed pixel heights on the root or dock; let the grid rows
  recompute from the viewport unit.
- [`min-h-0` propagation is easy to miss in nested flex chains] -> Add a static
  check that the root, grid cells, and internal scroller ancestors include the
  needed minimum-size utilities, and verify internal scrolling in both themes.
- [Popover measurement may be stale on first render] -> Clamp again from the
  measured overlay dimensions after mount using a callback ref or equivalent,
  keeping the pure helper as the single clamping implementation.
- [Docking could duplicate component instances and lose state] -> Keep one
  instance per component and move it with grid-area rules; verify an assignment
  survives an orientation switch in the integration check.
- [Dock tab persistence could desynchronize surfaces] -> Use one normalizer and
  one typed field shared by history, session, URL, and JSON, with the Peripherals
  default applied at every read site.
- [Dark and light themes could expose hardcoded colors] -> Reuse existing
  tokens only and verify all four themes in both orientations.

## Migration Plan

The dock tab field is additive and optional, so existing version-2 workspace
state, share URLs, and project files remain valid and load with the Peripherals
tab active. No schema version bump, data regeneration, or user migration is
needed. Rollback is to remove the portrait grid areas and dock while keeping the
document-level viewport lock; landscape behavior and all persisted settings
remain unchanged.

## Open Questions

None.

# Tasks

## 1. Document viewport lock

- [x] 1.1 Add `height: 100%`, `overflow: hidden`, and `overscroll-behavior: none` to `html` and `body` in `src/app.css`; verify a static check confirms all three declarations are present and the four daisyUI theme imports still resolve
- [x] 1.2 Resize the `WorkspacePage.svelte` root to `100dvh` with `width: 100%` and propagate `min-h-0` and `min-w-0` through every flex and grid ancestor of the internal scrollers; verify a static check confirms the root uses `100dvh` and no `h-screen`/`w-screen` viewport-unit root remains

## 2. Persisted dock tab state

- [x] 2.1 Add one additive optional version-2 dock-tab field to `WorkspaceState` in `src/core/types.ts` with a doc comment naming the persistence rationale, and update `cloneWorkspaceState()`, `statesEqual()`, and the shared normalizer to default to `peripherals` when absent; verify unit tests cover clone, equality, and absent-field normalization under `npm test`
- [x] 2.2 Thread the dock-tab field through `CompactUrlPayload`/`src/core/url-state.ts`, `PinSpecProjectFile`/`src/core/exporters/json.ts`, undo/redo history, and the `localStorage` session serializer without a schema version bump or v1 path; verify round-trip tests restore the selected tab across share URL, project JSON, history, and session with `npm test`

## 3. Orientation-driven grid layout

- [x] 3.1 Convert the `WorkspacePage.svelte` body from fixed-width flex panes to a CSS grid with named areas for toolbar, peripheral tree, canvas, summary drawer, and dock, keeping the same component instances mounted; verify a static check finds one grid definition and the landscape rules assign the three panes to separate areas
- [x] 3.2 Add a single `@media (orientation: portrait)` rule that moves the dock into view and hides the left and right pane resize handles, with no JavaScript orientation detection and no width-only rule; verify a static check confirms exactly one orientation media query and that no `matchMedia` or resize listener was added for layout selection
- [x] 3.3 Implement the portrait dock with tabs Peripherals, Pins, Diagnostics, DMA, and PIO, one visible body at a time, a body sized to roughly 40-45dvh with `min-h-0` and internal `overflow-y-auto`, and the active tab bound to the persisted field; verify the dock body scrolls internally without moving the document in a component check and that only the selected body is visible

## 4. Toolbar and modal fit

- [x] 4.1 Compact the `TopToolbar.svelte` controls on narrow widths, truncate long part numbers, and give the control row `min-w-0` plus internal `overflow-x-auto`; verify a narrow-viewport check shows the toolbar stays inside the viewport and its controls remain reachable without a document scrollbar
- [x] 4.2 Cap the `McuSwitcherModal.svelte` and `ExportModal.svelte` dialog heights to the viewport with `dvh` and make their content scroll internally through a `min-h-0` flex child; verify tall content stays inside the viewport and the action buttons remain reachable in both orientations and both themes

## 5. Floating overlay clamping

- [x] 5.1 Add a pure coordinate-clamping helper under `src/core/` that takes overlay width, height, viewport width, and viewport height and returns coordinates keeping the overlay fully inside the viewport; verify unit tests cover right, bottom, small-viewport, and already-inside cases with `npm test` and confirm the helper imports no Svelte or DOM API
- [x] 5.2 Apply the helper to popover, context-menu, and tooltip positions in `PackageCanvas.svelte` using measured overlay dimensions, keeping all three as floating overlays in portrait; verify a component check shows full visibility near every edge and no bottom sheet is rendered, in both themes at the supported zoom range

## 6. Integration verification

- [x] 6.1 Verify an orientation switch preserves all pin assignments, labels, locks, peripheral modes, diagnostics, and undo/redo history while the document stays fixed and the canvas plus dock remain reachable
- [x] 6.2 Run `npm test` and confirm the full unit suite passes with no failures
- [x] 6.3 Run `npm run check` and confirm strict type checking passes with zero warnings
- [x] 6.4 Run `BASE_PATH="/pinspec/" npm run build` and confirm a clean production subpath build with no broken `/data/` or `/assets/` requests

## Workflow follow-up

- Archive the change with `openspec archive viewport-locked-workspace -y` after all tracked tasks and verification are green
- Verify the archived spec and include it with the implementation commit
- Do not commit `.cache/`, `public/data/`, `dist/`, or `node_modules/`

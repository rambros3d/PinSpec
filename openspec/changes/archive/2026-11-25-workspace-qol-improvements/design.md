# Design

## Context

The affected surfaces are Svelte 5 runes components in `src/components/` and
`src/pages/`, a small set of runes stores in `src/state/`, and one global
stylesheet `src/app.css`. The repository enforces strict constraints that shape
this change:

- `src/core/` stays pure TypeScript with no Svelte or DOM imports.
- Raw color literals live only in `src/themes/daisyui.css`; theme token usage is
  audited by `tests/theme-tokens.test.ts` (28 declared tokens, no new tokens,
  no new raw literals, no emoji).
- `tests/viewport-layout.test.ts` requires exactly one
  `@media (orientation: portrait)` block and exactly two `grid-template-areas`
  declarations in `src/app.css`, keeps `43dvh` as the dock height, and requires
  the toolbar to keep `h-12 shrink-0`, `overflow-x-auto`, `min-w-0`,
  `truncate max-w-[11rem]`, and `hidden sm:inline font-bold`.
- `tests/ui-multi-vendor.test.ts` requires `downloadFile`, `copyContent`,
  `downloadPreview`, `rustCrate`, and the three vendor crate names to remain in
  the export surfaces, and forbids STM32-only copy.
- `tests/pin-placement-affinity.test.ts` requires `PLACEMENT_RINGS`,
  `setPointerCapture`, `type="number"`, `onRing`, and `indicator.name` in the
  placement overlay.
- No new npm dependency and no new persisted setting are allowed. All new UI
  state is transient or derived from already-persisted state.

No data, solver, routing, or exporter-output change is needed; see
`proposal.md` for motivation and `specs/workspace-qol/spec.md` for the behavior
contract.

## Goals / Non-Goals

**Goals:**

- Make failures and empty states explicit and recoverable on both surfaces.
- Keep notifications, dialogs, and keyboard focus usable in portrait and
  landscape.
- Add accessibility semantics (sort state, tab state, focus indication) using
  existing theme tokens and daisyUI classes.
- Keep every static contract green and avoid new settings or dependencies.

**Non-Goals:**

- Keyboard pin navigation and touch remap gestures, which are deferred to a
  dedicated canvas interaction change.
- Changes to solver diagnostics, mux handling, generated shards, share URL or
  project JSON schemas, exporter output, or routing.
- Introducing a test DOM environment, new theme tokens, or new npm packages.

## Decisions

### Catalog error row and retry

Keep `indexError` in the catalog store as the single source of truth. Render an
error row in `QuickSearchBar.svelte` before the generic no-results row, with the
message and a retry control. Add a store-level retry method that clears the
cached in-flight promise and the error before calling the existing loader.
**Rationale:** the loader caches its promise, so calling it again from the
component after a failure would resolve without a new fetch.
**Alternative rejected:** retry only in the component; it cannot reset the
cached promise and would leave the error state stale.

### Pin table empty states and sort semantics

Derive two independent conditions: whether the workspace has any assignments
at all, and whether the filtered rows are empty. Show the no-assignments
message only for the first, and the no-match message plus a clear-filter action
for the second. Map the existing sort key and direction to `aria-sort`
(`ascending`, `descending`, or `none`) on the three sortable headers.
**Rationale:** users need to know whether to assign a pin or relax a filter.
**Alternative rejected:** one combined empty message; it hides the cause.

### Toast placement and dismissal

Add `.workspace-toast` to the existing notification markup and add the portrait
override inside the existing orientation media query in `src/app.css`, using
`bottom: calc(43dvh + 0.75rem)` with no second media query. Add a
`dismissToast()` method to the workspace store that clears the timer and the
toast; wire it to a dismiss button in the toast. Keep tones, text, and the
existing 3200 ms timeout unchanged.
**Rationale:** a second media query or a new dock height would break the
viewport static contract; a single override keeps the layout source of truth.
**Alternative rejected:** rendering the toast inside the dock; that changes the
toast model and can be hidden with the dock tab.

### Failure feedback for copy and download

Wrap clipboard writes and download setup in both export surfaces with failure
handling that calls `workspaceStore.showToast(..., 'warning')`. Keep the
existing success indicators on success. Move `URL.revokeObjectURL()` out of the
synchronous click path into a deferred task after `anchor.click()`.
**Rationale:** clipboard writes reject in untrusted or denied contexts, and an
immediate revoke can cancel the download in some browsers.
**Alternative rejected:** silent `catch` blocks and inline error text in each
export surface; they are inconsistent and easy to miss.

### Dialog focus management

Add a small DOM-only focus helper outside `src/core/` (for example
`src/state/dialog-focus.ts`) that captures the active element before
`showModal()`, focuses a chosen control inside the dialog, and restores the
captured element on the dialog `close` event. Apply it to the six existing
native dialogs and to the new shortcut-help dialog. The export dialog focuses
its primary control; other dialogs focus their first interactive control.
**Rationale:** one helper avoids six divergent implementations while keeping
DOM code out of the pure core.
**Alternative rejected:** autofocus attributes alone; they set initial focus
but do not restore it on close.

### Search shortcut

Keep the existing workspace `Ctrl+F` handler and its `focus()` plus `select()`
calls, and add a static regression check for both calls. The landing `Ctrl+K`
handler already uses this pair.
**Rationale:** the selection behavior is present in the current source; the
risk is regression, not absence. Adding a second handler would double-handle
the key.
**Alternative rejected:** routing the shortcut through new shared keyboard
state; that would introduce persisted or session state for no benefit.

### Focus ring, reduced motion, and text contrast

Add a low-specificity global `:focus-visible` rule in `src/app.css` using
existing theme tokens and an offset outline. Extend the existing reduced-motion
block with a universal animation and transition duration override while
keeping the explicit `.animate-pin-pulse` rule. Change `text-base-content/40`
to `text-base-content/60` only on text-bearing nodes; decorative icon tint
stays at `/40`.
**Rationale:** a global rule covers SVG groups and custom controls that do not
get daisyUI focus styles, and theme tokens keep the audit green.
**Alternative rejected:** per-component ring classes; they miss controls added
later and duplicate token usage.

### Placement overlay Escape and focus

Keep the indicator group's arrow-key angle adjustment. On Escape while a drag
is active, release pointer capture, clear the drag state, and keep focus on a
visible control. Add a focus ring to the SVG indicator group through a CSS rule
that styles a dedicated outline element on `:focus-visible` using a theme
token, since browser support for outlines on SVG groups is inconsistent.
**Rationale:** this preserves all static tokens asserted by the placement
affinity tests.
**Alternative rejected:** moving Escape handling to a global window listener;
it would close unrelated overlays and bypass the drag cleanup.

### Portrait dock tabs

Add `role="tablist"` to the dock tab strip and `role="tab"` plus
`aria-selected` to each tab button, and add `min-h-11` to the buttons. Keep the
existing `data-dock-tab` attribute, tab labels, dock body, and persisted active
tab unchanged, and put the height utility in markup rather than a new CSS
block.
**Rationale:** the single-mount layout contract stays intact and semantics are
exposed to assistive technology.
**Alternative rejected:** a second tab component for portrait; it would
duplicate state and break the single-mount test.

### Toolbar scroll affordance

Keep the toolbar's `overflow-x-auto` row and the existing static strings.
Compute visibility from numeric scroll metrics with a pure helper under
`src/core/`, and use it in `TopToolbar.svelte` to show a small edge indicator
that hides at the end of the row. The indicator uses existing daisyUI classes
and an existing `lucide-svelte` icon; no raw color is added.
**Rationale:** a CSS-only gradient mask needs color stops and cannot report the
scroll position; numeric state stays unit-testable.
**Alternative rejected:** a new theme token or a scrollbar plugin.

### Recent-sessions hint and shortcut help

Show the first-time hint from `recentSessions.length === 0` in
`PresetGrid.svelte`; it disappears naturally when a session is persisted, so
no dismiss flag is needed. Add one native `ShortcutHelpDialog.svelte` listing
the shortcuts already documented in `README.md`, opened by `?` from the
existing workspace keydown handler only when the target is not a text field.
**Rationale:** both features are derived from existing persisted or documented
state.
**Alternative rejected:** a persisted "hint dismissed" flag; it would require
threading a new field through state, URL, project JSON, and sessions.

## Risks / Trade-offs

- [Static contract drift] -> Keep the exact strings asserted by the four named
  test files; run `npm test` after each task group rather than only at the end.
- [Theme audit failure] -> Use only existing tokens and daisyUI classes; never
  add a hex, rgb, hsl, or oklch literal outside `src/themes/daisyui.css`.
- [Object URL lifetime] -> Defer revocation with a macrotask and verify the
  download function name and flow remain present for the export-surface tests.
- [Focus restoration edge cases] -> Apply one helper uniformly to all dialogs,
  including close by Escape, cancel, backdrop, and parent-triggered close.
- [Concurrent file edits] -> Other in-flight changes may touch the same
  components; keep edits scoped to the lines this change owns and re-run the
  full suite before closeout.
- [No DOM test environment] -> Verify behavior through pure helpers plus static
  source assertions; do not add jsdom or happy-dom as a dependency.

## Migration Plan

This is a static client-only change with no data or schema migration. Apply the
edits, run `npm test`, `npm run check`, and
`BASE_PATH="/pincraft/" npm run build`, then archive the change so the delta
spec is synced into `openspec/specs/workspace-qol/`. Rollback is a normal
revert of the implementation commit; no stored user state needs conversion.

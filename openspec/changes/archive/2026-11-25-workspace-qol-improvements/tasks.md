# Tasks

## 1. Catalog error state and retry

- [x] 1.1 Add a retry path to `src/state/catalog.svelte.ts` that clears the cached load promise and `indexError` before re-running the existing loader; verify a unit test in `tests/workspace-qol.test.ts` shows a failed first load followed by a successful retry restores the index and clears the error, with no new persisted field
- [x] 1.2 Render a failure row with the message and a retry control in `src/components/landing/QuickSearchBar.svelte` ahead of the no-results row, and keep loading and normal-result rows intact; verify a static test confirms `indexError` is checked before the empty-result branch and that the retry control calls the retry path, with no STM32-only failure copy

## 2. Pin table empty states and sort semantics

- [x] 2.1 Split the `src/components/workspace/SummaryDrawer.svelte` pin-table empty state into a no-assignments message and a no-match message with a clear-filter action that resets `tableFilter`; verify a static test finds both messages and the filter reset on the action, and that `rows.length` is used for the filter-specific branch
- [x] 2.2 Add `aria-sort` to the Pos, Pin, and Signal sortable headers using the existing sort key and direction; verify a static test asserts `aria-sort` is present on all three sortable headers and `npm run check` reports no type errors

## 3. Toast placement and dismissal

- [x] 3.1 Add `dismissToast()` to `src/state/workspace.svelte.ts` to clear the timer and toast, and add a dismiss button to the toast markup in `src/pages/WorkspacePage.svelte`; verify a unit test shows dismissal clears the toast and a later `showToast()` still works
- [x] 3.2 Add the `.workspace-toast` class to the toast and put `bottom: calc(43dvh + 0.75rem)` inside the existing `@media (orientation: portrait)` block in `src/app.css`; verify `tests/viewport-layout.test.ts` still passes with exactly one orientation media query, two `grid-template-areas`, and the `43dvh` dock height, and confirm the toast tones and 3200 ms timeout are unchanged

## 4. Export failure feedback

- [x] 4.1 Replace the silent catch paths for clipboard writes in `src/pages/LandingPage.svelte` and `src/components/workspace/ExportModal.svelte` with a visible warning notification, keeping the existing success indicators on success; verify a static test asserts both surfaces report failure and `tests/ui-multi-vendor.test.ts` still finds `copyContent`, `downloadFile`, `downloadPreview`, `rustCrate`, and all three crate names
- [x] 4.2 Defer `URL.revokeObjectURL()` until after the download click in both export surfaces; verify a static test shows `revokeObjectURL` after `click()` in each function and a manual download opens the expected file in a local preview build

## 5. Dialog focus management

- [x] 5.1 Add a DOM-only focus helper outside `src/core/` that captures the opener, focuses a dialog control on open, and restores the opener on close; verify a static test confirms the helper is not under `src/core/` and contains no import from `svelte` or DOM-free core modules, and `npm run check` passes
- [x] 5.2 Apply the helper to the six existing native dialogs (`ExportModal.svelte`, `McuSwitcherModal.svelte`, `BoardSelectorModal.svelte`, `CompatibleMcuFinder.svelte`, `PinoutDiffModal.svelte`, and the ambiguous-part dialog in `WorkspacePage.svelte`) with the export dialog focusing a primary control; verify a static test finds focus restoration in all six and that existing `92dvh` and `min-h-0` dialog contracts in `tests/viewport-layout.test.ts` remain green

## 6. Shortcut help dialog

- [x] 6.1 Add `src/components/workspace/ShortcutHelpDialog.svelte` as a native dialog listing only the shortcuts documented in `README.md`, using the same focus helper; verify a static test asserts the dialog lists `Ctrl+K`, `Ctrl+F`, `Ctrl+Click`, undo, redo, `0`, and `Escape`, and that no shortcut is invented
- [x] 6.2 Open the help dialog on `?` from the existing `WorkspacePage.svelte` keydown handler only when the target is not a text field; verify a static test shows the `?` branch guarded by the existing `inInput` condition and that `Ctrl+F` still calls both `focus()` and `select()`

## 7. Focus visibility, motion, and contrast

- [x] 7.1 Add a global low-specificity `:focus-visible` outline in `src/app.css` using existing theme tokens and extend the existing reduced-motion block beyond `.animate-pin-pulse`; verify `tests/theme-tokens.test.ts` still passes with zero raw color literals, zero new declared tokens, and zero emoji, and confirm a static test finds the outline and the reduced-motion override
- [x] 7.2 Raise text-bearing `text-base-content/40` usages to `text-base-content/60` in landing and workspace surfaces while leaving decorative icon tint untouched; verify a static test confirms no text-bearing node on the touched surfaces uses `/40` and `tests/theme-tokens.test.ts` still passes

## 8. Placement overlay Escape and focus

- [x] 8.1 End an active indicator drag on Escape in `src/components/workspace/PlacementOverlay.svelte` by releasing pointer capture and clearing drag state, keeping focus on a visible control; verify a static test finds an Escape branch in the indicator keydown handler and `tests/pin-placement-affinity.test.ts` still finds `PLACEMENT_RINGS`, `setPointerCapture`, `type="number"`, `onRing`, and `indicator.name`
- [x] 8.2 Add a focus-visible ring to the keyboard-operable SVG indicator group using a dedicated outline element styled with an existing theme token; verify a static test confirms the group keeps `role="button"`, `tabindex="0"`, and arrow-key angle handling, and that no raw color literal was added

## 9. Portrait dock and toolbar affordance

- [x] 9.1 Add `role="tablist"` to the portrait dock tab strip and `role="tab"` plus `aria-selected` to each tab button in `src/pages/WorkspacePage.svelte`, and add `min-h-11` to the tab buttons; verify a static test confirms all three attributes and the height class, and `tests/viewport-layout.test.ts` still passes with one `data-dock-tab=` binding and unchanged tab labels
- [x] 9.2 Add a pure scroll-affordance helper under `src/core/` taking scroll offset and width metrics, and use it in `src/components/workspace/TopToolbar.svelte` to show and hide an edge indicator without changing the toolbar row; verify unit tests cover start, middle, end, and non-overflow states, and a static test confirms `h-12 shrink-0`, `overflow-x-auto`, `min-w-0`, `truncate max-w-[11rem]`, and `hidden sm:inline font-bold` remain

## 10. Landing recent-sessions hint

- [x] 10.1 Show a short first-time hint near the starter chips in `src/components/landing/PresetGrid.svelte` when the persisted recent-sessions list is empty, and hide it when sessions exist; verify a static test confirms the hint is derived from `recentSessions.length` and that no new persisted field, dismiss flag, or npm dependency was introduced

## 11. Integration verification

- [x] 11.1 Run `npm test` and confirm the full unit and static-contract suite passes, including `tests/viewport-layout.test.ts`, `tests/ui-multi-vendor.test.ts`, `tests/theme-tokens.test.ts`, and `tests/hardware-audit.test.ts`, with no skipped or failing cases
- [x] 11.2 Run `npm run check` and confirm strict TypeScript passes with zero warnings
- [x] 11.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm a clean production subpath build with no broken `/data/` or `/assets/` requests and no change to generated shards

## Workflow follow-up

- Run `openspec validate workspace-qol-improvements --strict` before implementation starts
- After every tracked task passes, run `openspec archive workspace-qol-improvements -y` and include the archived spec in the implementation commit
- Do not commit `.cache/`, `public/data/`, `dist/`, or `node_modules/`

## Scope note

- Deferred to a dedicated canvas interaction change: keyboard pin navigation and a touch remap gesture.
- Not part of this change: solver, data adapters, generated shards, share URL or project JSON schemas, exporter output, and routing.

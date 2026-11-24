# Tasks

## 1. Pure partition helper and shared category metadata

- [x] 1.1 Add a DOM-free helper to `src/core/vendor-view.ts` that returns configured and unconfigured peripheral name lists from `peripheralStatus` and `peripheralModes`, treating status `none` and a missing or `disabled` mode as unconfigured; verify a new Vitest file covers STM32G431CBU6, STM32F103C8T6, CH32V203C8T6, RP2040, and RP2350B and asserts the module imports no Svelte or DOM API
- [x] 1.2 Move the peripheral category and kind table, including `kinds: ['pwm', 'pio']` and the "Other peripherals" label, into the shared pure module consumed by the tree and the detail surface; verify `tests/ui-multi-vendor.test.ts` asserts that token against its new owner and `npm run check` reports no type errors

## 2. localStorage-only view preferences and dock tab removal

- [x] 2.1 Add a typed preferences helper under `src/state/` with a namespaced localStorage key, availability guards, and validation that reuses `normalizeDockTab`; it owns selected peripheral, filter text, category expansion, active summary tab, and active dock tab; verify a unit test shows values survive a fresh helper instance and that absent or unknown values fall back to documented defaults
- [x] 2.2 Remove `dockTab` from `WorkspaceState`, `cloneWorkspaceState`, `statesEqual`, history, the URL codec `d` field, the project JSON exporter and parser, and recent-session state, while ignoring legacy dock values instead of rejecting state; verify `tests/viewport-layout.test.ts` dock persistence cases now assert localStorage survival, absence from share URL and project JSON, default Peripherals, and unchanged pin state, and `tests/hardware-audit.test.ts` no longer lists `dockTab` in exported JSON keys
- [x] 2.3 Route the workspace dock tab getter and setter through the preferences helper so selecting a tab no longer commits a history entry; verify a test shows that assigning and locking pins, then changing the dock tab, leaves assignments, locks, modes, and history unchanged while localStorage holds the new selection

## 3. Right-drawer detail surface and selection wiring

- [x] 3.1 Add `src/components/workspace/PeripheralDetail.svelte` containing the selected peripheral header, mode selector, remap selector with `registerNote` and `summarizeRemapSignals`, tag pills through `PinTagPills`, per-signal toggles with assigned pin badges and locate-pin buttons, and a short prompt when no peripheral is selected; verify `tests/ui-multi-vendor.test.ts` reads the retargeted tokens `pInfo.remaps && pInfo.remaps.length > 1`, `registerNote`, `summarizeRemapSignals`, `onRemapChange`, and `PinTagPills` from the detail component and keeps the CH32 remap data assertions
- [x] 3.2 Add `configuration` to the `SummaryDrawerTab` union, tab bar, and render blocks in `SummaryDrawer.svelte`, and forward the existing mode, remap, signal, and focus callbacks to the detail component; verify a static test confirms the tab and render branch exist and that `tests/viewport-layout.test.ts` still finds `min-h-0` and `overflow-y-auto` in the drawer source
- [x] 3.3 Wire `WorkspacePage.svelte` so a tree row selection stores the selected peripheral, sets the summary tab to `configuration`, and sets the dock tab to `configuration`; verify a static test confirms all three effects in the selection handler and that `tests/workspace-qol.test.ts` no longer forbids the retired `font-mono-tabular text-[11px] text-base-content/40` string in the tree

## 4. Compact tree rows, grouping, and empty state

- [x] 4.1 Replace the expanded tree detail body with compact rows containing only peripheral name, status dot, and inline mode label, and remove the inline signal list and per-peripheral expansion toggle; verify `tests/ui-multi-vendor.test.ts` no longer finds detail tokens in `PeripheralTree.svelte` and `tests/viewport-layout.test.ts` still finds exactly one `PeripheralTree` mount
- [x] 4.2 Sort configured peripherals before unconfigured ones inside every category using the pure helper, collapse "Other peripherals (N)" by default with the correct count, and render a short browsable empty-state line when no peripheral is configured; verify a static test asserts all three behaviors in the tree source and the group 1 helper tests still pass

## 5. Portrait dock Configuration tab and layout contracts

- [x] 5.1 Add `configuration` to `DOCK_TABS` and `DOCK_TAB_LABELS`, and add `[data-dock-tab='configuration']` to the existing `.workspace-summary` selector group in `src/app.css`; verify `tests/viewport-layout.test.ts` is updated for the Configuration label and selector while still finding exactly one portrait media query, two `grid-template-areas` blocks, one `data-dock-tab=` binding, and the `43dvh` dock height
- [x] 5.2 Keep the dock tab strip semantics and touch targets unchanged for the expanded tab set; verify `tests/workspace-qol.test.ts` checks Peripherals, Pins, Configuration, Diagnostics, DMA, and PIO labels, `role="tablist"`, `role="tab"`, `aria-selected`, `min-h-11`, and a single `data-dock-tab=` binding, and `tests/hardware-audit.test.ts` still finds `audit` in `DOCK_TABS` and the audit dock selector in `src/app.css`

## 6. Integration verification

- [x] 6.1 Run `npm test` and confirm the full unit and static-contract suite passes, including the new core partition cases, retargeted detail assertions, rewritten dock persistence cases, and unchanged pin-configuration round-trip cases, with no skipped or failing tests
- [x] 6.2 Run `npm run check` and confirm strict TypeScript passes with zero warnings, and confirm no DOM or Svelte import exists under `src/core/`
- [x] 6.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm a clean production subpath build with no broken `/data/` or `/assets/` requests and no change to generated shards
- [x] 6.4 Run `tests/theme-tokens.test.ts` checks and confirm zero raw color literals outside `src/themes/daisyui.css`, no retired utilities in new markup, and zero emoji in delivered source, then confirm no new npm dependency was added

## Workflow follow-up

- Run `openspec validate peripheral-tree-detail-panel --strict` before implementation and again after all tracked tasks pass
- After verification is green, run `openspec archive peripheral-tree-detail-panel -y` and include the archived spec and delta in the implementation commit
- Do not commit `.cache/`, `public/data/`, `dist/`, or `node_modules/`

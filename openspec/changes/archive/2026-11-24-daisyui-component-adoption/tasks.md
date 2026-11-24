# Tasks

## 1. Dependency and plugin foundation

- [x] 1.1 Add `daisyui@latest` as a devDependency and refresh `package-lock.json`; verify `npm ci` exits zero, `package.json` lists daisyui, and `.npmrc` still sets `legacy-peer-deps=true`.
- [x] 1.2 Register `@plugin "daisyui"` in `src/app.css` with `themes: false`, `logs: false`, no `include` restriction, and `exclude: rootcolor, rootscrolllock, rootscrollgutter`; verify the plugin block is present and `src/themes/daisyui.css` is unchanged.
- [x] 1.3 Remove duplicate `--color-*`, `--radius-*`, and `--size-*` declarations from `@theme inline` while retaining font aliases and derived custom variables; verify `npm run check` exits zero and the four vendored theme values remain byte-for-byte unchanged.

## 2. Foreground rename and utility migration

- [x] 2.1 Rename the custom `text-primary` utility to `text-foreground` with a full alias-free migration across all sources and tests; verify a source scan finds no former custom `text-primary` utility use and `npm test` exits zero.
- [x] 2.2 Replace custom shape, border, size, surface, action, and pin-surface utilities on non-SVG surfaces with daisyUI component classes plus `bg-base-*`, `badge-*`, and `alert-*` status utilities; verify a scan of `src/components/**` and `src/pages/**` finds no retired utility names.
- [x] 2.3 Preserve EDA SVG geometry, SVG pin-state colors, pointer pan and zoom, overlay clamping, peripheral tree state, and the always-on IC depth/noise texture in the two package renderers; verify `tests/theme-tokens.test.ts` and `tests/viewport-layout.test.ts` still pass with texture and overlay assertions intact.

## 3. Component class adoption across surfaces

- [x] 3.1 Apply daisyUI component classes to landing surfaces (top navigation, search, hero preview, preset grid, export preview, footer) without changing theme tokens or state contracts; verify `npm run check` and `npm test` exit zero.
- [x] 3.2 Apply daisyUI classes to the workspace toolbar, peripheral tree, summary drawer, and portrait dock tabs while keeping the single-mount orientation grid and persisted dock tab; verify the updated `tests/viewport-layout.test.ts` assertions for toolbar fit, single mounts, and dock tabs pass.
- [x] 3.3 Map all remaining status pills, badges, alerts, and pin surfaces to daisyUI equivalents with their original semantic state; verify `tests/theme-tokens.test.ts` and `tests/hardware-audit.test.ts` pass and no status meaning changed.

## 4. Native dialog migration

- [x] 4.1 Convert ExportModal and McuSwitcherModal to `<dialog class="modal">` with `bind:this`, `showModal()`, `close()`, `onclose`/`oncancel`, backdrop-target close, and bounded scrolling; verify updated static assertions in `tests/viewport-layout.test.ts` and `tests/hardware-audit.test.ts` pass.
- [x] 4.2 Convert BoardSelectorModal, CompatibleMcuFinder, and PinoutDiffModal to the same native dialog contract while preserving props, callbacks, result payloads, and internal scrolling; verify `tests/compatible-mcu-finder.test.ts` and `tests/project-diff.test.ts` pass with updated viewport-bound assertions.
- [x] 4.3 Convert the ambiguous-import dialog in WorkspacePage and remove every duplicate window-level Escape listener from the six dialog surfaces; verify `tests/ioc-import.test.ts` and `tests/viewport-layout.test.ts` pass and a source scan finds no dialog-local window Escape listener.

## 5. Audit, static contracts, and documentation

- [x] 5.1 Update `tools/theme-token-audit.ts` to recognize tokens now owned by daisyUI components while keeping depth and noise intentionally inert; verify the audit CLI exits zero and reports no actionable token without a consumer.
- [x] 5.2 Update `tests/theme-tokens.test.ts` and all other static-string tests affected by renamed utilities, `92dvh`, `h-12 shrink-0`, `overflow-x-auto`, `min-h-0 overflow-y-auto`, `data-dock-tab`, and texture scope, preserving their behavioral assertions; verify `npm test` exits zero with no assertion removed merely to match new strings.
- [x] 5.3 Add a factual MIT license credit line for daisyUI to `README.md`; verify `tests/docs-attribution.test.ts` passes and an ASCII/emoji scan of changed files is clean.

## 6. Integration verification

- [x] 6.1 Run `npm ci`, `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify all four commands exit zero and the build reports no Svelte warnings.
- [x] 6.2 Inspect the built CSS asset emitted for the `/pincraft/` subpath; verify it contains daisyUI component selectors and no former custom foreground or retired shape utility definitions.
- [x] 6.3 Confirm every scenario in the `daisyui-component-adoption` delta spec is covered by a passing test, command result, or inspected artifact, then report validation and verification output before archive.

## Workflow follow-up

- The implementation agent runs `openspec archive daisyui-component-adoption -y` only after all tracked tasks pass and verification is green, and includes the archived spec files in the implementation commit.

# Proposal

## Why

The UI currently re-implements common controls with custom `@utility` definitions and hand-rolled overlays while shipping a vendored daisyUI theme file. That duplicates component behavior that daisyUI 5 already supplies through token-driven classes, and a custom `text-primary` utility collides in name with the daisyUI brand color token. Registering the daisyUI plugin and using its component classes removes the duplicated layer without changing the four vendored themes or the pinout behavior.

## What Changes

- Add `daisyui@latest` as a devDependency and register `@plugin "daisyui"` in `src/app.css`. Configure `themes: false` (the four vendored `[data-theme]` names collide with daisyUI built-ins), `logs: false` (the default log contains an emoji), no `include` restriction (all component families available), and `exclude: rootcolor, rootscrolllock, rootscrollgutter` (the shell is viewport-locked at 100dvh).
- Stop redeclaring `--color-*`, `--radius-*`, and `--size-*` values in `@theme inline` where daisyUI already registers them; leave `src/themes/daisyui.css` and all four theme values unchanged.
- Rename the custom foreground utility `text-primary` to `text-foreground` across all sources and tests. **BREAKING** for the internal class contract: no alias is kept, so every use is migrated in this change.
- Replace custom semantic utilities (`rounded-panel`, `rounded-control`, `rounded-pill`, `border-ui*`, `bg-canvas`, `bg-action`, `bg-pin-*`, and related aliases) on all non-SVG surfaces with daisyUI component classes and daisyUI status/semantic utilities such as `bg-base-*`, `badge-*`, and `alert-*`. Keep only custom CSS that cannot be expressed by daisyUI: EDA SVG geometry, pointer pan and zoom, overlay clamping, tree state, and the always-on IC depth/noise texture in the two package renderers. SVG pin-state colors keep their existing semantic mapping.
- Migrate ExportModal, McuSwitcherModal, BoardSelectorModal, CompatibleMcuFinder, PinoutDiffModal, and the ambiguous-import dialog in WorkspacePage to native `<dialog class="modal">` elements. Use Svelte 5 `bind:this`, `showModal()`, `close()`, `onclose`/`oncancel`, and backdrop-target close; preserve all data contracts and internal scrolling; remove duplicate window-level Escape listeners.
- Update `tools/theme-token-audit.ts`, `tests/theme-tokens.test.ts`, and all static-string tests that pin renamed classes, `92dvh`, `h-12 shrink-0`, `overflow-x-auto`, `min-h-0 overflow-y-auto`, `data-dock-tab`, utility names, or texture scope. Preserve each test's behavioral assertion.
- Add a factual MIT license credit line for daisyUI in `README.md`. No other dependency is added; `vite.config.ts` and `svelte.config.js` are unchanged.
- Verify with `npm ci`, `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build` with zero warnings, and a GitHub Pages CSS bundle check that the built stylesheet under `/pinspec/` contains the daisyUI component rules and no renamed custom utility.

## Capabilities

### New Capabilities

- `daisyui-component-adoption`: Governs daisyUI plugin registration, token ownership, the foreground utility rename, component-class adoption on non-SVG surfaces, native dialog behavior, and the audit and verification contract for this migration.

### Modified Capabilities

None. The vendored themes, viewport-locked layout behavior, pin-state semantics, and all core domain behavior are preserved; no existing capability requirement changes.

## Impact

- Dependencies and build: `package.json`, `package-lock.json`, `src/app.css`, `README.md`.
- Markup: `src/pages/LandingPage.svelte`, `src/pages/WorkspacePage.svelte`, all files under `src/components/landing/` and `src/components/workspace/` that use renamed utilities or modal markup. `PerimeterPackage.svelte` and `GridPackage.svelte` retain custom SVG geometry and texture.
- Tooling and tests: `tools/theme-token-audit.ts`, `tests/theme-tokens.test.ts`, `tests/viewport-layout.test.ts`, `tests/compatible-mcu-finder.test.ts`, and any other test with literal strings affected by the rename or dialog migration.
- Runtime: GitHub Pages static CSS bundle under the `/pinspec/` subpath. No backend, no new asset paths, no state schema changes.

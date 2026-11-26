# Design

## Context

See `proposal.md` for motivation. The current stylesheet imports Tailwind CSS v4 and a vendored `src/themes/daisyui.css` with four `[data-theme]` blocks. It then redeclares color, radius, and size aliases in `@theme inline` and defines custom `@utility` rules for foreground text, shape, borders, sizes, and surfaces. Components and pages consume those custom utilities directly, and six dialog surfaces use absolutely positioned panels with window-level Escape listeners. Static tests pin many of these literal class strings, and `tools/theme-token-audit.ts` counts `var(--token)` references outside the vendored theme file. The shell is locked to the visible viewport with `100dvh`, and the IC package renderers use SVG geometry with an always-on depth and noise texture.

## Goals / Non-Goals

**Goals:**

- Register daisyUI 5 as the component layer while keeping the four vendored themes unchanged.
- Move every non-SVG UI surface to daisyUI component classes and semantic color utilities.
- Give the custom foreground text utility an unambiguous name with a complete, alias-free rename.
- Move the six dialog surfaces to the platform modal dialog contract without changing their data contracts.
- Keep the token audit, static tests, and verification commands factual and green after the migration.

**Non-Goals:**

- Changing theme color values, adding a compact-density variant, or introducing a fifth theme.
- Replacing EDA SVG geometry, SVG pin-state colors, pointer pan and zoom, overlay clamping, or peripheral tree state with daisyUI components.
- Removing or gating the IC depth and noise texture.
- Changing core domain logic, workspace state schema, share URLs, routing, `vite.config.ts`, or `svelte.config.js`.
- Adding runtime services, server routes, or dependencies other than daisyUI.

## Decisions

**Register daisyUI with restricted base modules and no built-in themes.** Add `daisyui@latest` as a devDependency, keep `.npmrc` with `legacy-peer-deps=true`, and add `@plugin "daisyui" { themes: false; logs: false; exclude: rootcolor, rootscrolllock, rootscrollgutter; }` to `src/app.css`. There is no `include` restriction, so all component families are available. `themes: false` is required because the vendored theme names collide with daisyUI built-in names. `logs: false` is required because the default startup log contains a non-ASCII pictographic character, which the no-emoji rule forbids. The three excluded base modules would set root color scheme and scroll behavior that conflict with the viewport-locked shell. Alternative considered: `themes: all` plus overrides; rejected because it changes theme resolution and would duplicate the vendored definitions.

**Vendored themes remain the only source of design-token values.** Remove duplicate `--color-*`, `--radius-*`, and `--size-*` declarations from `@theme inline`; keep only font aliases and custom variables that are derived from theme tokens. daisyUI component classes read the tokens supplied by the vendored themes, so switching themes changes appearance without code changes. Do not change any value in `src/themes/daisyui.css`. Alternative considered: rewriting the themes as `@plugin "daisyui/theme"` blocks; rejected because it would alter the checked-in theme values and the audit baseline.

**Rename the foreground utility completely.** The custom `@utility text-primary` becomes `@utility text-foreground`, and all uses in sources and tests move with it. No alias is kept, so daisyUI's own `text-primary` keeps its brand-color meaning without ambiguity. `fill-primary` and `stroke-primary` uses are mapped by meaning: brand accents to daisyUI brand utilities, foreground marks to `text-foreground` or the corresponding base-content utility. Alternative considered: keeping a deprecated alias; rejected because it preserves the ambiguity that motivated the rename and would leave stale static assertions.

**Map utilities by meaning, not by name.** Panels, controls, and containers use daisyUI component families such as card, btn, input, select, checkbox, toggle, tabs, dropdown, menu, list, table, badge, alert, tooltip, divider, join, fieldset, and modal. Shape utilities map to `rounded-box`, `rounded-field`, and `rounded-selector`; surface colors map to `bg-base-100` through `bg-base-300`; action and status colors map to brand and `badge-*` / `alert-*` utilities. Pin surfaces follow the existing success, warning, error, info, and neutral meaning using daisyUI status utilities. The IC package SVG bodies keep their own fixed geometry and always-on texture, and `PackageCanvas.svelte` keeps its base-100 surface. Alternative considered: keeping the custom utility layer and adding daisyUI only for new markup; rejected because it leaves two competing systems and does not satisfy the migration scope.

**Apply component classes to the existing workspace structure.** The three-pane landscape grid, portrait dock, single mounts of the peripheral tree, canvas, and summary drawer, and the persisted dock tab stay as they are. Toolbar controls, peripheral tree rows, and the summary drawer gain daisyUI classes on their existing elements; no `drawer-toggle` checkbox or new DOM hierarchy is introduced, so orientation selection remains CSS-only and existing state contracts are untouched. The component classes supply radii, borders, spacing, and status colors from tokens while the grid supplies layout.

**Use the native dialog API for the six modal surfaces.** Each dialog holds an element reference with Svelte 5 `bind:this`, opens with `showModal()`, and closes with `close()`. `onclose` and `oncancel` drive the existing callbacks, backdrop close is detected by comparing the event target with the dialog element, and window-level Escape listeners are removed so handling runs once. The `.modal-box` default `max-h-screen` is overridden with `92dvh` or `100dvh` where needed, and bodies keep their internal `min-h-0` overflow scrolling. All props, callbacks, selection results, and diff payloads remain unchanged. Alternative considered: keeping custom overlay panels and only adding daisyUI classes; rejected because the top-layer, focus handling, and single Escape path are the behavior being migrated.

**Update audit and tests with the migration.** `tools/theme-token-audit.ts` keeps checking that the vendored theme tokens are supplied and that depth and noise remain intentionally inert, but it reclassifies tokens that are now owned by daisyUI components instead of requiring a custom `var()` consumer. `tests/theme-tokens.test.ts` checks the updated token inventory and texture scope. Static tests in `tests/viewport-layout.test.ts`, `tests/compatible-mcu-finder.test.ts`, and any other test with migrated literal strings are updated to assert the new class strings while preserving their original intent: viewport lock, internal scrolling, toolbar fit, dialog height bounds, finder wiring, and texture scope. Add a factual MIT credit for daisyUI to `README.md`.

## Risks / Trade-offs

- **Name collision with daisyUI `text-primary`** -> `themes: false` plus the complete rename to `text-foreground`; the brand utility stays distinct.
- **Visual regression across the four themes** -> keep vendored values unchanged, migrate by semantic meaning, and verify appearance in each theme without density overrides.
- **Native dialog top layer versus the viewport-locked shell** -> bound `.modal-box` height to `92dvh` or `100dvh`, keep internal scrolling, and close only through the dialog API.
- **Duplicate Escape handling** -> remove all window-level Escape listeners from the six dialog surfaces and rely on `onclose` / `oncancel`.
- **Backdrop close firing on inner content** -> compare the event target with the dialog element before closing.
- **Static tests pinned to old strings** -> update literals in the same change and keep each test's behavioral assertion intact.
- **Audit tokens losing custom consumers** -> reclassify daisyUI-owned tokens explicitly rather than inventing synthetic `var()` usage.
- **Log message contains a pictographic character** -> `logs: false` prevents it from reaching the console.
- **Root base modules fight the 100dvh shell** -> exclude rootcolor, rootscrolllock, and rootscrollgutter.

## Migration Plan

1. Add the daisyUI devDependency and plugin configuration; confirm a clean install with `npm ci`.
2. Remove duplicate token declarations and custom shape, border, size, surface, and action utilities; keep the renamed foreground utility and the font aliases.
3. Rename all `text-primary` foreground uses in sources and tests to `text-foreground`; verify no former custom utility reference remains.
4. Adopt daisyUI component classes across landing and workspace markup, including the toolbar, peripheral tree, summary drawer, and dock tabs; leave the two package renderers and overlay mechanics unchanged.
5. Convert the six dialog surfaces to native modal dialogs and remove their duplicate Escape listeners.
6. Update the token audit, token tests, static-string tests, and the README credit line.
7. Run `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`; fix warnings before proceeding.
8. Inspect the built CSS asset under `/pinspec/` for daisyUI component rules and the absence of retired utility definitions, then verify the GitHub Pages bundle path.

Rollback is a single change revert: no generated data, state schema, or upstream reference data is modified, so reverting the change restores the prior stylesheet and markup.

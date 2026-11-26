# Proposal

## Why

The theme picker offers four unrelated daisyUI themes through a dropdown, while the interface only needs a light and a dark appearance. The saved value records a theme id rather than a mode, so a user cannot choose to follow the operating system, and legacy ids continue to influence a theme catalog that no longer ships them.

## What Changes

- Reduce the vendored daisyUI catalog to two `[data-theme]` blocks: `fantasy` for light mode and `halloween` for dark mode. Remove `lofi`, `forest`, and `caramellatte` from the vendored CSS and all code and tests.
- Replace the four-item dropdown with a single button that cycles System -> Light -> Dark -> System. The full form shows a Monitor, Sun, or Moon icon plus the label `System`, `Light`, or `Dark`; the compact toolbar form is icon-only with `title` and `aria-label`.
- Store the mode (`system`, `light`, or `dark`) under the existing `pinspec:theme` localStorage key. Resolve `prefers-color-scheme` only at load and register no live change listener.
- Treat saved theme ids (`lofi`, `forest`, `caramellatte`, `halloween`) and any other unknown value as absent: the application starts in system mode. No migration shim is added. **BREAKING** for users of the old picker, whose saved theme resets to system mode.
- Update the inline no-FOUC bootstrap in `index.html` to derive `fantasy` or `halloween` from the stored mode and the load-time color-scheme value before the application module executes.
- Update static tests that assert four themes and add coverage for the cycle order, legacy reset, one-time resolution, localStorage-only persistence, and bootstrap parity. Theme remains a UI preference and never enters share URLs or project files.

## Capabilities

### New Capabilities

- `theme-mode-toggle`: Appearance modes and the single cycling control, covering the two-theme catalog, the three-mode cycle, load-time system resolution, legacy value reset, localStorage-only persistence, no-FOUC bootstrap, and control labeling.

### Modified Capabilities

None.

## Impact

- Files: `src/themes/daisyui.css`, `src/app.css`, `src/state/theme.svelte.ts`, `src/components/ThemePicker.svelte`, and `index.html`. Wiring in `src/pages/LandingPage.svelte` and `src/components/workspace/TopToolbar.svelte` stays unchanged.
- Tests: `tests/ui-multi-vendor.test.ts`, `tests/viewport-layout.test.ts`, and `tests/theme-tokens.test.ts` (which must still report 28 declared tokens), plus a new focused theme-mode test.
- No new dependency; icons come from the already installed `lucide-svelte`. No core solver, exporter, share URL, project JSON, or generated catalog changes. No backend and no STM32 behavior change.
- The `daisyui-component-adoption` and `theme-token-integration` main specs retain older wording about four vendored themes and the former picker. The new capability is authoritative for the two-theme mode contract; `design.md` records the supersession and the affected static assertions are updated in this change.

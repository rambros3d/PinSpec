# Tasks

## 1. Vendored theme catalog

- [x] 1.1 Replace the four `[data-theme]` blocks in `src/themes/daisyui.css` with `fantasy` (upstream full token set wrapped in a selector, with the existing MIT attribution comment) and `halloween` (retained); verify the file contains exactly those two selectors and no `lofi`, `forest`, or `caramellatte` selector.
- [x] 1.2 Keep all tokens declared in both retained blocks, including `color-scheme`, radius, size, border, `--depth`, and `--noise`, with depth and noise left inert in the app; verify `npx vitest run tests/theme-tokens.test.ts` passes with the 28-declared-token assertion and no raw color or emoji offender.
- [x] 1.3 Update the four-theme comment in `src/app.css` to name the two vendored blocks; verify no stale four-theme wording remains in CSS source.

## 2. Theme mode state

- [x] 2.1 Replace the `ThemeId`-based state in `src/state/theme.svelte.ts` with an exported `ThemeMode` (`system` | `light` | `dark`), the `system -> light -> dark -> system` cycle, and a resolved theme id of `fantasy` or `halloween`; export a `ThemeStore` class and the storage key for tests while keeping the `themeStore` singleton; verify `npm run check` passes under strict TypeScript.
- [x] 2.2 Resolve `prefers-color-scheme` only at initialization without a change listener, ignore every stored value outside the three mode values, use light as the baseline when no preference exists, and keep the `pinspec:theme` key; verify a new `tests/theme-mode-toggle.test.ts` with a stubbed `window` covers cycle order, legacy reset for `lofi`/`forest`/`caramellatte`/`halloween`, unknown values, absent preference, no listener registration, and storage failure.
- [x] 2.3 Confirm no theme mode or theme id is read or written by `src/core/url-state.ts`, `src/core/exporters/json.ts`, or any other exporter; verify a test asserts share URLs and project JSON contain no theme field and import leaves localStorage unchanged.

## 3. No-FOUC bootstrap

- [x] 3.1 Change `index.html` to `data-theme="fantasy"` and replace the inline script with mode-based resolution that accepts only `system`, `light`, or `dark`, ignores unknown values, and sets `fantasy` or `halloween` before the module script; verify a static test covers cold light, stored light, stored dark, stored system, absent preference, and legacy id cases and asserts parity with store resolution.

## 4. Theme control button

- [x] 4.1 Convert `src/components/ThemePicker.svelte` into a single cycling button using `Monitor`, `Sun`, and `Moon` from `lucide-svelte`, with `System`, `Light`, and `Dark` labels in the full variant and an icon-only compact variant carrying `title` and `aria-label`; remove dropdown, outside-pointer, Escape, and `Check` menu code; verify no `dropdown`, `menu`, or `aria-expanded` remains in the component.
- [x] 4.2 Keep the import sites in `src/pages/LandingPage.svelte` and `src/components/workspace/TopToolbar.svelte` and the `compact` prop unchanged; verify `npm run check` passes and a static test asserts the compact call site stays `compact={true}`.

## 5. Static contracts and test updates

- [x] 5.1 Replace the four-theme assertions in `tests/ui-multi-vendor.test.ts` and `tests/viewport-layout.test.ts` with assertions for exactly `fantasy` and `halloween` plus explicit absence of the removed names; verify both test files pass.
- [x] 5.2 Add coverage for the three-mode cycle, one-time resolution, legacy reset, localStorage-only persistence, bootstrap parity, and control labeling; verify `npm test` passes with no theme-related failures.

## 6. Full verification

- [x] 6.1 Run `npm test` and verify all suites pass.
- [x] 6.2 Run `npm run check` and verify zero TypeScript errors under strict mode.
- [x] 6.3 Run `BASE_PATH="/pinspec/" npm run build` and verify zero Svelte warnings and a built CSS asset containing only the two vendored theme selectors.
- [x] 6.4 Confirm no new dependency entry and no generated or cached artifact was added; verify `git status --short` lists only intended source, test, and planning files.

## Workflow follow-up

- After all tasks pass, run `openspec archive theme-mode-toggle -y` and include the archived spec and change artifacts in the implementation commit.
- Verify the archived `openspec/specs/theme-mode-toggle/spec.md` contains the two-theme, three-mode, one-time resolution, legacy reset, localStorage-only, bootstrap, and labeling requirements.

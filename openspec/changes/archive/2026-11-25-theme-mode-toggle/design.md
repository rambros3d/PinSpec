# Design

## Context

See `proposal.md` for motivation. The current implementation has four vendored `[data-theme]` blocks in `src/themes/daisyui.css` (`lofi`, `forest`, `caramellatte`, `halloween`), a `ThemeId` union of those four names in `src/state/theme.svelte.ts`, and a four-item dropdown in `src/components/ThemePicker.svelte`. `index.html` carries `data-theme="forest"` plus an inline script that maps stored `dark` and `light` strings onto two of the theme ids. Two static tests assert the four-theme catalog. `tools/theme-token-audit.ts` reports 28 declared custom-property tokens from the vendored file; `tests/theme-tokens.test.ts` pins that count and keeps raw colors inside the vendored file.

Constraints from `AGENTS.md`: theme is a UI preference stored only in `localStorage`, no share URL or project JSON field; no raw color literals outside the vendored theme file; zero emojis; `src/core/` stays DOM-free; strict TypeScript; no new backend or server-side behavior; subpath builds must use the configured base path.

## Goals / Non-Goals

**Goals:**

- Represent the user choice as a mode (`system`, `light`, `dark`) rather than a theme id, and derive the applied theme from that mode once at load.
- Ship only `fantasy` (light) and `halloween` (dark) while preserving the full token set and the existing pin-color semantics.
- Replace the dropdown with one deterministic cycling button in both full and compact forms.
- Keep bootstrap and store resolution consistent so no flash of the wrong theme occurs.
- Keep the token audit, static source scans, and verification gates green.

**Non-Goals:**

- No migration or compatibility path for previously saved theme ids.
- No live OS color-scheme listener or mid-session theme reaction.
- No change to pin status colors, package texture, solver, exporters, share URL schema, project JSON schema, or generated catalog data.
- No new dependency and no change to the `pinspec:theme` storage key.

## Decisions

1. **Store the mode, derive the theme id.** The state module uses `ThemeMode = 'system' | 'light' | 'dark'` with a mapping to `fantasy` or `halloween`. A persisted theme id cannot express "follow the system", so a mode value is required. Alternative: keep storing a theme id and add a boolean for system mode; rejected because it adds a second field and a new persistent contract. The exported `ThemeStore` class mirrors `WorkspacePreferencesStore` so tests can stub `window` and create fresh instances with `vi.resetModules()`; the app keeps one `themeStore` singleton.

2. **Cycle with one button.** A single `onclick` advances the mode in fixed order System -> Light -> Dark -> System and persists the result. Alternative: keep the dropdown with three entries; rejected by product decision because it retains open-state, outside-pointer, and Escape handling for a three-value choice. The existing `ThemePicker.svelte` filename and `compact` prop are kept so both mount sites stay unchanged.

3. **Resolve the OS preference once.** `prefers-color-scheme` is read during the inline bootstrap and again during store initialization; neither path registers a `matchMedia` listener, and neither re-reads during the session. Alternative: subscribe to scheme changes; rejected by product decision because it introduces live behavior that would diverge from the persisted mode. With no stored mode and no preference, light (`fantasy`) is the baseline default.

4. **Ignore legacy values outright.** Any stored value outside the three mode values falls back to system mode. No mapping from `lofi`, `forest`, `caramellatte`, or `halloween` to a retained theme is kept. Alternative: translate legacy ids to `fantasy` or `halloween`; rejected by product decision. This is an intentional breaking change for saved preferences and requires no version bump because theme is not part of the shared pin-configuration schema.

5. **Two vendored blocks with full tokens.** `fantasy` is wrapped from the upstream CSS in a `[data-theme="fantasy"]` selector with the existing MIT attribution comment; `halloween` is retained. The remaining two blocks declare the full 20-color token set plus radius, size, border, `color-scheme`, `--depth`, and `--noise`, so the audit still counts 28 distinct tokens. `--depth` and `--noise` stay inert in the app, and no component depth or noise effect is introduced. Alternative: keep four blocks and hide two from the picker; rejected because it leaves unused raw colors in the bundle and contradicts the single light/dark contract.

6. **Bootstrap mirrors the store without importing it.** `index.html` sets `data-theme="fantasy"` on the root element and an inline script resolves the stored mode plus the load-time OS preference before the module script executes. Because the module executes later, the bootstrap cannot import the store; parity is enforced by test scenarios that exercise both paths with the same inputs. Alternative: render the attribute from JavaScript after boot; rejected because it causes a flash of the default theme.

7. **Icon and label follow the mode.** The full button uses `Monitor`, `Sun`, and `Moon` from `lucide-svelte` with `System`, `Light`, and `Dark` labels. The compact button renders the icon only and carries `title` and `aria-label` naming the current mode. No menu, dropdown, `aria-expanded`, outside-pointer handler, or Escape handler remains.

8. **Tests track static contracts.** The two existing four-theme assertions become two-theme assertions with explicit absence checks for removed names. New tests use a stubbed `window` and fresh module instances to cover cycle order, legacy reset, absent preference, no listener registration, storage failure, and persistence; static tests cover bootstrap parity and button markup. `tests/theme-tokens.test.ts` stays at 28 declared tokens.

9. **Existing spec wording is superseded, not forked.** `daisyui-component-adoption` says four vendored themes stay byte-for-byte unchanged, and `theme-token-integration` uses generic theme-switch wording. The product decision reduces the catalog and replaces one block, so the new `theme-mode-toggle` capability is authoritative for appearance modes. This change declares no modified capability, per scope; the divergence is recorded here and enforced by the updated static tests.

## Risks / Trade-offs

- [Two resolution sites can drift] -> Mitigation: both paths use the same mode values and mapping; static tests assert bootstrap and store parity for light, dark, system, no-preference, and legacy inputs.
- [Legacy users see an unexpected theme change] -> Mitigation: this is an accepted breaking change; the saved value is ignored and system mode is applied, with no silent translation.
- [Token audit could drop below 28 declared tokens] -> Mitigation: copy the full upstream `fantasy` token set and keep `halloween` intact; `tests/theme-tokens.test.ts` pins the count.
- [Removing themes breaks static assertions outside the known two tests] -> Mitigation: grep the full test and source tree for removed theme names and update every reference in the same task group.
- [Compact button could lose accessibility] -> Mitigation: retain `title` and `aria-label` in the icon-only variant and assert them in a static test.
- [Storage errors could break startup] -> Mitigation: keep read and write wrapped in `try`/`catch` with a resolved in-memory fallback, as in the current store and view-preferences store.

## Migration Plan

No data migration is performed. Replace the vendored CSS, the state module, the control component, and the bootstrap script, then update the affected tests and run the full verification sequence. Rollback is a straight revert of the change; previously saved values are not restored by the application. No deployment-specific step is needed because the site remains a static subpath build.

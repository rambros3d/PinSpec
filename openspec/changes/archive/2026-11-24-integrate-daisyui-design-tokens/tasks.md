# Tasks

## 1. Semantic token utilities

- [x] 1.1 Add token-backed radius utilities (`rounded-panel`, `rounded-control`, `rounded-pill`, `rounded-mark`, `rounded-top-control`), border utilities (`border-ui`, side variants, `border-ui-strong`), control/glyph sizing utilities (`size-ui-*` and `size-selector-dot`), and secondary/accent/`*-content` color utilities to `src/app.css`; verify each utility resolves through `var(--radius-*)`, `var(--border)`, `var(--size-*)`, or a daisyUI color token and that `npm run check` passes.

## 2. Mechanical class replacement

- [x] 2.1 Replace hardcoded radius classes in `src/components/**`, `src/pages/**`, and `src/app.css` with the semantic radius utilities by intent (panel/control/pill/mark/tab); verify a grep for `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`, `rounded-xs`, `rounded-t` returns no matches outside the new utility names.
- [x] 2.2 Replace bare and side border-width classes (`border`, `border-2`, `border-t`, `border-b`, `border-l`, `border-r`, `border-x`, `border-y`) with `border-ui*` utilities while keeping every `border-hairline`, `border-hint`, `border-*`, and `divide-*` color utility unchanged; verify a grep shows no bare border-width classes remain and `border-hairline` counts are unchanged.
- [x] 2.3 Replace complete `w-N h-N` icon/glyph size pairs with `size-ui-*` / `size-selector-dot` utilities without touching container dimensions; verify computed sizes match the original classes under all four themes and `npm run check` passes.

## 3. Color token consumers

- [x] 3.1 Wire secondary and accent tokens into distinct non-pin UI accents via semantic utilities and apply them to real surfaces (badges, section accents, or selection marks) without changing `--pin-*` mappings; verify no pin renderer references the new accent utilities.
- [x] 3.2 Apply `text-on-success`, `text-on-warning`, and `text-on-error` to status badges/diagnostic pills so the corresponding `--color-*-content` tokens are consumed; verify the usage audit reports all previously unused color tokens as referenced.

## 4. IC texture and warning-free renderers

- [x] 4.1 Keep the depth gradient and noise filter rects unconditional in `GridPackage.svelte` and `PerimeterPackage.svelte`, with no `--depth`/`--noise` gating and no new texture in other components; verify a source scan finds the effects only in those two files and `PackageCanvas.svelte` still uses `bg-mcu-canvas`.
- [x] 4.2 Replace the reactive `chip.id` read in each renderer's `surfaceId` initializer with a module-scoped counter helper producing unique ids per instance; verify `BASE_PATH="/pincraft/" npm run build` emits zero `state_referenced_locally` or other Svelte warnings.

## 5. Token audit tooling

- [x] 5.1 Add `tools/theme-token-audit.ts` that extracts token names from `src/themes/daisyui.css`, counts `var(--token)` references outside that file, prints usage, and exits non-zero when a previously unused token besides the intentionally inert `--depth`/`--noise` flags is still unreferenced; verify `npx tsx tools/theme-token-audit.ts` reports zero actionable unused tokens and lists the two inert flags explicitly.
- [x] 5.2 Add a Vitest case covering the audit helper and a source hygiene check for color literals/emoji; verify `npm test` passes with the new case included.

## 6. Integration verification

- [x] 6.1 Run color-literal and emoji scans plus the token audit; verify color literals appear only in `src/themes/daisyui.css`, no emojis exist in delivered source, and all 11 actionable previously unused tokens are referenced while `--depth`/`--noise` remain intentionally inert.
- [x] 6.2 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build`; verify all pass with zero warnings and record outputs for the change report.

## Workflow follow-up

- Validate the change with `openspec validate integrate-daisyui-design-tokens --strict` before implementation is considered complete.
- Archive the change with `openspec archive integrate-daisyui-design-tokens -y`, then run `openspec validate --all --strict`, `openspec list --specs`, and `openspec list`.
- Commit the implementation, audit tooling, tasks state, and archived specs with message `feat(theme): integrate daisyUI design tokens across the app`; do not push.

# Design

## Context

See `proposal.md` for motivation. `src/themes/daisyui.css` is the only file allowed to hold raw color literals and defines 28 tokens per theme; `src/app.css` already maps most color tokens to Tailwind utilities through `@theme inline` and custom `@utility` rules. Components still use Tailwind's default radius and border-width scales, so theme switches leave much of the UI unchanged. The two package renderers already draw an always-on depth gradient and noise filter on the IC body, but compute `surfaceId` from the reactive `chip` prop at initialization, producing a `state_referenced_locally` warning on every build.

## Goals / Non-Goals

**Goals:**

- Route radii, border widths, and icon/glyph sizes through daisyUI token-backed utilities without visual drift under the current themes.
- Give secondary, accent, and `*-content` tokens real non-pin UI consumers, including status pills.
- Keep IC texture exactly where it is and remove the two Svelte warnings.
- Provide an auditable token-usage check and keep the build warning-free.

**Non-Goals:**

- Changing pin status color semantics, package rendering geometry, routing, exporters, data generation, or any layout structure.
- Editing `src/themes/daisyui.css`, `.cache/`, generated data, or adding dependencies/backends.
- Backwards-compatibility with legacy share-link versions.

## Decisions

1. **Semantic utilities in `src/app.css`, not global element selectors.** Tailwind v4 `@utility` rules keep class-based composition and tree-shake cleanly. `rounded-panel` maps to `--radius-box`, `rounded-control` to `--radius-field`, `rounded-pill` to `--radius-selector`, `rounded-mark` to `min(--radius-field, 0.125rem)` for tiny swatches, and `rounded-top-control` to the field radius for tab tops. Border utilities `border-ui`, side variants, and `border-ui-strong` map to `--border` and its double. Alternatives: rewrite tailwind theme variables (would change unrelated Tailwind defaults) or inline `var()` in every component (unreviewable duplication).

2. **Control/glyph sizing derives from the size tokens.** `size-ui-xs/sm/md/lg` and `size-selector-dot` resolve to the same pixel sizes as the replaced `w-/h-` pairs under the current themes (`--size-field` and `--size-selector` are 0.25rem in all four). They are applied only to complete `w-N h-N` icon or glyph pairs, never to container-only dimensions, so layout is unchanged. Alternative: leave sizing utilities unused and reference tokens in CSS comments only, which would not make themes affect controls.

3. **Color aliases stay separate from pin tokens.** Add `@utility` rules such as `text-brand-secondary`, `bg-brand-accent-soft`, `text-on-secondary`, `text-on-accent`, `text-on-success`, `text-on-warning`, `text-on-error`. Pin colors remain bound to `--pin-*`; status badges consume `*-content` only for foreground text. Alternative: redefining `--color-success` as a pin color would break the existing token contract.

4. **Texture stays hardcoded to the package renderers.** The existing gradient/filter rects in `GridPackage.svelte` and `PerimeterPackage.svelte` remain unconditional; no `--depth`/`--noise` read is introduced. `PackageCanvas.svelte` keeps `bg-mcu-canvas` and gains only semantic radius/border/size classes.

5. **Module-scoped ID counter.** Each renderer gets a `<script module>` counter and a `nextSurfaceId()` helper returning a monotonic `ic-grid-N` / `ic-perimeter-N` id. Instance code calls it once, so no reactive prop is read during initialization and IDs stay unique per instance. Alternative: `$derived.by` would re-generate IDs when the chip changes, invalidating existing SVG references mid-render.

6. **Audit script plus unit test.** `tools/theme-token-audit.ts` parses token declarations from `src/themes/daisyui.css`, counts `var()` references outside it, reports previously unused tokens, and fails if any actionable token is still unreferenced. `--depth` and `--noise` are explicitly allow-listed as inert: the package texture must not depend on them and no other effect may consume them. A Vitest case imports the same helper so `npm test` guards the contract. Alternative: ad-hoc grep only, which is not reproducible in CI.

## Risks / Trade-offs

- [Token values differ across themes] → map radii by intent (panel/field/pill) rather than by current pixel equality; accept that e.g. `rounded-lg` and `rounded-xl` both become `rounded-panel`.
- [Mechanical class replacement could alter layout] → restrict changes to radius/border-width tokens and complete `w-N h-N` pairs; preserve all color classes, flex/grid/padding/margin utilities, and DOM structure; verify with build output and visual token values unchanged under current themes.
- [Counter-based IDs could collide across SSR] → app is static client-only (no SSR); IDs are unique within the document.
- [Audit false positives from token names in comments] → scan only `var(--token)` references in source outside the theme file and ignore the audit script's own declaration list.

## Migration Plan

No data or route migration. Rollback is a single revert commit: no generated artifacts or external state are touched.

## Open Questions

None.

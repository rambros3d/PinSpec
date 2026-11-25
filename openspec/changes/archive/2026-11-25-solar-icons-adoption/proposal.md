# Proposal

## Why

The UI currently imports icons from `lucide-svelte` across 21 files. The change
request is to standardize on one icon set: Solar Icons in bold duotone style
from `@solar-icons/svelte`. Mixing icon libraries produces inconsistent stroke
weight and duotone treatment, and keeping an unused icon dependency adds a
second source of icon names to maintain.

## What Changes

- **BREAKING (build-time only):** replace `lucide-svelte` with
  `@solar-icons/svelte` in `package.json` and `package-lock.json`. No runtime
  API, share-link schema, project-file schema, or generated catalog changes.
- Replace all 49 distinct Lucide icons imported by 21 source files with verified
  `@solar-icons/svelte/bold-duotone/<slug>` default imports. No `lucide-svelte`
  import remains in `src/`, and no icon from a different style or library is
  introduced.
- Preserve icon sizes, accessible names (`title`, `aria-label`), hover tooltips,
  and click behavior. Component markup keeps its existing local names through
  aliases where that avoids unrelated churn.
- Drive icon color from theme tokens: the primary layer inherits `currentColor`
  from existing text utilities, and the duotone secondary layer resolves through
  a CSS custom property assigned from an existing daisyUI token. No raw color
  literal is added outside `src/themes/daisyui.css`.
- Leave the inline SVG logo and favicon (`public/radiokit-logo.svg`,
  `index.html`) and the `PerimeterPackage.svelte` / `GridPackage.svelte` SVG
  geometry, labels, and texture filters unchanged.
- Add a factual attribution line to the README: Solar Icons code is MIT; the
  original icons are CC BY 4.0 by 480 Design.
- Update static source-scanning tests deliberately so they assert behavior and
  provenance rather than a retired icon library name, and add a check for the
  icon import boundary and the attribution line.
- Verify with `npm test`, `npm run check`, and
  `BASE_PATH="/pincraft/" npm run build`, then archive this change.

## Capabilities

### New Capabilities

- `solar-icons-adoption`: Owns the icon library boundary, the verified bold
  duotone icon mapping, size and accessibility preservation, theme-token based
  duotone color, exclusions for inline SVG assets and package renderers,
  attribution, and verification of the icon replacement.

### Modified Capabilities

- `theme-token-integration`: The static UI cleanliness contract gains an icon
  color rule: duotone secondary color must resolve from a theme token and no
  raw color literal may enter component files.
- `workspace-qol`: The keyboard focus and icon tint contract changes from a
  single decorative tint to theme-token derived duotone layers, while focus
  indicators and accessible names stay unchanged.
- `global-app-shell`: Shell surfaces stop promising monochrome icons and zero
  new npm dependencies; they use bold duotone icons and exactly one new icon
  dependency while retaining theme-token colors.
- `multi-vendor-workspace`: The legibility contract across themes and zooms
  covers the new duotone icons on workspace surfaces and explicitly excludes
  changes to package renderer geometry, labels, and textures.

## Impact

- 21 Svelte files under `src/components/` and `src/pages/` change their icon
  imports and, where needed, their local aliases and size props.
- `package.json` and `package-lock.json` swap `lucide-svelte` for
  `@solar-icons/svelte`; `npm install` runs during implementation.
- `src/app.css` may gain a scoped CSS custom property for the duotone secondary
  color; all color values continue to resolve through existing tokens.
- `README.md` gains one attribution line. Static tests that scan UI source are
  updated to the new import path and to preserve behavior assertions.
- No change to `src/core/`, hash routes, workspace state, share URLs, project
  JSON, data generation, GitHub Pages deployment, STM32 behavior, or generated
  output.

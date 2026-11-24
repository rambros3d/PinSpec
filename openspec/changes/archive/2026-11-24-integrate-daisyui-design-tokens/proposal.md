# Proposal

## Why

The vendored daisyUI theme blocks in `src/themes/daisyui.css` define 28 design tokens, but most of the app still hardcodes Tailwind radius and border-width classes, and 13 tokens (secondary/accent colors, `*-content` colors, shape/size radii and sizes, depth/noise) have no consumer. As a result, switching themes changes only part of the interface, and the recent IC texture work emits two Svelte warnings on every build.

## What Changes

- Add semantic CSS utilities in `src/app.css` backed by `--radius-box`, `--radius-field`, `--radius-selector`, `--border`, `--size-field`, and `--size-selector`, then replace hardcoded radius and border-width classes in components, pages, and `app.css` mechanically while preserving layout and color semantics.
- Wire the previously unused color tokens through semantic aliases/utilities: secondary and accent for non-pin UI accents, and `*-content` tokens for readable foregrounds on status badges and diagnostic pills. Pin status colors (`--pin-*`) and their success/warning/error/info mapping stay unchanged.
- Keep the depth gradient and noise filter ALWAYS active on the IC package body in `PerimeterPackage.svelte` and `GridPackage.svelte` only. They must not be gated by `--depth`/`--noise`, and no other UI may gain those effects. `PackageCanvas.svelte` keeps its `bg-mcu-canvas` (base-100) surface.
- Remove the two `state_referenced_locally` warnings by generating unique SVG filter/clip IDs with a module-scoped counter (no reactive `chip` read at initialization).
- Preserve zero raw color literals outside `src/themes/daisyui.css`, zero emojis, and strict TypeScript with zero Svelte warnings.

## Capabilities

### New Capabilities

- `theme-token-integration`: UI elements outside the MCU pin viewer consume daisyUI shape, size, and color tokens through semantic utilities; the IC package body owns the only always-on depth/noise texture.

### Modified Capabilities

None. Existing workspace behavior, pin colors, and export/data contracts are unchanged; this change adds a UI-level capability rather than changing existing requirements.

## Impact

- `src/app.css`: new semantic radius/border/size utilities and color aliases.
- `src/components/**`, `src/pages/**`: class replacements only, no DOM/layout restructuring.
- `src/components/workspace/{GridPackage,PerimeterPackage}.svelte`: texture scoping and warning-free SVG ID generation.
- Verification: color-literal and token-usage scans, `npm test`, `npm run check`, `BASE_PATH="/pincraft/" npm run build` with zero Svelte warnings, and OpenSpec archive/validation.

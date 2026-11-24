# theme-token-integration Specification

## Purpose

Defines how the PinCraft UI consumes vendored daisyUI design tokens so theme switches affect the whole app, while the MCU IC package keeps its dedicated always-on texture and pin status colors keep their fixed semantic mapping.

## Requirements

### Requirement: Non-package UI consumes shape and size tokens

Application surfaces outside the two IC package renderers SHALL obtain corner radii, border widths, and control sizes from daisyUI theme tokens through semantic utilities in `src/app.css`. Hardcoded Tailwind radius classes (`rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`) and bare border-width classes (`border`, `border-2`) SHALL NOT appear in `src/app.css`, `src/components/**`, or `src/pages/**`.

#### Scenario: Theme switch changes panel geometry

- **WHEN** a user switches between two daisyUI themes whose `--radius-box` and `--radius-field` values differ
- **THEN** panels and controls outside the package renderers adopt the new token-derived radii without code changes

#### Scenario: Radius and border scan

- **WHEN** a scan of `src/app.css`, `src/components/**`, and `src/pages/**` looks for hardcoded radius or bare border-width classes
- **THEN** only semantic token utilities remain and color utilities such as `border-hairline` keep their existing meaning

### Requirement: Previously unused color tokens have UI consumers

Secondary, accent, and the `*-content` color tokens from `src/themes/daisyui.css` SHALL be consumed by real non-pin UI surfaces through semantic aliases. Status badges and diagnostic pills SHALL use the corresponding content tokens as foregrounds. The `--pin-*` tokens SHALL keep their existing success/warning/error/info mapping and SHALL NOT be repurposed.

#### Scenario: Status badge foreground follows theme

- **WHEN** a success, warning, or error status pill is rendered in any theme
- **THEN** its foreground resolves through the matching `--color-*-content` token and remains readable

#### Scenario: Pin status colors are unchanged

- **WHEN** an assigned, partial, conflict, or remap pin is rendered before and after this change
- **THEN** its pin color resolves to the same `--pin-*` token and semantic state as before

### Requirement: IC texture is always on and scoped to package bodies

The depth gradient and noise filter SHALL be always active on the IC package body in `PerimeterPackage.svelte` and `GridPackage.svelte` regardless of `--depth` and `--noise` theme values. Those tokens SHALL NOT gate, disable, or alter the effect. No other component or stylesheet SHALL add a depth gradient or noise filter, and `PackageCanvas.svelte` SHALL keep its `bg-mcu-canvas` base-100 surface.

#### Scenario: Texture survives a flat theme

- **WHEN** the active theme defines `--depth: 0` and `--noise: 0`
- **THEN** the IC package body still renders the depth gradient and noise filter

#### Scenario: Texture scope check

- **WHEN** the source tree is scanned for depth/noise filters and gradients
- **THEN** matches exist only inside the two package renderers and `PackageCanvas.svelte` continues to use `bg-mcu-canvas`

### Requirement: Package renderers build warning-free unique SVG IDs

Package renderers SHALL generate unique SVG filter and clip-path IDs per instance without reading reactive props during initialization, and the production build SHALL emit zero Svelte warnings.

#### Scenario: Multiple package instances

- **WHEN** two chip packages are rendered at once, including after the selected chip changes
- **THEN** each SVG defs block has distinct filter and clip IDs and no `state_referenced_locally` warning is emitted

### Requirement: Token integration keeps the static UI clean

Delivered UI source SHALL contain no raw color literals outside `src/themes/daisyui.css` and no emoji characters, and all type checks, unit tests, and the subpath production build SHALL pass with zero warnings.

#### Scenario: Source hygiene scan

- **WHEN** the repository source files are scanned for hex/rgb/oklch color literals and emoji code points
- **THEN** color literals occur only in `src/themes/daisyui.css` and no emoji is found

#### Scenario: Verification sequence

- **WHEN** `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` are run
- **THEN** all three commands exit zero and the build reports no Svelte warnings

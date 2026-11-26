# Spec Delta

## Purpose

Defines the project-wide icon contract: which package and style supply UI
icons, how their sizes and colors behave, what stays outside the replacement,
and how the change is verified and credited.

## ADDED Requirements

### Requirement: UI icons come from one bold duotone package

Every icon used in application UI SHALL be imported from
`@solar-icons/svelte` through its per-icon `bold-duotone` path. The
`lucide-svelte` dependency and every `lucide-svelte` import in `src/` SHALL be
removed. No other icon library and no other Solar style SHALL be introduced for
application UI icons.

#### Scenario: Source import scan

- **WHEN** all `.svelte` and `.ts` files under `src/` are scanned for icon imports
- **THEN** no `lucide-svelte` import remains and every UI icon import resolves to a `@solar-icons/svelte/bold-duotone/<slug>` module

#### Scenario: Dependency manifest scan

- **WHEN** `package.json` and `package-lock.json` are inspected after installation
- **THEN** `@solar-icons/svelte` is present and `lucide-svelte` is absent

### Requirement: Icon replacement covers every imported glyph

Each icon previously imported from `lucide-svelte` SHALL have a corresponding
Solar bold duotone slug verified against the installed package or its published
catalogue before use. Guessed or unverified slugs SHALL NOT be introduced. The
replacement SHALL cover all 21 files that currently import icons and all 49
distinct glyph names in those imports.

#### Scenario: Mapping completeness

- **WHEN** the 21 source files are compared with the icon mapping table
- **THEN** every imported glyph name has one documented Solar slug and no source file retains an unmapped icon

#### Scenario: Slug verification

- **WHEN** an icon import is added or changed during implementation
- **THEN** its slug is confirmed to exist in the installed `@solar-icons/svelte` bold duotone exports before the file is considered complete

### Requirement: Icon sizing and interaction behavior are preserved

Replacing a glyph SHALL NOT change its rendered size, its position in the
layout, its accessible label or title, or the behavior of the control that
contains it. Existing `size-*` utility classes or an equivalent numeric `size`
prop SHALL keep each icon at its prior dimensions. Icons selected at runtime,
including the theme-mode and sidebar section icons, SHALL continue to resolve
from the same state or section data as before.

#### Scenario: Accessible controls keep their names

- **WHEN** a button with an icon-only label is rendered before and after the replacement
- **THEN** its `title` and `aria-label` text is unchanged and the icon does not introduce a conflicting accessible name

#### Scenario: Dynamic icons keep their selection logic

- **WHEN** the theme mode changes or a sidebar section becomes active
- **THEN** the icon shown is the mapped replacement for the same mode or section and the control behavior is unchanged

#### Scenario: Icon dimensions stay stable

- **WHEN** an affected control is rendered at its supported breakpoints
- **THEN** the icon occupies the same dimensions as before through a retained `size-*` class or an equivalent `size` prop

### Requirement: Icon colors resolve from theme tokens

The primary layer of each icon SHALL inherit `currentColor` from the parent
text utility so status colors such as info, success, warning, and error keep
their meaning. The duotone secondary layer SHALL resolve from an existing
daisyUI theme token through the package CSS custom property, with the chosen
token documented in `design.md`. No raw color literal SHALL be introduced
outside `src/themes/daisyui.css`.

#### Scenario: Theme switch updates icon layers

- **WHEN** the user switches between the light and dark themes
- **THEN** icon primary layers follow their surrounding text color and secondary layers follow the documented theme token without a hardcoded value

#### Scenario: Status icons keep their meaning

- **WHEN** a success, warning, info, or error icon is rendered
- **THEN** its primary color matches the status utility on its parent and the secondary layer remains token-derived

#### Scenario: Raw color scan

- **WHEN** delivered source outside `src/themes/daisyui.css` is scanned for hex, rgb, hsl, and oklch literals
- **THEN** no such literal is found in icon markup or icon styles

### Requirement: Inline SVG assets and package renderers are excluded

The inline brand logo and favicon at `public/radiokit-logo.svg` SHALL remain
unchanged. The `PerimeterPackage.svelte` and `GridPackage.svelte` renderers,
including their pin geometry, text placement, and texture filters, SHALL NOT be
converted to icon components or altered by this change.

#### Scenario: Brand asset stays as-is

- **WHEN** the brand asset is inspected after implementation
- **THEN** it is still an inline SVG and its contents are unchanged

#### Scenario: Package renderer stays as-is

- **WHEN** the two package renderer files are compared with their pre-change state
- **THEN** no geometry, label, or texture code has been changed to accommodate the icon replacement

### Requirement: Documentation credits the icon sources

The README SHALL include a factual attribution line stating that Solar Icons
code is MIT licensed and that the original icons are CC BY 4.0 by 480 Design.
The credit SHALL contain no promotional wording and no emoji.

#### Scenario: README attribution scan

- **WHEN** the README attribution section is read
- **THEN** it states the code license, the icon license, and the 480 Design credit in one line

### Requirement: Verification and static tests cover the replacement

Static tests that scan UI source SHALL be updated to assert preserved behavior
and the new import contract rather than a retired library name. `npm test`,
`npm run check`, and `BASE_PATH="/pinspec/" npm run build` SHALL pass with zero
warnings, and the implementation agent SHALL archive the change after all tasks
pass.

#### Scenario: Full verification sequence

- **WHEN** the three verification commands are run after implementation
- **THEN** each exits zero, the build resolves assets under `/pinspec/`, and no Svelte warning is emitted

#### Scenario: Static test assertions are current

- **WHEN** the affected static test files are run
- **THEN** they assert Solar import provenance and unchanged behavior without requiring a specific retired icon component name

#### Scenario: Change closeout

- **WHEN** all tasks and verification checks pass
- **THEN** the implementation agent archives the change and includes archived artifacts in the implementation commit

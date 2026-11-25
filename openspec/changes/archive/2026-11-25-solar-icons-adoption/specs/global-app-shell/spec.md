# Spec Delta

## MODIFIED Requirements

### Requirement: Shell surfaces meet source and verification constraints

Shell surfaces SHALL use existing theme tokens and bold duotone vector icons, SHALL add no npm dependency other than the single icon package, SHALL contain no emoji, and SHALL keep raw color literals in the vendored theme file. Catalog and projects thumbnails SHALL be static inline SVG with no interaction handler, no raw color literal, and no texture primitive. `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` SHALL exit zero with no build warnings.

#### Scenario: Theme tokens cover the shell

- **WHEN** the user changes theme while the shell is expanded
- **THEN** the sidebar, catalog, projects, and About surfaces use the active theme tokens and remain readable

#### Scenario: Verification sequence passes

- **WHEN** the three verification commands are run after implementation
- **THEN** all three exit zero and the build resolves assets under `/pincraft/` without root-absolute data or asset paths

#### Scenario: No new raw colors or emoji

- **WHEN** changed source files are scanned
- **THEN** no color literal appears outside `src/themes/daisyui.css` and no emoji character appears

#### Scenario: Texture effects stay in the two package renderers

- **WHEN** all Svelte sources are scanned for texture primitives
- **THEN** only `PerimeterPackage.svelte` and `GridPackage.svelte` contain `feTurbulence` and no thumbnail component adds one

#### Scenario: Shell icons use the single icon package

- **WHEN** shell and route source files are scanned for icon imports
- **THEN** every icon comes from the single bold duotone package and no retired icon library import remains

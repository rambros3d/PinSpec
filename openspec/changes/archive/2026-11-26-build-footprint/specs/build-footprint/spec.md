# Spec Delta

## ADDED Requirements

### Requirement: Vendor code is split into stable chunks

The production build SHALL place the Svelte runtime, Solar icon modules, and
`fflate` in dedicated chunks keyed by their package paths, with application code
in its own chunk. Runtime fetches SHALL continue to resolve through
`import.meta.env.BASE_URL`, and no dynamic import or route change SHALL be
required for the split.

#### Scenario: Chunk mapping is declared

- **WHEN** the Vite configuration is inspected
- **THEN** `manualChunks` returns distinct stable names for Svelte, Solar icons, and `fflate` package ids

#### Scenario: Production build has no warnings

- **WHEN** `BASE_PATH="/pincraft/" npm run build` runs
- **THEN** the build completes without chunk or dependency warnings and emits the declared vendor chunks alongside the application chunk

### Requirement: daisyUI generates only used component families

The daisyUI plugin SHALL declare an `include` list covering the component
families used in Svelte markup, with themes still disabled. Theme tokens and
pin-state CSS variables SHALL continue to come from the vendored theme file,
and the generated CSS SHALL contain the selectors required by the included
families.

#### Scenario: Include list covers markup

- **WHEN** component-family tokens in `.svelte` markup are compared with the daisyUI include list
- **THEN** every used family is included and no theme declaration is added to the plugin block

#### Scenario: Generated CSS retains component selectors

- **WHEN** a production build completes
- **THEN** the generated stylesheet contains selectors for the included button, badge, card, alert, modal, table, input, and select families

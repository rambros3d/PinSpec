# Spec Delta

## Purpose

Defines the daisyUI component layer used across the PinCraft UI: plugin scope, token ownership, the foreground utility name, component-class adoption on non-SVG surfaces, native dialog behavior, and the audit and verification contract that keeps the vendored themes and pin semantics stable.

## ADDED Requirements

### Requirement: Plugin enables all component families with scoped exclusions

The compiled stylesheet SHALL provide every daisyUI component family while excluding only the rootcolor, rootscrolllock, and rootscrollgutter base modules. No built-in theme SHALL be registered and no startup log SHALL be emitted.

#### Scenario: Component families are available

- **WHEN** the application stylesheet is compiled
- **THEN** classes for all daisyUI component families are generated and the three excluded base modules produce no rules

#### Scenario: No competing themes or startup log

- **WHEN** the application boots in a browser
- **THEN** no daisyUI log message is written to the console and no built-in theme name competes with the four vendored themes

### Requirement: Vendored themes keep authority over visual tokens

The four vendored theme definitions SHALL remain byte-for-byte unchanged and SHALL supply every color, radius, and size value used by the UI. No compact-density override or duplicate color, radius, or size declaration SHALL be introduced in the application stylesheet.

#### Scenario: Theme switch changes appearance only

- **WHEN** a user switches between the four vendored themes
- **THEN** every non-SVG surface adopts the new token values and no control changes density because of an override

#### Scenario: No duplicate token declarations

- **WHEN** the application stylesheet is inspected
- **THEN** it contains no duplicate color, radius, or size token declarations and the vendored theme file is unchanged

### Requirement: Foreground text has one unambiguous utility name

The custom foreground text utility SHALL be named text-foreground. The former text-primary name SHALL NOT resolve to the custom foreground color, and no alias SHALL be retained.

#### Scenario: Complete rename

- **WHEN** any source file or test references the custom foreground text utility
- **THEN** it uses text-foreground and no reference to the former custom text-primary utility remains

#### Scenario: Brand color remains distinct

- **WHEN** the generated stylesheet is inspected
- **THEN** text-foreground resolves to the base content token and the daisyUI brand text-primary utility keeps its own meaning

### Requirement: Non-SVG surfaces use component classes and status tokens

All surfaces outside the two IC package SVG renderers SHALL use daisyUI component classes and semantic color utilities in place of the retired custom shape, border, surface, action, and pin-surface utilities. Pin status surfaces SHALL keep their neutral, power, assigned, partial, conflict, and remap meanings and SHALL remain readable in every theme.

#### Scenario: Panels and controls are token driven

- **WHEN** a panel, toolbar, peripheral tree, table, badge, or alert is rendered
- **THEN** its shape, border, and color come from theme tokens through daisyUI classes and no retired custom utility appears in its markup

#### Scenario: Pin status meaning is preserved

- **WHEN** a pin status is shown in any theme
- **THEN** its daisyUI status utility resolves to the same semantic state as before and its foreground remains readable under the active theme

#### Scenario: Retired utilities are absent

- **WHEN** component and page markup is scanned
- **THEN** the retired custom shape, border, surface, action, and pin-surface utilities are absent outside the two package renderers

### Requirement: EDA rendering and viewport mechanics stay custom

The IC package SVG geometry, SVG pin-state colors, depth and noise texture, pointer pan and zoom, floating-overlay clamping, and peripheral tree state SHALL remain unchanged and SHALL NOT be replaced by daisyUI components. The texture SHALL stay always on and scoped to the two package renderers.

#### Scenario: Texture survives a flat theme

- **WHEN** a package is rendered with a theme whose depth and noise flags are zero
- **THEN** the IC body still renders the depth gradient and noise filter

#### Scenario: Texture scope is unchanged

- **WHEN** the source tree is scanned for texture filters and gradients
- **THEN** matches occur only in the two package renderers and the canvas keeps its base-100 surface

#### Scenario: Floating overlays stay clamped

- **WHEN** a pin popover or context menu is opened near a viewport edge
- **THEN** it remains a floating overlay and its full bounds lie inside the visible viewport

### Requirement: Dialogs use the native modal contract

The export, MCU switcher, board selector, compatible-MCU finder, pinout diff, and ambiguous-import selection dialogs SHALL use the platform modal dialog element and SHALL be opened and closed through its modal API. Each SHALL close on Escape or cancel, support backdrop close where a backdrop is present, keep its data contract and internal scrolling, and SHALL NOT register a duplicate window-level Escape listener.

#### Scenario: Dialog opens in the top layer

- **WHEN** any of the six dialogs is opened
- **THEN** it is promoted to the top layer and its content scrolls inside a height bounded by the visible viewport

#### Scenario: Escape and cancel close once

- **WHEN** the user presses Escape or triggers a cancel on an open dialog
- **THEN** the dialog closes through the modal API and its close handler runs exactly once

#### Scenario: Backdrop close and cancelled selection

- **WHEN** the user activates the backdrop or cancels the ambiguous-import selection
- **THEN** the dialog closes and a cancelled selection leaves the workspace state unchanged

### Requirement: Audit and static contracts track the migration

The token audit and its tests SHALL reflect the daisyUI-managed tokens and the renamed utilities. Static source tests SHALL assert updated class strings while preserving their original behavioral intent.

#### Scenario: Token audit passes

- **WHEN** the token audit runs
- **THEN** it exits successfully with no previously unused actionable token left without a consumer while depth and noise remain intentionally inert

#### Scenario: Static behavior checks still hold

- **WHEN** the static source tests run
- **THEN** checks for toolbar fit, dialog viewport bounds, dock tabs, finder wiring, and texture scope pass against the migrated markup

### Requirement: Full verification gates completion

The migration SHALL pass clean-install tests, strict type checking, and a zero-warning subpath production build. The built stylesheet for the GitHub Pages subpath SHALL contain daisyUI component rules and SHALL NOT contain the retired custom utility definitions.

#### Scenario: Verification sequence is green

- **WHEN** `npm ci`, `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` are run
- **THEN** all commands exit zero and the build reports no Svelte warnings

#### Scenario: Subpath CSS bundle is correct

- **WHEN** the built CSS asset under `/pincraft/` is inspected
- **THEN** it contains daisyUI component selectors and no former custom foreground or retired shape utility definition

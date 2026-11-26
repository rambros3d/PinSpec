# pinspec-start-screen Specification

## Purpose

Defines the `#/` application start screen: its three zones, the entry points for
new, opened, imported, and compared pinouts, the retained discovery and
provenance surfaces, and the boundary between shareable pin configuration and
local-only presentation state.

## Requirements

### Requirement: The hero preview and landing export preview are removed

The start screen SHALL NOT render an interactive chip preview, a hero vendor
switcher, a hero demo state, a hero-dependent workspace button, or a live export
preview with copy and download controls. The interactive chip preview component
and its dedicated demo-state builder SHALL be removed from the application.
Export generation and copy or download controls SHALL remain in the workspace
export modal only.

#### Scenario: No hero strings on the start screen

- **WHEN** the start screen source is inspected
- **THEN** it contains no hero chip identifier, hero loader, hero vendor selector, or hero preview component

#### Scenario: No export preview section

- **WHEN** the start screen is rendered
- **THEN** it contains no `#export-preview` section and no export copy or download control

#### Scenario: Workspace exports remain

- **WHEN** a workspace is open
- **THEN** its export modal still offers the Rust, C header, CSV, and JSON tabs with copy and download controls

### Requirement: Presentation state stays out of shareable pin configuration

No new shareable state field SHALL be introduced by the start screen. Action
selection and rail expansion SHALL remain component-local presentation state,
while quick-search discovery filters SHALL be presentation state persisted only
in localStorage. The theme preference SHALL remain in localStorage only. Pin
configuration handoff to the workspace SHALL continue through the existing
workspace store path and SHALL NOT gain a presentation field.

#### Scenario: Start screen state is not shared

- **WHEN** a workspace is opened through a start-screen action and then shared or exported as project JSON
- **THEN** neither the share payload nor the project JSON contains an action, rail, shortcut, or discovery filter field

#### Scenario: Theme preference remains local

- **WHEN** the theme control is used on the start screen and the workspace is later shared
- **THEN** the theme value is written only to localStorage and is absent from the share payload and project JSON

### Requirement: Source hygiene and verification remain green

The start screen SHALL add no dependency, SHALL keep raw color literals in the
vendored theme file, SHALL contain no emoji characters, and SHALL keep strict
TypeScript clean. `npm test`, `npm run check`, and
`BASE_PATH="/pinspec/" npm run build` SHALL exit zero with no build warnings.

#### Scenario: Verification sequence passes

- **WHEN** the three verification commands are run after the change
- **THEN** all three exit zero and the build resolves assets under `/pinspec/` without root-absolute data or asset paths

#### Scenario: No new raw colors or emoji

- **WHEN** the changed source files are scanned
- **THEN** no color literal appears outside `src/themes/daisyui.css` and no emoji character appears

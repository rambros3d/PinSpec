# Spec Delta

## MODIFIED Requirements

### Requirement: Previously unused color tokens have UI consumers

Secondary, accent, and the `*-content` color tokens from `src/themes/daisyui.css` SHALL be consumed by real non-pin UI surfaces through semantic aliases. Status badges and diagnostic pills SHALL use the corresponding content tokens as foregrounds. The `--pin-*` tokens SHALL keep their existing success/warning/error/info mapping and SHALL NOT be repurposed.

#### Scenario: Status badge foreground follows theme

- **WHEN** a success, warning, or error status pill is rendered in any theme
- **THEN** its foreground resolves through the matching `--color-*-content` token and remains readable

#### Scenario: Pin status colors are unchanged

- **WHEN** an assigned, partial, conflict, or remap pin is rendered before and after this change
- **THEN** its pin color resolves to the same `--pin-*` token and semantic state as before

#### Scenario: Sidebar icons consume the accent token

- **WHEN** the sidebar renders a non-active section icon in either theme
- **THEN** the icon resolves through the accent token alias and no literal accent color appears in the component

#### Scenario: Icon accent does not recolor labels

- **WHEN** the accent class is applied to a sidebar icon
- **THEN** the sibling label still resolves through its original inherited foreground class

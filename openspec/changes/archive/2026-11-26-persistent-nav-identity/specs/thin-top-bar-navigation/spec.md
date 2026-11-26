# Spec Delta

## MODIFIED Requirements

### Requirement: One thin global navigation bar

The shell SHALL mount one h-8 navigation bar on every route. Its left group
SHALL be Home, Projects, and Catalog; its right group SHALL begin with the
Workspace control on non-workspace routes, then About, GitHub, shortcuts, and
the theme picker. The app icon and `PinSpec` name SHALL be centered on every
route. Below `sm`, section labels SHALL collapse to icons without horizontal
scrolling.

#### Scenario: Navigation on every route

- **WHEN** any supported route is opened
- **THEN** exactly one thin navigation bar is present, the centered identity is visible, and the active section is marked with `aria-current`

#### Scenario: Phone-width navigation

- **WHEN** the viewport is narrower than `sm`
- **THEN** section labels are hidden, icon controls keep accessible names, and no horizontal scrolling is required

#### Scenario: Workspace control is contextual

- **WHEN** a workspace or shared route is opened
- **THEN** the Workspace control is absent but the centered identity remains

### Requirement: Product identity follows the active surface

The thin navigation bar SHALL center the Radiokit mark and `PinSpec` name on
every route. Workspace and shared routes SHALL also show the mark in the
workspace action bar. No static route-title text SHALL be added.

#### Scenario: Identity on discovery routes

- **WHEN** Home, Catalog, Projects, or About is opened
- **THEN** the thin bar centers the app icon followed by the PinSpec name between the left and right groups

#### Scenario: Identity in a workspace

- **WHEN** a workspace or shared route is opened
- **THEN** the workspace action bar shows the app icon and the thin bar keeps the centered app icon and PinSpec name

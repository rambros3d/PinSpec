# Spec Delta

## MODIFIED Requirements

### Requirement: One thin global navigation bar

The shell SHALL mount one h-8 navigation bar on every route. Its left group
SHALL be Home, Projects, and Catalog; its right group SHALL begin with the
Workspace control, then About, GitHub, shortcuts, and the theme picker. The app
icon and `PinSpec` name SHALL be centered on non-workspace routes. The Workspace
control and centered identity SHALL NOT appear on workspace or shared routes.
Below `sm`, section labels SHALL collapse to icons without horizontal scrolling.

#### Scenario: Navigation on every route

- **WHEN** any supported route is opened
- **THEN** exactly one thin navigation bar is present and its active section is marked with `aria-current`

#### Scenario: Phone-width navigation

- **WHEN** the viewport is narrower than `sm`
- **THEN** section labels are hidden, icon controls keep accessible names, and no horizontal scrolling is required

#### Scenario: Workspace control is contextual

- **WHEN** a workspace or shared route is opened
- **THEN** neither the Workspace control nor the centered identity is rendered and the thin bar shows only the left and right groups

### Requirement: Product identity follows the active surface

Non-workspace routes SHALL center the Radiokit mark and `PinSpec` name between
the navigation groups. Workspace and shared routes SHALL show the mark only in
the workspace action bar and SHALL NOT repeat the name in the thin bar. No
static route-title text SHALL be added.

#### Scenario: Identity on discovery routes

- **WHEN** Home, Catalog, Projects, or About is opened
- **THEN** the thin bar centers the app icon followed by the PinSpec name between the left and right groups

#### Scenario: Identity in a workspace

- **WHEN** a workspace or shared route is opened
- **THEN** the workspace action bar shows the app icon and the thin bar contains no wordmark or name

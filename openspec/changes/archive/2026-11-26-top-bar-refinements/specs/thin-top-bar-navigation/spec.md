# Spec Delta

## ADDED Requirements

### Requirement: Product identity follows the active surface

Non-workspace routes SHALL show the Radiokit mark and the `PinSpec` name at the
start of the thin bar's left group. Workspace and shared routes SHALL show the
mark only in the workspace action bar and SHALL NOT repeat the name in the thin
bar. No static route-title text SHALL be added.

#### Scenario: Identity on discovery routes

- **WHEN** Home, Catalog, Projects, or About is opened
- **THEN** the thin bar shows the app icon followed by the PinSpec name before the section links

#### Scenario: Identity in a workspace

- **WHEN** a workspace or shared route is opened
- **THEN** the workspace action bar shows the app icon and the thin bar contains no wordmark or name

## MODIFIED Requirements

### Requirement: One thin global navigation bar

The shell SHALL mount one h-8 navigation bar on every route. Its left group
SHALL be Home, Projects, and Catalog; its right group SHALL be an About info
icon, a GitHub icon, keyboard shortcuts, and the compact theme picker. The
Workspace control SHALL be centered between the groups on non-workspace routes
and SHALL NOT be rendered on workspace or shared routes. Below the `sm`
breakpoint, section labels SHALL collapse to icons while all targets remain
operable without horizontal scrolling.

#### Scenario: Navigation on every route

- **WHEN** any supported route is opened
- **THEN** exactly one thin navigation bar is present and its active section is marked with `aria-current`

#### Scenario: Phone-width navigation

- **WHEN** the viewport is narrower than `sm`
- **THEN** section labels are hidden, icon controls keep accessible names, and no horizontal scrolling is required

#### Scenario: Workspace control is contextual

- **WHEN** a workspace or shared route is opened
- **THEN** the centered Workspace control is absent and the thin bar shows only the left and right groups

### Requirement: About and GitHub icons are accessible

The info icon SHALL open the About route and carry an accessible name, title,
and active state. The GitHub icon SHALL be an icon-only inline SVG link to the
public repository that opens in a new tab with `rel="noopener noreferrer"` and
an accessible anchor name. The shortcuts control SHALL also be icon-only at
every width. No new icon dependency SHALL be added.

#### Scenario: About remains reachable

- **WHEN** the user activates the info icon
- **THEN** the About route renders its provenance table and the icon shows the active state

#### Scenario: Repository link is safe

- **WHEN** the GitHub icon is rendered
- **THEN** its anchor carries the repository URL, opens in a new tab, hides the SVG from assistive technology, and renders no text label

### Requirement: Overlays and preferences follow the two-bar layout

The Clear All confirmation SHALL anchor at `top-20` below both bars. The
navigation bar SHALL be h-8 and route scroll offsets SHALL use `2rem`. The
sidebar expansion preference and its storage key SHALL be removed; discovery
filters and theme remain localStorage-only and no new preference SHALL enter
share URLs, project files, or undo history.

#### Scenario: Clear confirmation position

- **WHEN** the Clear All confirmation is open in a workspace
- **THEN** it appears directly below the workspace action bar and does not cover either bar

#### Scenario: No dead sidebar preference

- **WHEN** localStorage and exported state are inspected after the migration
- **THEN** no sidebar expansion key exists and no share payload or project file contains a navigation field

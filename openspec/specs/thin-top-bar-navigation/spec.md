# thin-top-bar-navigation Specification

## Purpose

Defines the two-bar application shell: one thin navigation bar on every route
for Home, Projects, Catalog, Workspace, About, the repository link, shortcuts,
and theme, plus a workspace-only action bar for pin-planning controls. It also
covers the removal of the collapsible sidebar and its localStorage preference.

## Requirements

### Requirement: One thin global navigation bar

The shell SHALL mount one h-9 navigation bar on every route. Its left group
SHALL be Home, Projects, and Catalog; its right group SHALL be Workspace, an
info icon for About, a GitHub link icon, keyboard shortcuts, and the compact
theme picker. No wordmark or route-title text SHALL be rendered. Below the `sm`
breakpoint, labels SHALL collapse to icons while all targets remain operable.

#### Scenario: Navigation on every route

- **WHEN** any supported route is opened
- **THEN** exactly one thin navigation bar is present and its active section is marked with `aria-current`

#### Scenario: Phone-width navigation

- **WHEN** the viewport is narrower than `sm`
- **THEN** section labels are hidden, icon controls keep accessible names, and no horizontal scrolling is required

### Requirement: About and GitHub icons are accessible

The info icon SHALL open the About route and carry an accessible name, title,
and active state. The GitHub icon SHALL be an inline SVG link to the public
repository that opens in a new tab with `rel="noopener noreferrer"` and an
accessible anchor name. No new icon dependency SHALL be added.

#### Scenario: About remains reachable

- **WHEN** the user activates the info icon
- **THEN** the About route renders its provenance table and the icon shows the active state

#### Scenario: Repository link is safe

- **WHEN** the GitHub icon is rendered
- **THEN** its anchor carries the repository URL, opens in a new tab, and hides the SVG from assistive technology

### Requirement: Workspace navigation is state-aware

The right-side Workspace control SHALL open the loaded chip or the most recent
session and SHALL be disabled with an explanatory title when neither exists.
Recent sessions SHALL NOT be listed in the shell; the Projects route remains
their management surface.

#### Scenario: No workspace target

- **WHEN** no chip is loaded and no recent session exists
- **THEN** the Workspace control is disabled and explains that a part must be opened first

#### Scenario: Recent sessions stay on Projects

- **WHEN** the shell is inspected
- **THEN** it contains no recent-session list and no session delete action

### Requirement: A second bar hosts workspace actions

On workspace and shared routes the shell SHALL mount one h-12 bar below the
navigation bar. It SHALL own the project-name editor, MCU switcher, undo, redo,
Clear All, Compatible MCUs, Compare, Share, and Export, with the existing
scroll affordance. Other routes SHALL NOT render this bar.

#### Scenario: Workspace-only action bar

- **WHEN** a workspace or shared pinout route is opened
- **THEN** exactly one action bar is mounted below the navigation bar and all pin-planning actions remain reachable

#### Scenario: Non-workspace routes stay thin

- **WHEN** Home, Catalog, Projects, or About is opened
- **THEN** no workspace action bar is rendered and page content starts below the navigation bar

### Requirement: Overlays and preferences follow the two-bar layout

The Clear All confirmation SHALL anchor below both bars. The sidebar expansion
preference and its storage key SHALL be removed; discovery filters and theme
remain localStorage-only and no new preference SHALL enter share URLs, project
files, or undo history.

#### Scenario: Clear confirmation position

- **WHEN** the Clear All confirmation is open in a workspace
- **THEN** it appears directly below the workspace action bar and does not cover the bar's controls

#### Scenario: No dead sidebar preference

- **WHEN** localStorage and exported state are inspected after the migration
- **THEN** no sidebar expansion key exists and no share payload or project file contains a navigation field

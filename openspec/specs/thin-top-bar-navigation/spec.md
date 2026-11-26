# thin-top-bar-navigation Specification

## Purpose

Defines the two-bar application shell: one thin navigation bar on every route
for Home, Projects, Catalog, Workspace, About, the repository link, shortcuts,
and theme, plus a workspace-only action bar for pin-planning controls. It also
covers the removal of the collapsible sidebar and its localStorage preference.

## Requirements

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

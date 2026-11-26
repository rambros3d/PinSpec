# Spec Delta

## Purpose

Removes the duplicate brand header from the application sidebar.

## MODIFIED Requirements

### Requirement: A collapsible sidebar is present on every route

The shell SHALL render a left sidebar on all six routes with a collapsed 3rem
rail in reserved space and a top-bar expand/collapse control. Expansion SHALL
overlay content without reflow. The sidebar SHALL NOT render a separate brand
header with an app logo or PinSpec label; section navigation SHALL be its
first visible content.

#### Scenario: Collapsed rail stays visible on every route

- **WHEN** the user opens any supported route with the sidebar collapsed
- **THEN** the narrow icon rail is visible and every sidebar entry remains reachable

#### Scenario: Expansion overlays without moving the page

- **WHEN** the user expands the sidebar while a page is open
- **THEN** the expanded panel overlays the page and the canvas, toolbars, and panes keep their prior geometry, pan, and zoom

#### Scenario: Collapse restores the unobstructed page

- **WHEN** the user collapses the sidebar
- **THEN** the overlay is removed and the underlying page content and state are unchanged

#### Scenario: Navigation keeps the sidebar state

- **WHEN** the user navigates to another route through the sidebar
- **THEN** the sidebar keeps its expanded or collapsed state and the new route renders with that state

#### Scenario: Collapsed rail reserves its width

- **WHEN** the user opens any supported route with the sidebar collapsed
- **THEN** the route content begins after the reserved 3rem rail and no content is covered by the rail

#### Scenario: Toggle is in the global bar

- **WHEN** the user looks for the sidebar control on any route
- **THEN** the control is the leftmost control of the global top bar and is not present in the rail header

#### Scenario: Navigation starts at the top

- **WHEN** the sidebar is opened on any supported route
- **THEN** the first visible block inside the panel is the section navigation and no separate logo or PinSpec label appears above it

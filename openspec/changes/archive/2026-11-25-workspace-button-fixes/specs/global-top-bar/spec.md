# Spec Delta

## Purpose

Adjusts the workspace left-edge title so the app icon precedes the editable
project name, leaving all other bar controls unchanged.

## MODIFIED Requirements

### Requirement: The global bar composes route context and shared controls

The bar SHALL show route context, section links, theme, and shortcuts controls.
On workspace and shared routes its left edge SHALL show the RadioKit app icon
resolved through `import.meta.env.BASE_URL` before the editable project-name
control. Non-workspace controls and the shared shortcut dialog SHALL be
unchanged.

#### Scenario: Route context on shell pages

- **WHEN** a shell route is opened
- **THEN** the bar shows that route's title and the Home, Catalog, and Projects links with the active destination indicated

#### Scenario: Shortcuts control opens help

- **WHEN** the user activates the shortcuts control in the global bar
- **THEN** the same shortcut-help dialog as the `?` key opens with focus inside

#### Scenario: Shortcut help keeps daisyUI dialog structure

- **WHEN** shortcut help is opened from the global bar on any route
- **THEN** its backdrop is a direct child of the dialog outside `.modal-box`, and Escape, cancel, backdrop click, and the close control still close the dialog and restore focus

#### Scenario: Compact overflow

- **WHEN** the bar controls do not fit the viewport
- **THEN** the row scrolls horizontally inside the bar without widening the document

#### Scenario: Workspace title is the project name

- **WHEN** a workspace or shared route is opened with a named project
- **THEN** the left-edge title shows the app icon followed by the project name and no chip-id `routeTitle` is rendered there

#### Scenario: Shell route titles are unchanged

- **WHEN** the home, catalog, projects, or about route is opened
- **THEN** its original title, wordmark, and section links remain unchanged

#### Scenario: Workspace title leads with the app icon

- **WHEN** a workspace or shared route is opened
- **THEN** the global bar renders `radiokit-logo.svg` from the configured base URL immediately before the editable project-name control

#### Scenario: Renaming still works from the title row

- **WHEN** the user activates the project-name control and enters a new name
- **THEN** the rename commits through the existing workspace store action while the icon remains at the left edge

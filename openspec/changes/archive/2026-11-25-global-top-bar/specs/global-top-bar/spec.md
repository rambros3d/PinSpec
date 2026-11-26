# Spec Delta

## Purpose

Defines the single navigation and action bar shared by every route, the reserved
space for the collapsed sidebar rail, the placement of the sidebar toggle, the
merged workspace actions, and the boundary that keeps routing and persistence
unchanged.

## ADDED Requirements

### Requirement: One global top bar is mounted on every route

The shell SHALL render exactly one h-12 top bar on the home, catalog, projects,
about, workspace, and shared routes. The bar SHALL visually match the workspace
toolbar and SHALL replace the four per-page navbars and the workspace toolbar, so
no route renders two bars.

#### Scenario: Single bar on each route

- **WHEN** any supported route is opened
- **THEN** exactly one global top bar is present and no page navbar or separate workspace toolbar is rendered

#### Scenario: Bar matches the workspace toolbar

- **WHEN** the home route and a workspace route are compared
- **THEN** the bar uses the same height, surface, and border treatment in both routes

### Requirement: The PinSpec wordmark is omitted only in the workspace

The global bar SHALL show the PinSpec wordmark on the home, catalog, projects,
and about routes. On workspace and shared routes the wordmark SHALL be omitted to
save horizontal space while every other bar control remains available.

#### Scenario: Wordmark on shell routes

- **WHEN** any of home, catalog, projects, or about is opened
- **THEN** the global bar contains the text PinSpec

#### Scenario: Wordmark omitted in the workspace

- **WHEN** a workspace or shared route is opened
- **THEN** the global bar contains no PinSpec text and retains the same height and controls

### Requirement: The collapsed rail reserves horizontal space on every route

Every route SHALL reserve 3rem of horizontal space for the collapsed rail so the
rail never covers route content. The expanded sidebar SHALL remain a fixed overlay
with a backdrop and SHALL NOT change the reserved width, resize content, or
reflow the canvas.

#### Scenario: Rail does not cover content

- **WHEN** any route is opened with the sidebar collapsed
- **THEN** route content starts after the reserved 3rem rail and no content is hidden behind the rail

#### Scenario: Expansion does not change layout

- **WHEN** the user expands the sidebar
- **THEN** the panel overlays with a backdrop and the reserved width, canvas geometry, pan, and zoom are unchanged

#### Scenario: Collapse restores the unobstructed content

- **WHEN** the user collapses the sidebar
- **THEN** the overlay is removed and route content keeps its reserved 3rem start

### Requirement: The sidebar toggle is the leftmost global bar control

The expand/collapse control SHALL be the leftmost control of the global top bar on
every route and SHALL NOT appear in the rail header. Activating it SHALL toggle
the same fixed overlay and backdrop behavior as before.

#### Scenario: Toggle lives in the bar

- **WHEN** any route is opened
- **THEN** the sidebar toggle is present at the start of the global bar and is absent from the rail header

#### Scenario: Toggle controls the overlay

- **WHEN** the user activates the sidebar toggle
- **THEN** the sidebar expands or collapses without changing the route or any pin configuration

### Requirement: The global bar composes route context and shared controls

The bar SHALL show a route title, section links for Home, Catalog, and Projects,
the theme control, and the shortcuts control. On workspace and shared routes it
SHALL also show the merged workspace actions in place of the former toolbar.

#### Scenario: Route context on shell pages

- **WHEN** a shell route is opened
- **THEN** the bar shows that route's title and the Home, Catalog, and Projects links with the active destination indicated

#### Scenario: Shortcuts control opens help

- **WHEN** the user activates the shortcuts control in the global bar
- **THEN** the same shortcut-help dialog as the `?` key opens with focus inside

#### Scenario: Compact overflow

- **WHEN** the bar controls do not fit the viewport
- **THEN** the row scrolls horizontally inside the bar without widening the document

### Requirement: Workspace actions are merged into the global bar

On workspace and shared routes the global bar SHALL host the MCU switcher, pin and
signal search, undo, redo, clear, alternatives, compare, share, export, and
rotation and fit controls where still needed. Each action SHALL keep its prior
behavior and keyboard shortcut.

#### Scenario: All actions available once

- **WHEN** a workspace or shared route is opened
- **THEN** every former toolbar action is present in the global bar and no second action bar is rendered

#### Scenario: Search shortcut selects text

- **WHEN** the workspace search shortcut is pressed
- **THEN** the global bar search input is focused with its current query selected

#### Scenario: Actions keep their behavior

- **WHEN** the user activates an undo, redo, share, or export control in the global bar
- **THEN** that action behaves as before the bar change

### Requirement: The global bar does not change routes, persistence, or pin configuration

Adding the bar and reserving rail space SHALL NOT change hash routing, data
fetches through `dataUrl()`, the version-2 share and project schemas, or the
localStorage-only presentation preferences. Pin configuration remains shareable.

#### Scenario: Routes and subpaths are unchanged

- **WHEN** a route or version-2 shared link is opened under `/pinspec/`
- **THEN** it resolves from the hash and data requests use `import.meta.env.BASE_URL`

#### Scenario: Preferences stay local

- **WHEN** the sidebar is toggled or the theme is changed
- **THEN** only localStorage changes and no preference field enters a share URL or project file

#### Scenario: Pin configuration stays shareable

- **WHEN** a workspace is shared or exported as a version-2 file
- **THEN** assignments, labels, locks, modes, remaps, and PIO bindings are preserved in the payload

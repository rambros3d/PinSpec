# Spec Delta

## MODIFIED Requirements

### Requirement: The global bar composes route context and shared controls

The bar SHALL show a route title, section links for Home, Catalog, and Projects,
the theme control, and the shortcuts control. On workspace and shared routes it
SHALL also show the merged workspace actions in place of the former toolbar.
The shortcuts control SHALL open the shared help dialog whose backdrop is a
direct child of the dialog element and outside `.modal-box`, without changing
focus or dismissal behavior.

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
- **THEN** the left-edge title shows the project name and no chip-id `routeTitle` is rendered there

#### Scenario: Shell route titles are unchanged

- **WHEN** the home, catalog, projects, or about route is opened
- **THEN** its original title, wordmark, and section links remain unchanged

### Requirement: Workspace actions are merged into the global bar

On workspace and shared routes the global bar SHALL host the MCU switcher, pin and
signal search, undo, redo, clear, alternatives, compare, share, export, and
rotation and fit controls where still needed. Each action SHALL keep its prior
behavior and keyboard shortcut. The MCU switcher SHALL pair its existing pending
message with an extra-small daisyUI loading indicator while catalog data is
loading.

#### Scenario: All actions available once

- **WHEN** a workspace or shared route is opened
- **THEN** every former toolbar action except the pin and signal find input, which is rendered in the package canvas HUD, is present in the global bar and no second action bar is rendered

#### Scenario: Search shortcut selects text

- **WHEN** the workspace search shortcut is pressed
- **THEN** the package canvas HUD search input is focused with its current query selected

#### Scenario: Actions keep their behavior

- **WHEN** the user activates an undo, redo, share, or export control in the global bar
- **THEN** that action behaves as before the bar change

#### Scenario: MCU switcher pending state

- **WHEN** the MCU switcher is opened while the catalog index is still loading
- **THEN** the existing loading text is shown with a `loading loading-spinner loading-xs` indicator and the switcher keeps its search and selection behavior

#### Scenario: Find input is absent from the bar

- **WHEN** a workspace or shared route is opened
- **THEN** the global bar contains no pin and signal find input and the package canvas HUD contains it

#### Scenario: Workspace actions are right aligned

- **WHEN** the workspace action cluster is inspected
- **THEN** an auto margin precedes Undo and the rendered actions end at the right edge with Theme as the last control

#### Scenario: Chip pill remains after title replacement

- **WHEN** the project title replaces the chip-id `routeTitle` on a workspace or shared route
- **THEN** the chip-id MCU switcher button is still present in the workspace action cluster

### Requirement: The global bar does not change routes, persistence, or pin configuration

Adding the bar and reserving rail space SHALL NOT change hash routing, data
fetches through `dataUrl()`, or the localStorage-only presentation preferences.
The version-2 share and project schemas gain only an optional shareable
project-name field and keep their version. Pin configuration, including that
field, remains shareable. Moving the editable project-name control to the
left-edge title SHALL NOT introduce an editing flag into persisted state; edit
mode remains transient view state.

#### Scenario: Routes and subpaths are unchanged

- **WHEN** a route or version-2 shared link is opened under `/pincraft/`
- **THEN** it resolves from the hash and data requests use `import.meta.env.BASE_URL`

#### Scenario: Preferences stay local

- **WHEN** the sidebar is toggled or the theme is changed
- **THEN** only localStorage changes and no preference field enters a share URL or project file

#### Scenario: Pin configuration stays shareable

- **WHEN** a workspace is shared or exported as a version-2 file
- **THEN** assignments, labels, locks, modes, remaps, and PIO bindings are preserved in the payload

#### Scenario: Optional project name is shareable

- **WHEN** a named workspace is shared or exported from the global bar
- **THEN** the version-2 payload contains the project name and its version remains 2

#### Scenario: Project name is not a presentation preference

- **WHEN** the bar edits a project name and shell preferences are written
- **THEN** the name enters workspace history, recent sessions, share links, and project files while the shell preference record stays free of it

#### Scenario: Name edit mode stays transient

- **WHEN** the left-edge title enters or leaves edit mode
- **THEN** no editing flag is written to localStorage, a share URL, a project file, or recent sessions

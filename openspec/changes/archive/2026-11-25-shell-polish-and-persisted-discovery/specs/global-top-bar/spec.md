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

### Requirement: Workspace actions are merged into the global bar

On workspace and shared routes the global bar SHALL host the MCU switcher, pin and
signal search, undo, redo, clear, alternatives, compare, share, export, and
rotation and fit controls where still needed. Each action SHALL keep its prior
behavior and keyboard shortcut. The MCU switcher SHALL pair its existing pending
message with an extra-small daisyUI loading indicator while catalog data is
loading.

#### Scenario: All actions available once

- **WHEN** a workspace or shared route is opened
- **THEN** every former toolbar action is present in the global bar and no second action bar is rendered

#### Scenario: Search shortcut selects text

- **WHEN** the workspace search shortcut is pressed
- **THEN** the global bar search input is focused with its current query selected

#### Scenario: Actions keep their behavior

- **WHEN** the user activates an undo, redo, share, or export control in the global bar
- **THEN** that action behaves as before the bar change

#### Scenario: MCU switcher pending state

- **WHEN** the MCU switcher is opened while the catalog index is still loading
- **THEN** the existing loading text is shown with a `loading loading-spinner loading-xs` indicator and the switcher keeps its search and selection behavior

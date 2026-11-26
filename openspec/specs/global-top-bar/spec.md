# global-top-bar Specification

## Purpose

Defines the single navigation and action bar shared by every route, the reserved
space for the collapsed sidebar rail, the placement of the sidebar toggle, the
merged workspace actions, and the boundary that keeps routing and persistence
unchanged.

## Requirements

### Requirement: The global bar does not change routes, persistence, or pin configuration

Adding the bar and reserving rail space SHALL NOT change hash routing, data
fetches through `dataUrl()`, or the localStorage-only presentation preferences.
The version-2 share and project schemas gain only an optional shareable
project-name field and keep their version. Pin configuration, including that
field, remains shareable. Moving the editable project-name control to the
left-edge title SHALL NOT introduce an editing flag into persisted state; edit
mode remains transient view state.

#### Scenario: Routes and subpaths are unchanged

- **WHEN** a route or version-2 shared link is opened under `/pinspec/`
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

### Requirement: Clear All describes the full reset

The Clear All control SHALL confirm and report that it resets the complete pin
plan: assignments, labels, locks, peripheral modes, remaps, and PIO bindings.
The existing undo path SHALL remain available, and no additional persistence
SHALL be introduced.

#### Scenario: Confirmation names what is reset

- **WHEN** the user opens the Clear All confirmation from the global bar
- **THEN** the confirmation states that assignments, labels, locks, modes, remaps, and PIO bindings are cleared and that Ctrl+Z can undo the action

#### Scenario: Result message matches behavior

- **WHEN** the user confirms Clear All
- **THEN** the toast reports a full pin-plan reset and the workspace state is cleared through the existing commit and history path

### Requirement: Keyboard affordances match implemented shortcuts

Controls with implemented keyboard shortcuts SHALL expose `aria-keyshortcuts`
values that match the handlers, including the MCU switcher, pin search, undo,
redo, and shortcut help. The visible shortcut reference SHALL use the same
wording for those actions.

#### Scenario: Shortcut metadata is visible to assistive technology

- **WHEN** the global bar or workspace renders a control with a keyboard shortcut
- **THEN** that control exposes an `aria-keyshortcuts` attribute matching the key combination handled by the application

#### Scenario: Shortcut reference agrees with controls

- **WHEN** the shortcut help dialog is opened
- **THEN** its part search, pin search, MCU switcher, and help entries describe the same actions as the corresponding controls

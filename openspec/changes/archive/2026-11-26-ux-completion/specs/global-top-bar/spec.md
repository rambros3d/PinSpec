# Spec Delta

## ADDED Requirements

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

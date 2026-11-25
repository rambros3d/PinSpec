# Spec Delta

## MODIFIED Requirements

### Requirement: Shortcut help is available on demand

A help dialog SHALL be openable with the `?` key and from the shortcuts control
in the global top bar, and SHALL list the keyboard shortcuts available in the
workspace. It SHALL follow the same focus, Escape, and close behavior as the
other workspace dialogs and SHALL NOT appear while the user is typing in a text
field. The inline project-name input in the global top bar is such a text field,
and Escape there SHALL cancel the name edit before any dialog or popover closes.

#### Scenario: Help opens from the keyboard

- **WHEN** the user presses `?` outside a text field
- **THEN** a dialog opens listing the available keyboard shortcuts with focus inside the dialog

#### Scenario: Help does not interrupt typing

- **WHEN** the user types `?` inside a text field
- **THEN** the help dialog does not open and the character is entered normally

#### Scenario: Help opens from the global bar

- **WHEN** the user activates the shortcuts control in the global top bar
- **THEN** the same help dialog opens with focus inside and the same close behavior as the `?` shortcut

#### Scenario: Project-name input does not open help

- **WHEN** the user types `?` while the inline project-name input has focus
- **THEN** the character is entered in that input and no help dialog opens

#### Scenario: Escape cancels the name edit first

- **WHEN** the inline project-name input has focus and the user presses Escape
- **THEN** the name edit is cancelled and no help dialog or other popover is opened

# Spec Delta

## MODIFIED Requirements

### Requirement: Toolbar overflow has a scroll affordance

The horizontally scrollable global top bar SHALL indicate when its control row
has more content to the right and SHALL keep the existing internal horizontal
scrolling behavior and h-12 bar height.

#### Scenario: Scrollable toolbar shows an affordance

- **WHEN** the toolbar control row overflows its available width
- **THEN** a visible affordance indicates additional controls to the right and scrolling the row reveals those controls without widening the document

#### Scenario: Fitting toolbar has no stale affordance

- **WHEN** all toolbar controls fit within the available width
- **THEN** no scroll affordance is shown and the control row remains unchanged

#### Scenario: Global bar overflow affordance

- **WHEN** the global bar control row overflows on any route
- **THEN** the affordance indicates additional controls and scrolling reveals them without widening the document

### Requirement: Shortcut help is available on demand

A help dialog SHALL be openable with the `?` key and from the shortcuts control
in the global top bar, and SHALL list the keyboard shortcuts available in the
workspace. It SHALL follow the same focus, Escape, and close behavior as the
other workspace dialogs and SHALL NOT appear while the user is typing in a text
field.

#### Scenario: Help opens from the keyboard

- **WHEN** the user presses `?` outside a text field
- **THEN** a dialog opens listing the available keyboard shortcuts with focus inside the dialog

#### Scenario: Help does not interrupt typing

- **WHEN** the user types `?` inside a text field
- **THEN** the help dialog does not open and the character is entered normally

#### Scenario: Help opens from the global bar

- **WHEN** the user activates the shortcuts control in the global top bar
- **THEN** the same help dialog opens with focus inside and the same close behavior as the `?` shortcut

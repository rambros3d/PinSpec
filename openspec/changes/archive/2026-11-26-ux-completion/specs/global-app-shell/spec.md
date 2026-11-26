# Spec Delta

## ADDED Requirements

### Requirement: Shortcut reference is complete

The shared shortcut list SHALL include the `?` key that opens the help dialog
and SHALL name the part search, pin search, and MCU switcher actions exactly as
they appear on their controls. The reference SHALL remain owned by the shared
dialog and SHALL NOT be repeated on About or the landing page.

#### Scenario: Help lists its own trigger

- **WHEN** the shortcut dialog is opened with `?` or from the sidebar
- **THEN** the list includes `?` with an action describing the shortcut dialog

#### Scenario: No duplicate shortcut reference

- **WHEN** About, the landing page, or any shell route other than the dialog is inspected
- **THEN** none renders its own shortcut list

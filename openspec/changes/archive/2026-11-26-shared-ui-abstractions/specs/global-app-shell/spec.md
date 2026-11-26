# global-app-shell Specification

## ADDED Requirements

### Requirement: Shared dialogs mount once in the global shell

The global shell SHALL mount once every dialog with more than one owner:
`PinoutDiffModal` and `ShortcutHelpDialog`. One typed value in the transient
top-bar store SHALL own their state and back the existing boolean accessors.
Dialog state SHALL stay out of localStorage, share URLs, and project files.

#### Scenario: Compare opens from either owner

- **WHEN** the start-screen Compare action or the global bar compare action is activated
- **THEN** the one shared `PinoutDiffModal` in `AppShell` opens and closing it clears the shared owner

#### Scenario: One help dialog on every route

- **WHEN** Hotkeys is activated from the sidebar, the bar, or the keyboard
- **THEN** the one shared `ShortcutHelpDialog` in `AppShell` opens over the current route and focus returns to its opener on close

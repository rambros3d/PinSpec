# Spec Delta

## MODIFIED Requirements

### Requirement: Toast stays clear of the portrait dock and can be dismissed

Workspace notifications SHALL use a dedicated toast class. In portrait the
toast SHALL sit above the bottom dock with a bottom offset of
`calc(43dvh + 0.75rem)` so it does not cover the dock tabs or dock body. The
toast SHALL provide a dismiss control in addition to its existing timeout. It
SHALL remain fully visible when the global sidebar is expanded over the
workspace.

#### Scenario: Portrait toast clears the dock

- **WHEN** a notification is shown while the workspace is in portrait orientation
- **THEN** the toast is fully visible above the dock and does not overlay the dock tabs or dock body

#### Scenario: Toast is dismissed manually

- **WHEN** the user activates the toast dismiss control
- **THEN** the toast is removed immediately and can be replaced by a later notification

#### Scenario: Landscape placement is unchanged

- **WHEN** a notification is shown in landscape
- **THEN** the toast remains centered at the bottom of the workspace with its existing tone and timeout

#### Scenario: Expanded sidebar does not hide the toast

- **WHEN** a notification is shown while the global sidebar is expanded in either orientation
- **THEN** the toast remains fully visible and its dismiss control remains operable above the sidebar overlay

# Spec Delta

## MODIFIED Requirements

### Requirement: Recent projects are listed in the sidebar

The sidebar recent-projects area SHALL list at most 10 sessions from
`pincraft:recent_sessions_v1` in the same order as the workspace store. Each
entry SHALL offer quick open and delete. Opening SHALL restore the saved pin
configuration through the existing workspace handoff. Each entry SHALL also
display its saved project name when present.

#### Scenario: Recent projects are limited to ten

- **WHEN** more than 10 recent sessions are stored
- **THEN** the sidebar lists only the 10 most recent sessions from the store

#### Scenario: Quick open restores a session

- **WHEN** the user activates a recent project entry
- **THEN** the workspace opens for that MCU with the session's assignments, labels, locks, and modes restored

#### Scenario: Recent project delete updates the list

- **WHEN** the user deletes a recent project from the sidebar
- **THEN** that entry is removed from the sidebar and from the stored session list and no other session changes

#### Scenario: No recent projects

- **WHEN** no recent sessions are stored
- **THEN** the sidebar shows an empty-state message and no open or delete control for a session

#### Scenario: Recent entry shows its project name

- **WHEN** a saved session carries a project name
- **THEN** its sidebar entry displays that name alongside the MCU identifier

#### Scenario: Recent entry without a name

- **WHEN** a saved session has no project-name field
- **THEN** its sidebar entry shows no name text and keeps its open and delete controls

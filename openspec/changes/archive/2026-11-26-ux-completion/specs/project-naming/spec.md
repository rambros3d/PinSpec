# Spec Delta

## ADDED Requirements

### Requirement: Recent projects can be searched

The projects route SHALL filter its recent-session list in memory by part
number, project name, and package name. The search SHALL be case-insensitive and
SHALL NOT change the stored sessions, their order, or any shareable state.

#### Scenario: Search narrows the card list

- **WHEN** a user types a part number, project name, or package fragment into the projects search field
- **THEN** only matching recent sessions are shown and the stored session list is unchanged

#### Scenario: Empty search restores all sessions

- **WHEN** the search field is cleared
- **THEN** all recent sessions are shown in their existing order

### Requirement: Project deletion asks for confirmation

Deleting a recent session SHALL require a second, per-card confirmation in the
page itself. Dismissing the confirmation SHALL leave the session intact, and
confirming SHALL call the existing delete action once.

#### Scenario: Delete is not immediate

- **WHEN** a user activates the Delete action on a project card
- **THEN** that card shows a confirm and cancel choice and the session is still present

#### Scenario: Cancellation keeps the session

- **WHEN** the user cancels the delete confirmation
- **THEN** the confirmation closes and the session remains in the list

### Requirement: Save as downloads a renamed copy

The projects route SHALL offer a Save as action that downloads a version-2 JSON
copy with a caller-supplied project name. The saved session's name, assignments,
and order SHALL be unchanged, and the downloaded file SHALL be parseable by the
existing import path.

#### Scenario: Renamed copy is exported

- **WHEN** a user supplies a name and confirms Save as on a session
- **THEN** a version-2 JSON file with that `projectName` and the session's pin configuration is downloaded and the stored session keeps its original name

#### Scenario: Save as can be cancelled

- **WHEN** a user cancels the Save as editor
- **THEN** no file is downloaded and no project field changes

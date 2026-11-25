# Spec Delta

## MODIFIED Requirements

### Requirement: The global bar does not change routes, persistence, or pin configuration

Adding the bar and reserving rail space SHALL NOT change hash routing, data
fetches through `dataUrl()`, or the localStorage-only presentation preferences.
The version-2 share and project schemas gain only an optional shareable
project-name field and keep their version. Pin configuration, including that
field, remains shareable.

#### Scenario: Routes and subpaths are unchanged

- **WHEN** a route or version-2 shared link is opened under `/pincraft/`
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

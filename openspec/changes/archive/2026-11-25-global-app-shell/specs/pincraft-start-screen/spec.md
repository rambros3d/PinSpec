# Spec Delta

## MODIFIED Requirements

### Requirement: The sticky header keeps navigation and theme

The header SHALL remain sticky and SHALL keep the brand link, the `#presets`
anchor, a link to the About destination that replaces the former provenance
anchor, and the theme control. An export-preview anchor SHALL NOT be present.

#### Scenario: Header remains available

- **WHEN** the start screen is scrolled or opened at any supported viewport width
- **THEN** the header keeps the brand link, the Starter Chips anchor, the About link, and the theme control

#### Scenario: Export anchor is gone

- **WHEN** the header is inspected
- **THEN** it contains no `#export-preview` anchor

#### Scenario: Data Sources opens About

- **WHEN** the user activates the Data Sources or About navigation link
- **THEN** the About destination opens with the provenance information previously shown in the start-screen footer

### Requirement: The left action column provides five entry points

The action column SHALL expose New pinout MCU/Board, Open project, Import
`.ioc`, Import pinout.json, and Compare. New pinout MCU/Board SHALL navigate to
`#/catalog`; the other actions SHALL reuse their existing navigation, dialog,
and handoff paths without adding a new persisted field.

#### Scenario: New pinout MCU or board

- **WHEN** the user activates New pinout MCU/Board
- **THEN** the catalog route opens and the start screen keeps its inline quick search and board preset selector for direct use

#### Scenario: Board preset seeds a workspace

- **WHEN** the user selects a board preset from the start screen and its MCU is in the catalog
- **THEN** the preset state is handed to the workspace store and the workspace opens for that MCU

#### Scenario: Open project reveals recent local sessions

- **WHEN** the user activates Open project
- **THEN** the recent local sessions area is made visible and a listed session can be reopened in the workspace

#### Scenario: Open project with no recent sessions

- **WHEN** the user activates Open project and no recent session exists
- **THEN** the start screen shows the existing hint that opening a part creates a recent session in this browser

#### Scenario: Import pinout.json from the start screen

- **WHEN** the user selects a version-2 pinout JSON file and the project parser accepts it
- **THEN** the parsed state is handed to the workspace store and the workspace opens for its MCU identifier

#### Scenario: Invalid pinout JSON is reported in place

- **WHEN** the selected project file cannot be parsed
- **THEN** the start screen shows a readable inline error and does not navigate or change the current workspace

#### Scenario: Compare opens the read-only diff modal

- **WHEN** the user activates Compare from the start screen
- **THEN** the existing read-only pinout diff modal opens with two project file inputs and no workspace state is changed

## REMOVED Requirements

### Requirement: The provenance footer is retained

The start screen SHALL keep the technical footer with `id="provenance"` that
lists the seven upstream sources, their licenses, and the source revisions from
`meta.json`. The Data Sources navigation anchor SHALL continue to target that
footer.

**Reason**: Provenance is now presented by the About destination for every route, so the start screen no longer owns a full technical footer.

**Migration**: Use the About entry in the global sidebar or the Data Sources link in the start-screen header. The source records, licenses, revisions, and catalog statistics remain available there; no pin configuration is affected.

#### Scenario: Footer reports source provenance

- **WHEN** generated metadata is available on the start screen
- **THEN** the footer lists per-vendor chip counts, source revisions, and all seven source licenses

#### Scenario: Footer anchor resolves

- **WHEN** the user activates the Data Sources navigation link
- **THEN** the `provenance` footer is the scroll target inside `.landing-shell`

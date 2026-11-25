# project-naming Specification

## Purpose

Defines the generated short name of a workspace session: how it is composed, when it is created or reused, how it travels with shareable pin configuration, and how it is edited inline in the top bar and Projects cards.

## Requirements

### Requirement: New workspaces receive a generated project name

Every newly created workspace session SHALL receive a project name made of
exactly two curated words joined by `-`, chosen through an injectable RNG. The
generator SHALL NOT read any MCU fact. Existing saved names SHALL be reused
verbatim without regeneration.

#### Scenario: Generated name format

- **WHEN** a new workspace is created and the injected RNG selects `amber` and `quartz`
- **THEN** the project name is `amber-quartz` for every chip family and MCU

#### Scenario: Injected RNG is deterministic

- **WHEN** the same injected RNG sequence is used to create two workspaces
- **THEN** both workspaces receive the same two-word name without a host-level random source

#### Scenario: Family suffix falls back to the MCU identifier

- **WHEN** a generated chip has no family identifier and its MCU identifier is `RP2040`
- **THEN** the name is still two curated words and contains no `rp2040` suffix

#### Scenario: Name characters and length are bounded

- **WHEN** any project name is generated
- **THEN** it contains only lowercase letters, digits, and hyphens, is at most 48 characters long, and contains no emoji or color token

#### Scenario: Suffixes use only generated chip data

- **WHEN** new workspaces are created for STM32, CH32, RP, ESP32, Microchip, and Nordic chips
- **THEN** no family or MCU identifier appears in any generated name and no part table is consulted

#### Scenario: No chip facts enter generated names

- **WHEN** the project-name generator is called with any chip metadata
- **THEN** its output depends only on the injected RNG samples

#### Scenario: Saved names are not rewritten

- **WHEN** a session with the stored name `amber-quartz-stm32h5` is reopened
- **THEN** its project name remains `amber-quartz-stm32h5`

### Requirement: Existing project names are reused

A stored project name SHALL be reused without change when a session is reopened
from local storage, a version-2 share link, or a version-2 project file. Name
generation SHALL occur only when a workspace for that MCU is first created.
Returning to a previously saved MCU SHALL restore that session's name.

#### Scenario: Recent session keeps its name

- **WHEN** a saved session with a project name is reopened from the recent list
- **THEN** the workspace shows the stored name and no new name is generated

#### Scenario: Share link keeps its name

- **WHEN** a version-2 share link carrying a project name is opened
- **THEN** the hydrated workspace uses that name unchanged

#### Scenario: Project file keeps its name

- **WHEN** a version-2 project file carrying a project name is imported
- **THEN** the imported workspace uses that name unchanged

#### Scenario: Returning to a saved MCU reuses the name

- **WHEN** the user switches away from a saved MCU and later reopens that saved session
- **THEN** its original project name is restored

#### Scenario: A different MCU gets a new name

- **WHEN** the user opens a workspace for an MCU that has no saved session
- **THEN** a new generated project name is assigned

### Requirement: Project name is shareable workspace metadata

The project name SHALL be shareable pin-planning metadata, not a UI preference.
It SHALL be part of workspace history, the version-2 share URL payload, the
version-2 project file, and localStorage recent sessions. It SHALL remain
optional and omitted when absent, with no schema version bump. Payloads without
it SHALL load normally.

#### Scenario: Name round-trips through a share URL

- **WHEN** a workspace with a project name is encoded into a version-2 share link and decoded
- **THEN** the decoded workspace has the same name

#### Scenario: Name round-trips through a project file

- **WHEN** a workspace with a project name is exported to a version-2 project file and imported
- **THEN** the imported workspace has the same name

#### Scenario: Name changes are undoable

- **WHEN** a project name is committed and the user undoes and redoes the change
- **THEN** the name follows the workspace history like other pin configuration

#### Scenario: Absent name stays absent

- **WHEN** a version-2 share link or project file has no project-name field
- **THEN** it loads normally with no name and no generation is triggered by decoding

#### Scenario: Name is not a shell preference

- **WHEN** shell presentation preferences are written to browser-local storage
- **THEN** that preference record contains no project-name field while recent sessions keep the name

### Requirement: Project name is editable in the global top bar

On workspace and shared routes the global top bar SHALL show a compact
project-name pill next to the MCU pill. Clicking it SHALL switch to an inline
text input; Enter or blur SHALL commit a sanitized value, and Escape SHALL cancel
and restore the previous value. No modal or always-visible input SHALL be added,
and the bar height SHALL remain 48px.

#### Scenario: Pill is shown next to the MCU pill

- **WHEN** a workspace or shared route is open
- **THEN** the global top bar shows the project-name pill beside the MCU pill

#### Scenario: Click switches to an inline input

- **WHEN** the user clicks the project-name pill
- **THEN** an inline input replaces the pill with the current name selected and no modal opens

#### Scenario: Enter commits the name

- **WHEN** the user types a new name in the inline input and presses Enter
- **THEN** the sanitized value is committed to workspace state and the pill returns to its display form

#### Scenario: Blur commits the name

- **WHEN** the inline input loses focus without Escape
- **THEN** the same commit path runs as for Enter

#### Scenario: Escape cancels the edit

- **WHEN** the user presses Escape while the inline input has focus
- **THEN** the previous name is restored, the pill is shown again, and no dialog or popover opens

#### Scenario: Empty value removes the name

- **WHEN** the committed input sanitizes to an empty string
- **THEN** the project name is omitted from workspace state and the pill shows a neutral placeholder

### Requirement: Projects cards show and edit the project name

Each Projects card SHALL display the stored project name when present and SHALL
offer an inline rename control. The rename SHALL use the same sanitization and
commit path as the top-bar pill, and SHALL update the saved session and any
share or export derived from it. A card without a name SHALL show no error.

#### Scenario: Card displays the project name

- **WHEN** recent sessions include a named project and the Projects route is opened
- **THEN** that card shows the stored name alongside its MCU identifier and package details

#### Scenario: Inline rename commits on the card

- **WHEN** the user edits a name on a card and presses Enter or blurs the input
- **THEN** the saved session and any share link or project file derived from it carry the new name

#### Scenario: Inline rename cancels on the card

- **WHEN** the user presses Escape while editing a name on a card
- **THEN** the original name is kept and the card returns to its display form

#### Scenario: Card without a name

- **WHEN** a stored session has no project-name field
- **THEN** its card shows no name text and the inline rename control still accepts a new name

### Requirement: Naming stays within engineering constraints

Project naming SHALL NOT change generated MCU data, add a dependency, introduce
raw color literals or emojis, import Svelte or DOM APIs into pure core, change
hash routing or data URLs, or regress STM32 pin planning. The verification
commands SHALL pass with zero warnings.

#### Scenario: Core remains pure

- **WHEN** project-name helpers are imported into a host-side unit test
- **THEN** no Svelte or DOM module is required and the result depends only on its inputs

#### Scenario: No new data or dependency

- **WHEN** the change is reviewed
- **THEN** no package dependency, generated data file, or handwritten MCU fact is added

#### Scenario: No emoji or raw color

- **WHEN** changed source files are scanned
- **THEN** no emoji character appears and no color literal appears outside the vendored theme file

#### Scenario: Verification sequence passes

- **WHEN** `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` are run after implementation
- **THEN** all three exit zero with no build warnings and STM32 share links and project files remain readable

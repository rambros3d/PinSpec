# workspace-topbar-refinement Specification

## Purpose

Defines the workspace and shared top-bar layout after the refinement: the
left-edge project title, the retained MCU switcher pill, the inline editable
title, the canvas HUD find input, and the right-aligned workspace action cluster.

## Requirements

### Requirement: Workspace left edge shows the project title

On workspace and shared routes the global bar SHALL display the project name from
`workspaceStore.state.projectName` at the left edge, falling back to `Unnamed
project` or the chip id. It SHALL NOT render the chip id as a separate
`routeTitle` expression at that position.

#### Scenario: Named project title on workspace routes

- **WHEN** a workspace or shared route is opened for a project with a name
- **THEN** the left edge of the global bar shows that project name

#### Scenario: Fallback title when no name is set

- **WHEN** a workspace or shared route is opened without a project name
- **THEN** the left edge shows `Unnamed project` or the chip id through the same title control and no separate chip-id `routeTitle` is rendered

#### Scenario: Shell route titles are unchanged

- **WHEN** the home, catalog, projects, or about route is opened
- **THEN** the wordmark, route title, and section links keep their existing text and positions

### Requirement: The MCU switcher chip pill remains in the workspace action cluster

The chip-id MCU switcher button SHALL remain in the workspace and shared action
cluster after the title replacement, so MCU switching stays available from the
global bar.

#### Scenario: Chip pill retained beside the actions

- **WHEN** a workspace or shared route is opened with a loaded chip
- **THEN** the global bar still contains the chip-id switcher button between the left-edge title and Undo

#### Scenario: Chip pill still opens the switcher

- **WHEN** the user activates the chip-id switcher button
- **THEN** the same MCU switcher dialog opens and keeps its search and selection behavior

### Requirement: Project name is edited inline at the left edge

The left-edge title SHALL be an inline editable control. A click SHALL enter edit
mode, Enter or blur SHALL commit through the existing rename action, and Escape
SHALL cancel. Edit mode SHALL stay transient view state.

#### Scenario: Click enters edit mode

- **WHEN** the user clicks the left-edge project title
- **THEN** an input replaces the title with the current name selected

#### Scenario: Enter commits the draft

- **WHEN** the user types a new name and presses Enter while editing the title
- **THEN** the rename action commits the draft and the title shows the saved name

#### Scenario: Blur commits the draft

- **WHEN** the user types a new name and moves focus away from the title input
- **THEN** the rename action commits the draft

#### Scenario: Escape cancels the edit

- **WHEN** the user presses Escape while editing the title
- **THEN** the edit closes and the displayed name is unchanged

#### Scenario: Edit mode is not persisted

- **WHEN** a title edit is committed or cancelled
- **THEN** no editing flag enters localStorage, share URLs, project files, or recent sessions, while a committed name remains shareable project state

### Requirement: Pin and signal find lives in the package canvas HUD

The global bar SHALL NOT contain the pin and signal find input. The package
canvas HUD SHALL host that input with the same search state, clear control, and
pin-highlight behavior, and its focus callback SHALL serve the Ctrl+F shortcut.

#### Scenario: Find input is rendered in the canvas HUD

- **WHEN** a workspace or shared route is opened with a loaded chip
- **THEN** the package canvas HUD contains the find input labeled `Find pin or signal` and the global bar contains no find input

#### Scenario: Ctrl+F focuses and selects the HUD query

- **WHEN** the user presses Ctrl+F outside a text field in the workspace
- **THEN** the package canvas HUD find input is focused with its current query selected

#### Scenario: Matching pins stay highlighted

- **WHEN** the user enters a query in the HUD find input
- **THEN** matching pins remain highlighted on the package canvas with the same behavior as before the move

#### Scenario: Clearing the query works in the HUD

- **WHEN** the user activates the HUD clear control
- **THEN** the query is cleared and query-based pin highlights are removed

#### Scenario: HUD find is part of the canvas furniture

- **WHEN** the canvas measures furniture for the placement safe radius
- **THEN** the HUD find control is included in that measured furniture set

### Requirement: Workspace actions end at the right edge

On workspace and shared routes the bar SHALL right-align the actions after the
left-edge title with an auto margin before Undo, ending at Theme. Non-workspace
routes SHALL keep their existing controls and positions.

#### Scenario: Auto margin starts the action cluster

- **WHEN** a workspace or shared route is opened
- **THEN** an auto margin precedes Undo and the action cluster is aligned to the right edge

#### Scenario: Action cluster ends with Theme

- **WHEN** the workspace action cluster is inspected
- **THEN** Undo, Redo, Clear, Alternatives, Compare, Share, Export, and Theme are its trailing controls and Theme is the last control

#### Scenario: Rotate stays on the canvas

- **WHEN** the workspace action cluster is inspected
- **THEN** no Rotate control is introduced into the bar and the package canvas keeps its Rotate control

#### Scenario: Non-workspace controls stay in place

- **WHEN** a non-workspace route is opened
- **THEN** the wordmark, section links, Theme control, and Hotkeys control keep their existing positions

#### Scenario: Overflow scrolling is preserved

- **WHEN** the global bar controls do not fit the viewport
- **THEN** the row scrolls horizontally without widening the document and keeps the h-12 bar height

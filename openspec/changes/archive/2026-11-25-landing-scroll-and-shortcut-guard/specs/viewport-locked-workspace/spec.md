# Spec Delta

## MODIFIED Requirements

### Requirement: The document never scrolls

The workspace SHALL fit entirely within the visible viewport in both orientations. The root document SHALL NOT scroll or overscroll regardless of viewport size, dynamic mobile browser toolbar height, or content height. Individual panes and modal bodies SHALL scroll internally instead. The landing page is exempt from the document lock through its own scroll container: vertical landing content SHALL scroll inside that container while the root document and the workspace stay viewport-locked.

#### Scenario: Small viewport does not scroll the document

- **WHEN** the viewport is small or a mobile browser shows a dynamic toolbar and workspace content is taller than the visible area
- **THEN** the document does not scroll or overscroll and the workspace root remains sized to the visible viewport

#### Scenario: Internal panes scroll independently

- **WHEN** the user scrolls inside the peripheral tree, summary drawer, dock body, or a modal body
- **THEN** that content scrolls within its own container while the document stays fixed

#### Scenario: Landing page scrolls inside its own container

- **WHEN** landing page content is taller than the visible viewport on a short screen
- **THEN** the landing scroll container moves the content vertically inside the viewport and the root document does not scroll

#### Scenario: Landing scroll does not affect the workspace

- **WHEN** the user navigates from a scrolled landing page to a workspace route
- **THEN** the workspace root remains sized to the visible viewport and the document stays fixed

## ADDED Requirements

### Requirement: Workspace shortcuts are inactive while a dialog is open

Global workspace keyboard shortcuts SHALL NOT act while a native dialog is open. The guard SHALL cover the search, switcher, undo, redo, and fit-view shortcuts. Closing the dialog SHALL restore every shortcut with its prior behavior and without reloading the workspace. Dialog-native input and dialog Escape or cancel behavior SHALL continue to work.

#### Scenario: Shortcuts do not act behind an open dialog

- **WHEN** a native workspace dialog is open and the user presses Ctrl+F, Ctrl+K, Ctrl+Z, Ctrl+Y, or `0`
- **THEN** no workspace shortcut runs and the dialog keeps its focus

#### Scenario: Shortcuts resume after the dialog closes

- **WHEN** the dialog closes and the user presses one of the guarded shortcuts again
- **THEN** the workspace shortcut runs with its pre-dialog behavior

#### Scenario: Dialog input and cancel still work

- **WHEN** the user types in a dialog field or cancels the dialog with Escape
- **THEN** the dialog handles the input and closes without running a workspace shortcut

#### Scenario: Shortcuts still work with no dialog open

- **WHEN** no dialog is open and the user presses a workspace shortcut
- **THEN** the shortcut runs as before this change

# viewport-locked-workspace Specification

## Purpose

Defines a workspace layout that keeps pin planning inside the visible viewport in both landscape and portrait, with a tabbed portrait dock, internally scrolling panes, clamped floating overlays, and a persisted active dock tab.

## Requirements

### Requirement: The document never scrolls

The workspace SHALL fit entirely within the visible viewport in both
orientations, and the root document SHALL NOT scroll or overscroll at any
viewport size. Panes and modal bodies SHALL scroll internally. The home,
catalog, projects, and about routes SHALL scroll inside their own containers
while the root document and workspace stay viewport-locked. An expanded global
sidebar SHALL NOT create a document scrollbar or resize the workspace.

#### Scenario: Small viewport does not scroll the document

- **WHEN** the viewport is small or a mobile browser shows a dynamic toolbar and workspace content is taller than the visible area
- **THEN** the document does not scroll or overscroll and the workspace root remains sized to the visible viewport

#### Scenario: Internal panes scroll independently

- **WHEN** the user scrolls inside the peripheral tree, detail column, summary drawer, dock body, or a modal body
- **THEN** that content scrolls within its own container while the document stays fixed

#### Scenario: Landing page scrolls inside its own container

- **WHEN** landing page content is taller than the visible viewport on a short screen
- **THEN** the landing scroll container moves the content vertically inside the viewport and the root document does not scroll

#### Scenario: Landing scroll does not affect the workspace

- **WHEN** the user navigates from a scrolled landing page to a workspace route
- **THEN** the workspace root remains sized to the visible viewport and the document stays fixed

#### Scenario: Shell route scroll does not affect the workspace

- **WHEN** the user scrolls a catalog, projects, or about route and then opens a workspace route
- **THEN** the workspace root remains sized to the visible viewport and the document stays fixed

#### Scenario: Expanded sidebar does not introduce document scrolling

- **WHEN** the global sidebar is expanded over a workspace or a shell route
- **THEN** the root document neither scrolls nor widens and the underlying workspace keeps its viewport bounds

### Requirement: Orientation alone selects the layout

The system SHALL choose the layout from viewport orientation only, without
JavaScript orientation detection and without a width-only rule. Landscape
SHALL show the combined peripheral sidebar with its slim tree and detail
column, the pin canvas, and the summary drawer. Portrait SHALL show the pin
canvas and a bottom dock whose Peripherals tab presents the combined sidebar
side by side. A width change that does not change orientation SHALL NOT switch
layouts.

#### Scenario: Landscape shows three panes

- **WHEN** the workspace is opened in landscape
- **THEN** the combined sidebar with its tree and detail column, the pin canvas, and the summary drawer are all present in the three-pane arrangement

#### Scenario: Portrait shows the bottom dock

- **WHEN** the viewport orientation changes to portrait
- **THEN** the pin canvas remains and the peripheral tree, detail column, pin table, placement properties, diagnostics, DMA, and PIO content are presented through the bottom dock, with the tree and detail column side by side in the Peripherals tab

#### Scenario: Width-only resize does not change layout

- **WHEN** the viewport width changes while the orientation stays landscape
- **THEN** the layout remains the landscape three-pane arrangement

### Requirement: Portrait dock shows one tab at a time

Portrait SHALL present a single bottom dock whose tab set is Peripherals, Pins,
Diagnostics, DMA, PIO, and Audit. Only the selected tab's body SHALL be visible
at a time. The Peripherals tab SHALL show the combined sidebar with the
peripheral tree and detail column side by side. The dock SHALL occupy about 40
to 45 percent of the viewport height, and its body SHALL scroll internally when
its content exceeds that height.

#### Scenario: Selecting a tab changes the visible body

- **WHEN** the user selects a different dock tab in portrait
- **THEN** only the body of the selected tab is displayed and the previously selected body is hidden

#### Scenario: Configuration tab shows peripheral detail

- **WHEN** the user needs peripheral detail in portrait
- **THEN** the Peripherals dock tab shows the detail surface beside the tree and no Configuration tab is rendered

#### Scenario: Dock body scrolls internally

- **WHEN** the selected dock tab's content is taller than the dock body
- **THEN** the dock body scrolls within its own bounds and the document does not scroll

### Requirement: Pane resize handles are unavailable in portrait

The left and right pane resize handles SHALL be unavailable in the portrait
layout and SHALL remain available in landscape. The left resize handle SHALL
resize the combined sidebar subject to the tree width clamp and the detail
column minimum width, and the right resize handle SHALL resize the summary
drawer.

#### Scenario: Resize handles follow the layout

- **WHEN** the layout switches between landscape and portrait
- **THEN** the left and right pane resize handles are usable only in landscape

### Requirement: Toolbar stays within the viewport width

The top toolbar SHALL remain within the viewport width on narrow screens. Its
controls SHALL compact where possible and, when they do not fit, SHALL be
reachable through horizontal scrolling inside the toolbar. The toolbar SHALL
NOT widen the document.

#### Scenario: Narrow toolbar scrolls internally

- **WHEN** the viewport is too narrow for every toolbar control to fit
- **THEN** the toolbar stays within the viewport and its controls are reachable by scrolling the toolbar horizontally

#### Scenario: Toolbar cannot widen the document

- **WHEN** a long part number or many toolbar controls are present on a narrow viewport
- **THEN** the document width does not increase and no horizontal document scrollbar appears

### Requirement: Modals stay within the viewport

Every workspace modal SHALL have a maximum height no greater than the visible
viewport and SHALL scroll its content internally so that neither the dialog
nor its controls extend beyond the viewport.

#### Scenario: Tall modal content scrolls internally

- **WHEN** a modal's content is taller than the visible viewport in landscape or portrait
- **THEN** the modal stays within the viewport and its content scrolls inside the modal

### Requirement: Floating overlays are clamped to the viewport

Pin popovers and context menus SHALL remain floating overlays in both
orientations and SHALL be positioned so their full bounds lie inside the
visible viewport. When a computed position would place an overlay outside the
viewport, its coordinates SHALL be clamped so the overlay remains fully
visible. Portrait SHALL NOT replace these overlays with bottom sheets.

#### Scenario: Popover near an edge stays visible

- **WHEN** the user opens a pin popover near the right or bottom edge of the viewport
- **THEN** the popover is repositioned so its full bounds are inside the viewport

#### Scenario: Context menu near an edge stays visible

- **WHEN** the user opens a pin context menu near a viewport edge in portrait
- **THEN** the context menu remains a floating overlay and is repositioned to lie fully inside the viewport

### Requirement: Orientation changes preserve workspace state

Switching between landscape and portrait SHALL reposition the workspace
content without clearing pin assignments, labels, locks, peripheral modes,
diagnostics, placement preferences, or undo and redo history.

#### Scenario: Assignments survive an orientation change

- **WHEN** the viewport changes orientation after pins have been assigned and locked
- **THEN** every assignment, label, lock, peripheral mode, diagnostic, placement preference, and history entry remains intact

### Requirement: Active dock tab is persisted

The active portrait dock tab SHALL be stored only in browser localStorage as a
UI preference. It SHALL survive reload and localStorage session restoration,
and SHALL NOT be serialized into share URLs or project JSON. When the value is
absent or unknown it SHALL default to Peripherals. No layout preference SHALL
be carried in shareable pin configuration.

#### Scenario: Dock tab survives every persistence surface

- **WHEN** a workspace with a selected dock tab is saved to a localStorage session and reloaded in the same browser
- **THEN** the same dock tab is active, the share URL and project JSON contain no dock tab field, and all pin configuration is preserved

#### Scenario: Dock tab is not in a share link or project file

- **WHEN** a workspace with a selected dock tab is shared or exported to project JSON
- **THEN** neither the share URL payload nor the project JSON contains a dock tab field

#### Scenario: Absent dock tab defaults to Peripherals

- **WHEN** version-2 workspace state without a dock tab value is loaded
- **THEN** the Peripherals tab is active and existing pin configuration behavior is unchanged

#### Scenario: Legacy dock value is ignored

- **WHEN** an older share link or project file that contains a dock tab value is opened
- **THEN** it loads with the default Peripherals tab and its pin configuration is preserved

### Requirement: Theme presentation is preserved

All workspace layout surfaces SHALL use existing theme tokens, and all four
supported themes SHALL remain functional in both orientations. The layout
SHALL NOT introduce hardcoded colors.

#### Scenario: Theme switch in portrait

- **WHEN** the user switches between the supported themes while in portrait
- **THEN** the dock, combined sidebar, canvas, toolbar, and modals use the active theme's tokens and remain readable

### Requirement: Workspace shortcuts are inactive while a dialog is open

Global workspace keyboard shortcuts SHALL NOT act while a native dialog is
open. The guard SHALL cover the search, switcher, undo, redo, and fit-view
shortcuts. Closing the dialog SHALL restore every shortcut with its prior
behavior and without reloading the workspace. Dialog-native input and dialog
Escape or cancel behavior SHALL continue to work.

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

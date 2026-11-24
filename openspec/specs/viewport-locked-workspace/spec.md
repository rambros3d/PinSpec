# viewport-locked-workspace Specification

## Purpose

Defines a workspace layout that keeps pin planning inside the visible viewport in both landscape and portrait, with a tabbed portrait dock, internally scrolling panes, clamped floating overlays, and a persisted active dock tab.

## Requirements

### Requirement: The document never scrolls

The workspace SHALL fit entirely within the visible viewport in both orientations. The root document SHALL NOT scroll or overscroll regardless of viewport size, dynamic mobile browser toolbar height, or content height. Individual panes and modal bodies SHALL scroll internally instead.

#### Scenario: Small viewport does not scroll the document

- **WHEN** the viewport is small or a mobile browser shows a dynamic toolbar and workspace content is taller than the visible area
- **THEN** the document does not scroll or overscroll and the workspace root remains sized to the visible viewport

#### Scenario: Internal panes scroll independently

- **WHEN** the user scrolls inside the peripheral tree, summary drawer, dock body, or a modal body
- **THEN** that content scrolls within its own container while the document stays fixed

### Requirement: Orientation alone selects the layout

The system SHALL choose the layout from viewport orientation only, without JavaScript orientation detection and without a width-only rule. Landscape SHALL show three panes: peripheral tree, pin canvas, and summary drawer. Portrait SHALL show the pin canvas and a bottom dock. A width change that does not change orientation SHALL NOT switch layouts.

#### Scenario: Landscape shows three panes

- **WHEN** the workspace is opened in landscape
- **THEN** the peripheral tree, pin canvas, and summary drawer are all present in the three-pane arrangement

#### Scenario: Portrait shows the bottom dock

- **WHEN** the viewport orientation changes to portrait
- **THEN** the pin canvas remains and the peripheral tree, pin table, diagnostics, DMA, and PIO content are presented through the bottom dock

#### Scenario: Width-only resize does not change layout

- **WHEN** the viewport width changes while the orientation stays landscape
- **THEN** the layout remains the landscape three-pane arrangement

### Requirement: Portrait dock shows one tab at a time

Portrait SHALL present a single bottom dock with five tabs: Peripherals, Pins, Diagnostics, DMA, and PIO. Only the selected tab's body SHALL be visible at a time. The dock SHALL occupy approximately 40 to 45 percent of the visible viewport height, and its body SHALL scroll internally when its content exceeds that height.

#### Scenario: Selecting a tab changes the visible body

- **WHEN** the user selects a different dock tab in portrait
- **THEN** only the body of the selected tab is displayed and the previously selected body is hidden

#### Scenario: Dock body scrolls internally

- **WHEN** the selected dock tab's content is taller than the dock body
- **THEN** the dock body scrolls within its own bounds and the document does not scroll

### Requirement: Pane resize handles are unavailable in portrait

The left and right pane resize handles SHALL be unavailable in the portrait layout and SHALL remain available in landscape.

#### Scenario: Resize handles follow the layout

- **WHEN** the layout switches between landscape and portrait
- **THEN** the left and right pane resize handles are usable only in landscape

### Requirement: Toolbar stays within the viewport width

The top toolbar SHALL remain within the viewport width on narrow screens. Its controls SHALL compact where possible and, when they do not fit, SHALL be reachable through horizontal scrolling inside the toolbar. The toolbar SHALL NOT widen the document.

#### Scenario: Narrow toolbar scrolls internally

- **WHEN** the viewport is too narrow for every toolbar control to fit
- **THEN** the toolbar stays within the viewport and its controls are reachable by scrolling the toolbar horizontally

#### Scenario: Toolbar cannot widen the document

- **WHEN** a long part number or many toolbar controls are present on a narrow viewport
- **THEN** the document width does not increase and no horizontal document scrollbar appears

### Requirement: Modals stay within the viewport

Every workspace modal SHALL have a maximum height no greater than the visible viewport and SHALL scroll its content internally so that neither the dialog nor its controls extend beyond the viewport.

#### Scenario: Tall modal content scrolls internally

- **WHEN** a modal's content is taller than the visible viewport in landscape or portrait
- **THEN** the modal stays within the viewport and its content scrolls inside the modal

### Requirement: Floating overlays are clamped to the viewport

Pin popovers and context menus SHALL remain floating overlays in both orientations and SHALL be positioned so their full bounds lie inside the visible viewport. When a computed position would place an overlay outside the viewport, its coordinates SHALL be clamped so the overlay remains fully visible. Portrait SHALL NOT replace these overlays with bottom sheets.

#### Scenario: Popover near an edge stays visible

- **WHEN** the user opens a pin popover near the right or bottom edge of the viewport
- **THEN** the popover is repositioned so its full bounds are inside the viewport

#### Scenario: Context menu near an edge stays visible

- **WHEN** the user opens a pin context menu near a viewport edge in portrait
- **THEN** the context menu remains a floating overlay and is repositioned to lie fully inside the viewport

### Requirement: Orientation changes preserve workspace state

Switching between landscape and portrait SHALL reposition the workspace content without clearing pin assignments, labels, locks, peripheral modes, diagnostics, or undo and redo history.

#### Scenario: Assignments survive an orientation change

- **WHEN** the viewport changes orientation after pins have been assigned and locked
- **THEN** every assignment, label, lock, peripheral mode, diagnostic, and history entry remains intact

### Requirement: Active dock tab is persisted

The system SHALL store the active portrait dock tab as additive version-2 workspace data. It SHALL survive reload and round-trip through `localStorage` sessions, share URLs, and project JSON. When the value is absent it SHALL default to Peripherals. No layout preference SHALL be session-only.

#### Scenario: Dock tab survives every persistence surface

- **WHEN** a workspace with a selected dock tab is saved to a `localStorage` session, a share URL, and a project JSON file and then loaded from each
- **THEN** the same dock tab is active in every case

#### Scenario: Absent dock tab defaults to Peripherals

- **WHEN** version-2 workspace state without a dock tab value is loaded
- **THEN** the Peripherals tab is active and existing state behavior is unchanged

### Requirement: Theme presentation is preserved

All workspace layout surfaces SHALL use existing theme tokens, and all four supported themes SHALL remain functional in both orientations. The layout SHALL NOT introduce hardcoded colors.

#### Scenario: Theme switch in portrait

- **WHEN** the user switches between the supported themes while in portrait
- **THEN** the dock, canvas, toolbar, and modals use the active theme's tokens and remain readable

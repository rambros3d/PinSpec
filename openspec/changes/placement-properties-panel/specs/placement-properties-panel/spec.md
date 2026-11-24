# Spec Delta

## Purpose

Defines the right-hand properties surface used to manage pin-placement bubbles, the canvas-only boundary of the placement toggle, and the geometry rule that keeps the priority rings clear of canvas controls in the workspace.

## ADDED Requirements

### Requirement: Placement properties are edited in the right sidebar

The workspace SHALL present placement properties in a compact Place tab of the right-hand summary drawer in landscape and of the bottom dock in portrait. The placement rings, indicators, dragging, keyboard angle adjustment, and display rotation SHALL stay on the canvas; no floating placement properties panel SHALL be rendered on the canvas. The active tab SHALL be a UI preference stored in localStorage only.

#### Scenario: Place tab is available in both layouts

- **WHEN** a workspace is opened in landscape or portrait
- **THEN** a Place tab is present in the summary drawer tab strip or the portrait dock tab strip and opens the placement properties panel

#### Scenario: No floating canvas properties panel

- **WHEN** the placement overlay is enabled
- **THEN** rings and indicators are drawn on the canvas and per-peripheral placement properties appear only in the sidebar Place tab

#### Scenario: Active tab is a local preference

- **WHEN** the user selects the Place tab and the workspace is shared or exported
- **THEN** the active tab persists in localStorage and is absent from the share URL and project JSON

### Requirement: Placement toggle remains a canvas-only control

The placement ON/OFF toggle SHALL remain a bottom-centre canvas control. The sidebar Place tab SHALL NOT contain an ON/OFF toggle for the overlay. Before placement is enabled on the canvas the panel SHALL show guidance to enable it from the canvas; once enabled, the panel controls SHALL be active.

#### Scenario: Toggle is only on the canvas

- **WHEN** the user opens the Place tab
- **THEN** no placement ON/OFF toggle is present in the sidebar and the only ON/OFF control is the bottom-centre canvas toggle

#### Scenario: Panel activates after canvas enable

- **WHEN** the user enables placement with the canvas toggle
- **THEN** the Place tab controls become active and reflect the configured peripherals

#### Scenario: Panel is inactive before enable

- **WHEN** placement has not been enabled on the canvas
- **THEN** the Place tab shows guidance to use the canvas toggle and its bubble controls are inactive

### Requirement: Panel lists configured peripherals with bubble controls

The placement panel SHALL list only configured peripherals, defined as those holding at least one assignment or a selected mode other than disabled, using the configured partition derived from solver status and modes. Each listed peripheral SHALL offer an enable or disable control for its placement bubble. Enabling SHALL store a default preference with angle 0, ring low, and enabled true. Disabling SHALL leave no enabled preference so allocation uses the scarcity-only path.

#### Scenario: Configured peripherals are listed

- **WHEN** the Place tab opens for a workspace with configured and unconfigured peripherals
- **THEN** only peripherals with an assignment or a non-disabled mode appear and unconfigured peripherals are absent

#### Scenario: Enable creates a default low-ring bubble

- **WHEN** the user enables the placement bubble for a listed configured peripheral without a preference
- **THEN** a preference with angle 0, ring low, and enabled true is stored and an indicator is drawn on the low ring

#### Scenario: Disable falls back to scarcity-only allocation

- **WHEN** the user disables the placement bubble for a listed peripheral
- **THEN** no enabled preference remains for that peripheral and its pins are allocated by the scarcity-only path

### Requirement: Bubble movement reallocates through preview and commit

Moving a placement bubble between the priority circles SHALL reallocate pins in real time through the existing preview and commit path. Intermediate positions SHALL update assignments without creating undo entries, release SHALL commit one undoable preference change, and the panel SHALL reflect the stored ring. Pins the user locked SHALL keep their assignments.

#### Scenario: Live reallocation during a bubble move

- **WHEN** the user moves a bubble from one priority circle to another
- **THEN** the affected peripheral's pin assignments update continuously during the move

#### Scenario: Single commit on release

- **WHEN** the user releases a bubble after moving it through intermediate positions
- **THEN** one preference change is recorded in undo history and the panel shows the resulting ring

#### Scenario: Locked pins survive a bubble move

- **WHEN** a bubble moves past pins that the user locked
- **THEN** those pins keep their assignments throughout the move

### Requirement: Outer ring uses a safe maximum radius

The placement overlay SHALL size its outer ring as large as the canvas permits without overlapping the reserved rectangles of the view HUD, remap banner, bottom-centre placement toggle, semantic legend, interaction hint, and workspace canvas buttons. The ring centre SHALL remain at the package or stage centre. A pure helper SHALL compute the radius from measured rectangles, and transient overlays SHALL NOT constrain it.

#### Scenario: Outer ring clears reserved rectangles

- **WHEN** the overlay is drawn with measured canvas furniture rectangles
- **THEN** the outer ring radius is the largest value that does not intersect any reserved rectangle and the centre remains at the stage centre

#### Scenario: Pure radius helper is host-testable

- **WHEN** the radius helper is called with plain numbers in a host-side unit test
- **THEN** it returns a finite radius without importing Svelte or browser APIs

#### Scenario: Transient overlays do not shrink the ring

- **WHEN** a tooltip, popover, or context menu is visible
- **THEN** the outer ring radius is unchanged because transient overlays are not reserved rectangles

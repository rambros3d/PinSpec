# workspace-control-interaction Specification

## Purpose

Defines which pointer interactions own canvas panning and which belong to the
DOM controls layered over the canvas.

## Requirements

### Requirement: Canvas pan capture does not intercept overlay controls

The package canvas SHALL call `setPointerCapture()` for a primary or middle
pointer-down only when the pressed target is the stage background or part of
the transformed SVG package surface and is not a pin hit target. DOM overlays
rendered as children of the stage SHALL keep their own pointer and click
behavior.

#### Scenario: Canvas HUD buttons activate their actions

- **WHEN** the user clicks Zoom In, Zoom Out, Fit View, Rotate, the placement
  toggle, or the placement ring rotation control in the canvas HUD
- **THEN** the corresponding canvas action runs and no pan gesture captures the
  pointer

#### Scenario: Find input and clear control remain usable

- **WHEN** the user clicks the find input and types a query, then activates the
  clear control
- **THEN** the query is set and cleared and matching pins are highlighted and
  unhighlighted

#### Scenario: Pin popover and context menu actions commit

- **WHEN** the user activates an assignment, lock, clear, alternate, or remap
  action in the pin popover or pin context menu
- **THEN** the corresponding workspace store action runs and the overlay closes
  where its existing behavior closes it

#### Scenario: Remap banner cancel is reachable

- **WHEN** the user activates Cancel in the remap banner
- **THEN** remap mode is cancelled without starting a canvas pan and the banner
  control is not overlapped by the zoom HUD

#### Scenario: Background drag still pans

- **WHEN** the user drags the stage background or the SVG package body with the
  primary button
- **THEN** the view pans as before

### Requirement: Summary drawer collapse control is reachable

On landscape layouts the summary drawer collapse control SHALL occupy a screen
region that is not overlapped by the canvas find HUD.

#### Scenario: Collapse and restore the drawer

- **WHEN** the user activates the summary drawer collapse control while the
  find HUD is visible
- **THEN** the drawer collapses and reactivating the control restores it

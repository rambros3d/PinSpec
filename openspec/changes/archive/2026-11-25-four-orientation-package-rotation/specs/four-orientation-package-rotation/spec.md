# Spec Delta

## Purpose

Defines four clockwise package orientations and the rendering and persistence rules that keep pin labels readable, package bounds intact, and the placement-rings control distinct from package rotation.

## ADDED Requirements

### Requirement: Rotate controls expose the placement-rings action separately

The placement overlay SHALL have its own rotate control that is visually and textually distinct from the package rotate controls. Its label or tooltip SHALL contain the word Rings, and it SHALL use an icon different from the package rotate icon. Activating it SHALL rotate only the placement overlay; package rotation, pin geometry, placement scoring, and assignments SHALL stay unchanged.

#### Scenario: Rings control is identifiable

- **WHEN** the placement overlay is visible in the workspace
- **THEN** its rotate control uses an icon different from the package rotate icon and its label or tooltip contains Rings

#### Scenario: Rings control does not rotate the package

- **WHEN** the user activates the placement-rings rotate control
- **THEN** only the overlay rings and indicators rotate while package orientation, pin geometry, stored angles, and assignments remain unchanged

#### Scenario: Package control does not rotate the rings

- **WHEN** the user activates a package rotate control while the overlay is visible
- **THEN** package orientation advances and the placement overlay rotation stays unchanged

### Requirement: Label angle is derived from the displayed pin side

For every orientation the rendered angle of each pin label SHALL be derived from the side where that pin appears after rotation. Pins displayed on left or right edges SHALL use 0-degree horizontal text. Pins displayed on top or bottom edges SHALL use -90-degree vertical text that reads upward and rightward. No label, position number, tag, header, or marking SHALL render upside down.

#### Scenario: Side is re-derived after rotation

- **WHEN** a pin originally on a left or right edge moves to a top or bottom edge after rotation
- **THEN** that pin's label uses -90-degree vertical text based on its displayed side rather than 0-degree text based on its original side

#### Scenario: Side is re-derived after further rotation

- **WHEN** a pin originally on a top or bottom edge moves to a left or right edge after further rotation
- **THEN** that pin's label uses 0-degree horizontal text based on its displayed side

#### Scenario: Vertical text reads upward and rightward

- **WHEN** a pin is displayed on a top or bottom edge at any orientation
- **THEN** its vertical text reads upward and rightward and is not inverted

#### Scenario: Markings survive all orientations

- **WHEN** a package with bonded names, signal tags, vendor mux labels, grid row and column headers, centre markings, or an exposed pad is shown at 90, 180, or 270 degrees
- **THEN** every marking remains present, upright, and readable with theme-supplied text styling

#### Scenario: Pin interaction survives all orientations

- **WHEN** the user clicks, right-clicks, or hovers a pin at any orientation
- **THEN** the same popover, tooltip, or context menu opens for that physical pin as in the unrotated state

### Requirement: Rectangular packages keep their rotated bounds

At 90 and 270 degrees the package SVG SHALL declare width and height swapped relative to the unrotated extents while its viewBox continues to match the rotated geometry. Manual zoom, pan, and fit view SHALL use the rotated extents so that no part of a non-square package is clipped.

#### Scenario: SVG extents swap at right-angle orientations

- **WHEN** a rectangular package is rendered at 90 or 270 degrees
- **THEN** the SVG width equals the unrotated height and the SVG height equals the unrotated width

#### Scenario: Viewbox remains consistent

- **WHEN** the SVG extents are swapped for a rotated package
- **THEN** the viewBox still covers the rotated geometry and content is not shifted or cropped

#### Scenario: Fit view compensates for rotated extents

- **WHEN** the user activates fit view for a non-square package at 90 or 270 degrees
- **THEN** the zoom and pan are derived from the swapped extents and the full rotated package fits inside the stage

#### Scenario: Manual zoom and pan do not clip

- **WHEN** the user manually zooms and pans a rectangular package at 90 or 270 degrees
- **THEN** the full package body and all pin bounds stay within the declared SVG extents

### Requirement: Legacy rotation values normalize to the four-value domain

Every decode boundary SHALL accept rotation values 0, 90, 180, and 270 and SHALL map a legacy value of -90 to 270 so prior persisted and shared states keep their visual orientation. Any other value SHALL normalize to 0. An absent rotation field SHALL remain absent on encode and behave as 0.

#### Scenario: Legacy share link rotates to 270

- **WHEN** a share link carries a rotation value of -90
- **THEN** the loaded workspace uses 270 degrees and displays the same orientation as before this capability

#### Scenario: Legacy project file rotates to 270

- **WHEN** a version-2 project file carries a rotation value of -90
- **THEN** the imported workspace uses 270 degrees and its pin configuration is unchanged

#### Scenario: Legacy session and history values rotate to 270

- **WHEN** a recent session or a history snapshot carries a rotation value of -90
- **THEN** the effective rotation is 270 degrees and undo and redo compare the normalized value

#### Scenario: Unrecognized values normalize to zero

- **WHEN** any decode surface carries a rotation value other than 0, 90, 180, 270, or legacy -90
- **THEN** the effective rotation is 0 and the rest of the state still loads

#### Scenario: Absent rotation remains absent

- **WHEN** a workspace without a rotation field is encoded for sharing or exported as a project file
- **THEN** no rotation field appears in the result and the effective rotation is 0

# Spec Delta

## MODIFIED Requirements

### Requirement: Package rotation has two states

The package rotation SHALL be one of four clockwise orientations: 0, 90, 180, or 270 degrees. A single activation of a package rotate control SHALL advance the orientation by 90 degrees clockwise, wrapping from 270 to 0. No reverse rotation control SHALL be available. No other rotation value SHALL be selectable through the toolbar or canvas controls.

#### Scenario: Toggle from the default state

- **WHEN** the user activates the rotate control while the package is at 0 degrees
- **THEN** the package renders at 90 degrees and the control reports 90 degrees

#### Scenario: Toggle back to the default state

- **WHEN** the user activates the rotate control while the package is at 270 degrees
- **THEN** the package renders at 0 degrees and the control reports 0 degrees

#### Scenario: Repeated toggles stay within the two states

- **WHEN** the user activates the rotate control repeatedly
- **THEN** the reported value is always one of 0, 90, 180, or 270 degrees

### Requirement: Labels remain upright in both rotation states

When a package is rotated, geometry SHALL rotate to the active orientation while pin names, position numbers, signal tags, grid headers, centre markings, and exposed-pad markings stay upright and readable in screen space. Each label angle SHALL follow the pin's displayed side: 0 degrees on left and right edges, -90 degrees reading upward and rightward on top and bottom edges. Rotation SHALL NOT change pin colors, status fills, highlights, bonded-pin rendering, or pointer targets.

#### Scenario: Perimeter package at -90 degrees

- **WHEN** a perimeter package is shown at any non-zero orientation
- **THEN** the pads and body are rotated while every pin name, position number, and signal tag is readable with horizontal text on left and right edges and vertical text on top and bottom edges

#### Scenario: Grid package at -90 degrees

- **WHEN** a grid package is shown at any non-zero orientation
- **THEN** the ball matrix is rotated while its row headers, column headers, ball labels, and footer remain readable with upright text

#### Scenario: Pin interaction follows the rotated geometry

- **WHEN** the user clicks or hovers a pin after rotation
- **THEN** the same popover, tooltip, or context menu opens for that physical pin as in the unrotated state

### Requirement: Rotation is additive version-2 state

Rotation SHALL be stored in version-2 workspace state as an optional field named `packageRotation` whose valid non-absent values are 0, 90, 180, and 270. An absent value SHALL behave as 0 and SHALL serialize identically to the same workspace before this capability. A legacy value of -90 SHALL normalize to 270. Any other unrecognized value SHALL normalize to 0.

#### Scenario: Existing state stays byte-identical

- **WHEN** a workspace state without `packageRotation` is cloned, encoded for sharing, or exported as a project file
- **THEN** no rotation field appears in the result and the effective rotation is 0

#### Scenario: Untrusted rotation values are normalized

- **WHEN** persisted state, a share link, or a project file contains a rotation value other than 0, 90, 180, 270, or legacy -90
- **THEN** the effective rotation is 0 and the rest of the state is still loaded

### Requirement: Rotation survives every persistence path

The effective rotation SHALL survive reload through recent-session `localStorage`, share links, version-2 project files, and undo/redo history. Changing rotation SHALL create one history entry and SHALL NOT alter assignments, labels, locks, peripheral modes, remap selections, PIO bindings, or diagnostics.

#### Scenario: Rotation survives reload

- **WHEN** the user rotates a package and reloads the workspace for that MCU
- **THEN** the package opens at the same rotation from the saved recent session

#### Scenario: Share link round trip

- **WHEN** a rotated workspace is shared and the resulting link is opened
- **THEN** the loaded workspace has the same rotation among the four supported values and the same assignments

#### Scenario: Project file round trip

- **WHEN** a rotated workspace is exported to a version-2 project file and imported again
- **THEN** the imported workspace has the same rotation among the four supported values and the same pin configuration

#### Scenario: Undo and redo rotation

- **WHEN** the user cycles rotation and then undoes and redoes the change
- **THEN** the rotation returns to the previous state and back without changing any pin data

### Requirement: Existing canvas behavior is preserved

Pointer pan, fit view, pin focus, hover tooltips, the placement overlay, overlay clamping, theme tokens, and vendor-correct mux labels SHALL keep their existing behavior in all four rotation states and across the supported zoom range. At 90 and 270 degrees the renderer SHALL swap SVG width and height and compensate fit view for the rotated extents so a non-square package is not clipped.

#### Scenario: Fit view with a rotated package

- **WHEN** the user activates fit view for a rotated non-square package at 90 or 270 degrees
- **THEN** the full rotated package fits inside the stage without clipping

#### Scenario: Existing source contracts still hold

- **WHEN** the canvas and package renderers are checked against the existing layout, theme, and multi-vendor rendering contracts
- **THEN** the document lock, highlight set, token, bonded-pin, exposed-pad, and mux-label assertions remain satisfied

## ADDED Requirements

### Requirement: Package rotate controls share one clockwise cycle

Every package rotate control SHALL advance the same clockwise cycle and SHALL report the active orientation in its accessible label or tooltip. The placement overlay rotate control SHALL remain a separate control with its own Rings identification.

#### Scenario: Toolbar and canvas controls advance together

- **WHEN** the user activates the toolbar rotate control and then the canvas rotate control
- **THEN** the reported orientation advances from 0 to 90 and then to 180 degrees

#### Scenario: Control text reflects clockwise rotation

- **WHEN** the active orientation is any value other than 0
- **THEN** the rotate control label or tooltip describes clockwise rotation at that orientation rather than a counter-clockwise restore action

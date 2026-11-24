# canvas-gesture-and-rotation Specification

## Purpose

Defines how the package canvas turns wheel, trackpad, touch pinch, and Safari gesture input into package zoom, and how a two-state counter-clockwise package rotation stays readable and persists with workspace settings.

## Requirements

### Requirement: The canvas owns zoom input

The package canvas SHALL consume wheel, ctrl/meta wheel, two-pointer touch pinch, and Safari gesture events as zoom input. It SHALL prevent the document from scrolling or zooming for those inputs. Plain wheel input SHALL use the existing discrete zoom step; ctrl/meta wheel input SHALL use a finer step derived from the wheel delta. Touch input over the stage SHALL NOT pan or zoom the document.

#### Scenario: Wheel zooms the package instead of the page

- **WHEN** the user scrolls the wheel over the package stage
- **THEN** the package zoom changes by the existing discrete step and the document does not scroll or zoom

#### Scenario: Trackpad pinch zooms through ctrl/meta wheel

- **WHEN** the browser reports a ctrl- or meta-modified wheel event over the stage
- **THEN** the package zoom changes by a smaller step proportional to the wheel delta and the document does not zoom

#### Scenario: Safari gesture zooms the package

- **WHEN** Safari reports a gesture start or gesture change over the stage
- **THEN** the package zoom follows the gesture scale and the page zoom level is unchanged

### Requirement: Pinch zoom is cursor-centred on the midpoint

A two-pointer pinch SHALL convert the change in distance between the two pointers into a zoom factor applied around their midpoint, using the same cursor-centred zoom behavior and the same zoom limits as wheel zoom. Lifting a pointer or adding a third pointer SHALL reset the pinch baseline without a sudden zoom jump.

#### Scenario: Fingers spread apart

- **WHEN** two pointers on the stage move farther apart
- **THEN** the package zooms in and the content under the pinch midpoint stays at that midpoint

#### Scenario: Fingers move together

- **WHEN** two pointers on the stage move closer together
- **THEN** the package zooms out within the supported zoom limits and the content under the pinch midpoint stays at that midpoint

#### Scenario: Pointer count changes during a pinch

- **WHEN** a pointer is lifted or a third pointer touches the stage during a pinch
- **THEN** the pinch baseline is re-established from the remaining pointers without a discontinuity in zoom or pan

### Requirement: Package rotation has two states

The package rotation SHALL be either 0 degrees or -90 degrees counter-clockwise. A single activation of the rotate control SHALL alternate between those two states. No other rotation value SHALL be selectable through the toolbar or canvas controls.

#### Scenario: Toggle from the default state

- **WHEN** the user activates the rotate control while the package is at 0 degrees
- **THEN** the package renders at -90 degrees and the control reports -90 degrees

#### Scenario: Toggle back to the default state

- **WHEN** the user activates the rotate control while the package is at -90 degrees
- **THEN** the package renders at 0 degrees and the control reports 0 degrees

#### Scenario: Repeated toggles stay within the two states

- **WHEN** the user activates the rotate control repeatedly
- **THEN** the reported value is always either 0 or -90 degrees

### Requirement: Labels remain upright in both rotation states

When the package is rotated, the package geometry SHALL rotate while pin names, pin position numbers, signal tags, grid row and column headers, centre markings, and exposed-pad markings remain upright and readable in screen space. Rotation SHALL NOT change pin colors, status fills, highlight treatment, bonded-pin rendering, or the pointer targets used for pin selection.

#### Scenario: Perimeter package at -90 degrees

- **WHEN** a perimeter package is shown at -90 degrees
- **THEN** the pads and body are rotated while every pin name, position number, and signal tag is readable without sideways text

#### Scenario: Grid package at -90 degrees

- **WHEN** a grid package is shown at -90 degrees
- **THEN** the ball matrix is rotated while its row headers, column headers, ball labels, and footer remain readable

#### Scenario: Pin interaction follows the rotated geometry

- **WHEN** the user clicks or hovers a pin after rotation
- **THEN** the same popover, tooltip, or context menu opens for that physical pin as in the unrotated state

### Requirement: Rotation is additive version-2 state

Rotation SHALL be stored in version-2 workspace state as an optional field named `packageRotation` whose only valid non-absent value is -90. An absent or unrecognized value SHALL normalize to 0. A workspace without the field SHALL serialize identically to the same workspace before this capability.

#### Scenario: Existing state stays byte-identical

- **WHEN** a workspace state without `packageRotation` is cloned, encoded for sharing, or exported as a project file
- **THEN** no rotation field appears in the result and the effective rotation is 0

#### Scenario: Untrusted rotation values are normalized

- **WHEN** persisted state, a share link, or a project file contains a rotation value other than -90
- **THEN** the effective rotation is 0 and the rest of the state is still loaded

### Requirement: Rotation survives every persistence path

The effective rotation SHALL survive reload through recent-session `localStorage`, share links, version-2 project files, and undo/redo history. Changing rotation SHALL create one history entry and SHALL NOT alter assignments, labels, locks, peripheral modes, remap selections, PIO bindings, or diagnostics.

#### Scenario: Rotation survives reload

- **WHEN** the user rotates a package and reloads the workspace for that MCU
- **THEN** the package opens at the same rotation from the saved recent session

#### Scenario: Share link round trip

- **WHEN** a rotated workspace is shared and the resulting link is opened
- **THEN** the loaded workspace has the same rotation and assignments

#### Scenario: Project file round trip

- **WHEN** a rotated workspace is exported to a version-2 project file and imported again
- **THEN** the imported workspace has the same rotation and pin configuration

#### Scenario: Undo and redo rotation

- **WHEN** the user toggles rotation and then undoes and redoes the change
- **THEN** the rotation returns to the previous state and back without changing any pin data

### Requirement: Existing canvas behavior is preserved

Pointer pan, fit view, pin focus, hover tooltips, the placement overlay, overlay clamping, theme tokens, and vendor-correct mux labels SHALL keep their existing behavior in both rotation states and across the supported zoom range.

#### Scenario: Fit view with a rotated package

- **WHEN** the user activates fit view for a rotated non-square package
- **THEN** the full rotated package fits inside the stage without clipping

#### Scenario: Existing source contracts still hold

- **WHEN** the canvas and package renderers are checked against the existing layout, theme, and multi-vendor rendering contracts
- **THEN** the document lock, highlight set, token, bonded-pin, exposed-pad, and mux-label assertions remain satisfied

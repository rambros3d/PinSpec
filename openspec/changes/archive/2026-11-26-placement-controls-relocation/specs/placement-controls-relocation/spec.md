# Spec Delta

## ADDED Requirements

### Requirement: Placement rings follow enabled bubbles

Placement rings SHALL be visible on the canvas exactly when at least one
configured peripheral has an enabled placement bubble. Disabling the last bubble
SHALL hide the rings. No separate overlay-visibility preference or canvas toggle
SHALL remain.

#### Scenario: First bubble shows rings

- **WHEN** a placement bubble is enabled in the Placement tab
- **THEN** high, medium, and low rings appear around the IC

#### Scenario: Last bubble hides rings

- **WHEN** the last enabled bubble is disabled
- **THEN** no placement rings are drawn

### Requirement: Rotate placements lives in the panel

The Placement tab SHALL host a `Rotate placements` control that advances
`placementOverlayRotation` by 90 degrees per activation. It SHALL be disabled
when no bubble is enabled and SHALL state that it moves bubbles relative to the
IC. The canvas rotate button SHALL continue to rotate the IC itself.

#### Scenario: Rotate bubbles only

- **WHEN** the Rotate placements button is activated
- **THEN** bubble positions rotate 90 degrees relative to the IC and the package rotation is unchanged

#### Scenario: No bubbles disables rotation

- **WHEN** no placement bubble is enabled
- **THEN** the Rotate placements button is disabled with an explanatory title

### Requirement: Find bar is top-left on the canvas

The pin/signal find bar SHALL be positioned at `absolute top-14 left-3` on the
canvas. Its search input, match count, clear control, `Ctrl+F` focus
registration, and keyboard shortcut SHALL remain unchanged.

#### Scenario: Find bar location

- **WHEN** a workspace canvas renders
- **THEN** the find bar occupies the top-left canvas area and the top-right area is reserved for zoom and package rotation controls

#### Scenario: Search behavior is unchanged

- **WHEN** Ctrl+F is pressed or the find input is cleared
- **THEN** the same input focus and search state transitions occur as before the move

### Requirement: Placement persistence split is bubble-based

Bubble angle, ring, and enabled state plus overlay rotation SHALL remain
shareable version-2 workspace data. The active drawer and dock tabs SHALL remain
localStorage-only. No overlay-visibility field SHALL exist in localStorage,
share URLs, or project files.

#### Scenario: Shareable placement data

- **WHEN** a workspace with bubbles and rotated overlays is shared or exported
- **THEN** the payload contains bubble fields and overlay rotation and contains no overlay-visibility or tab field

#### Scenario: No stale overlay key

- **WHEN** preferences are read after reload
- **THEN** no `placementOverlayVisible` value is read or written

# Spec Delta

## MODIFIED Requirements

### Requirement: Opening the Placement tab activates the overlay

Selecting the Placement tab in either orientation SHALL set the placement
overlay to visible without requiring the canvas toggle. The canvas top-left
toggle SHALL remain available for quick access and SHALL continue to show and
hide the overlay.

#### Scenario: Opening the tab shows the rings

- **WHEN** the user selects the Placement tab while the placement overlay is hidden
- **THEN** the overlay becomes visible and the priority rings and enabled bubbles are drawn on the package canvas

#### Scenario: Canvas toggle remains available

- **WHEN** the user clicks the canvas top-left placement toggle
- **THEN** the overlay hides or shows without changing any bubble preference, and showing the overlay also selects the Placement tab in the right drawer or portrait dock

#### Scenario: Leaving the Placement tab hides the overlay

- **WHEN** the user moves away from the Placement tab to another drawer or dock tab, or closes the drawer while that tab is active
- **THEN** the overlay is hidden unless the user explicitly re-enabled it with the canvas toggle, and no bubble preference is changed

#### Scenario: Overlay visibility is a local preference

- **WHEN** the overlay is activated by the Placement tab and the workspace is reloaded in the same browser
- **THEN** the overlay visibility is restored from localStorage and is absent from share URLs and project JSON

#### Scenario: Canvas toggle activation is local only

- **WHEN** the canvas toggle selects the Placement tab and the workspace is reloaded in the same browser
- **THEN** the tab and overlay are restored from localStorage and no tab or overlay field appears in a share URL or project file

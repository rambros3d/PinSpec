# Spec Delta

## Purpose

Defines the adjacent left-pane workspace surface that combines the peripheral
tree, the peripheral detail column, and the Place section, including their
width behavior, tree row encoding, placement bubble controls, and the boundary
that keeps overlay activation on the canvas.

## ADDED Requirements

### Requirement: The combined sidebar keeps navigation and detail adjacent

The workspace SHALL present the peripheral tree and the peripheral detail
column side by side in the left pane. The detail column SHALL host the
peripheral detail surface and the Place section. The tree SHALL use a 160px
default width clamped to 120-240px, and the detail column SHALL keep a minimum
width of 260-320px. In narrow landscape viewports the combined sidebar SHALL
keep its minimum combined width instead of collapsing either column.

#### Scenario: Default sidebar widths

- **WHEN** a landscape workspace opens with default preferences
- **THEN** the tree is 160px wide clamped to 120-240px and the detail column keeps a minimum of 260-320px

#### Scenario: Narrow landscape keeps the combined minimum

- **WHEN** the landscape viewport is too narrow for the tree, detail column, and right drawer at their preferred widths
- **THEN** the combined sidebar keeps its minimum combined width and the canvas shrinks without auto-collapsing the tree or detail column

#### Scenario: Selecting a row updates the detail column

- **WHEN** a peripheral row is activated in the tree
- **THEN** the detail column shows that peripheral and the row keeps a selection highlight with no placement or selection marker added to the row content

#### Scenario: One combined sidebar instance per layout

- **WHEN** the workspace is shown in landscape or the Peripherals dock tab is shown in portrait
- **THEN** one tree, one detail column, one canvas, and one right drawer are mounted and the same combined sidebar instance serves both orientations

### Requirement: Tree rows encode status and mode with one circle

Each peripheral row SHALL show only a status circle and the peripheral name.
The circle hue SHALL encode solver status as neutral, success, warning, or
error, and its fill SHALL encode mode present versus disabled or absent. The
exact status and mode state SHALL be exposed through `title` and `aria-label`.
Rows SHALL NOT render an inline mode label, a placement marker, a selection
marker, a signal toggle, a mode selector, a remap selector, or a tag pill.

#### Scenario: Status hue encodes solver status

- **WHEN** a peripheral has a neutral, active, partial, or error solver status
- **THEN** its circle uses the neutral, success, warning, or error hue respectively

#### Scenario: Fill encodes mode state

- **WHEN** a peripheral has a selected mode and another peripheral has a disabled or absent mode
- **THEN** the first circle is filled and the second circle is hollow

#### Scenario: Exact state is available to assistive technology

- **WHEN** a user focuses or hovers a peripheral row
- **THEN** the row exposes its exact status and mode state through `title` and `aria-label`

#### Scenario: No placement or selection marker in the tree

- **WHEN** a peripheral has an enabled placement bubble or is selected in the tree
- **THEN** the row shows only its status circle and name, with selection expressed solely as a row highlight and placement expressed only on the canvas and in the Place section

### Requirement: Peripheral detail is edited in the combined sidebar

The peripheral detail surface SHALL be hosted in the combined sidebar detail
column and SHALL keep the existing mode, signal, and remap commit behavior. The
Configuration tab SHALL be absent from the right drawer tab strip and from the
portrait dock tab strip. The right drawer SHALL retain its remaining tabs, and
the portrait Peripherals tab SHALL show the tree and detail column side by side
rather than stacked.

#### Scenario: Detail opens beside the tree

- **WHEN** a peripheral row is activated
- **THEN** the combined sidebar detail column shows the detail surface for that peripheral next to the tree

#### Scenario: Commit behavior is unchanged

- **WHEN** a mode, signal, or remap is changed in the detail surface
- **THEN** the same workspace commit and diagnostics path runs as before the detail surface moved

#### Scenario: Configuration tab is removed from the drawer and dock

- **WHEN** the right drawer or portrait dock tab strip is rendered
- **THEN** no Configuration tab is present and the remaining drawer and dock tabs stay reachable

#### Scenario: Portrait shows tree and detail side by side

- **WHEN** the Peripherals dock tab is active in portrait
- **THEN** the dock shows the tree and detail column beside each other in the combined sidebar and never stacked vertically

### Requirement: The Place section manages placement bubbles

The combined sidebar detail column SHALL expose a Place section beside the
tree. When placement mode is enabled, the Place section SHALL list configured
peripherals only and SHALL give each listed peripheral a control to enable or
disable its placement bubble. Moving a bubble between the priority circles
SHALL reallocate pins in real time through the existing preview and commit
path. The placement ON/OFF toggle SHALL remain a bottom-centre, canvas-only
control.

#### Scenario: Place section sits beside the tree

- **WHEN** the combined sidebar is rendered in landscape or in the portrait Peripherals dock tab
- **THEN** the Place section is reachable beside the tree and shows no floating canvas properties panel

#### Scenario: Only configured peripherals are listed

- **WHEN** the Place section opens for a workspace with configured and unconfigured peripherals
- **THEN** only peripherals holding an assignment or a non-disabled mode appear and unconfigured peripherals are absent

#### Scenario: Bubble toggle enables and disables placement

- **WHEN** the user enables or disables the placement bubble of a listed peripheral
- **THEN** an enabled preference with angle 0 and the lowest-priority ring is stored or the enabled preference is removed so allocation falls back to scarcity only

#### Scenario: Moving a bubble reallocates through preview and commit

- **WHEN** the user moves a placement bubble between priority circles and releases it
- **THEN** assignments update continuously during the move, one undoable preference change is committed on release, locked pins keep their assignments, and the Place section reflects the stored ring

#### Scenario: Placement ON/OFF is canvas only

- **WHEN** the user opens the Place section
- **THEN** no placement ON/OFF toggle is present in the sidebar and the only ON/OFF control is the bottom-centre canvas toggle

#### Scenario: Place section is inactive before canvas enable

- **WHEN** placement mode has not been enabled with the canvas toggle
- **THEN** the Place section shows guidance to use the canvas toggle and its bubble controls are inactive

### Requirement: The active sidebar section is a local preference

The active sidebar section SHALL be a UI preference persisted only in browser
localStorage. It SHALL survive reload, SHALL use a documented default when
absent or unknown, and SHALL NOT be serialized into share URLs or project JSON.
No placement or selection preference SHALL be carried in shareable pin
configuration by this requirement.

#### Scenario: Sidebar section survives reload

- **WHEN** the Place section is active and the workspace is reloaded in the same browser
- **THEN** the Place section is active again

#### Scenario: Sidebar section is not shared or exported

- **WHEN** a workspace with the Place section active is shared or exported to project JSON
- **THEN** neither the share URL payload nor the project JSON contains a sidebar section field

#### Scenario: Absent sidebar section uses the default

- **WHEN** localStorage has no sidebar section value or an unknown value
- **THEN** the peripheral detail surface is the active sidebar section

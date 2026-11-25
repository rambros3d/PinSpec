# Spec Delta

## MODIFIED Requirements

### Requirement: The combined sidebar keeps navigation and detail adjacent

The workspace SHALL present the peripheral tree and the peripheral detail
column side by side in the left pane. The detail column SHALL host the
peripheral detail surface only and SHALL NOT host a Place section or a
Detail/Place section switcher. The tree SHALL use a 160px default width clamped
to 120-240px, and the detail column SHALL keep a minimum width of 260-320px. In
narrow landscape viewports the combined sidebar SHALL keep its minimum combined
width instead of collapsing either column.

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

#### Scenario: No section switcher in the detail column

- **WHEN** the combined sidebar is rendered in landscape or in the portrait Peripherals dock tab
- **THEN** the detail column shows the peripheral detail surface without a Detail or Place tab strip

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
- **THEN** the row shows only its status circle and name, with selection expressed solely as a row highlight and placement expressed only on the canvas and in the right-drawer Placement tab

### Requirement: Peripheral detail is edited in the combined sidebar

The peripheral detail surface SHALL be hosted in the combined sidebar detail
column and SHALL keep the existing mode, signal, and remap commit behavior. The
Configuration tab SHALL be absent from the right drawer tab strip and from the
portrait dock tab strip. The right drawer SHALL retain its remaining tabs and
SHALL expose a Placement tab for placement bubble controls. The portrait
Peripherals tab SHALL show the tree and detail column side by side rather than
stacked.

#### Scenario: Detail opens beside the tree

- **WHEN** a peripheral row is activated
- **THEN** the combined sidebar detail column shows the detail surface for that peripheral next to the tree

#### Scenario: Commit behavior is unchanged

- **WHEN** a mode, signal, or remap is changed in the detail surface
- **THEN** the same workspace commit and diagnostics path runs as before the detail surface moved

#### Scenario: Configuration tab is removed from the drawer and dock

- **WHEN** the right drawer or portrait dock tab strip is rendered
- **THEN** no Configuration tab is present and the remaining drawer and dock tabs, including Placement, stay reachable

#### Scenario: Portrait shows tree and detail side by side

- **WHEN** the Peripherals dock tab is active in portrait
- **THEN** the dock shows the tree and detail column beside each other in the combined sidebar and never stacked vertically

## REMOVED Requirements

### Requirement: The Place section manages placement bubbles

**Reason**: The Place section and its Detail/Place switcher are removed from the
left sidebar. Placement bubbles are now managed by the right-drawer Placement
tab, which is also available as a portrait dock tab.

**Migration**: Use the Placement tab in the right summary drawer in landscape
or in the bottom dock in portrait. Bubble enable/disable keeps using the
shareable version-2 placement field and the existing preview/commit path.

### Requirement: The active sidebar section is a local preference

**Reason**: With the Place section removed, the combined sidebar has no
section switcher and no active section to persist.

**Migration**: Active tab selection is held by the existing drawer and dock tab
preferences in browser localStorage. No `sidebarSection` field is written to
or read from share URLs or project JSON.

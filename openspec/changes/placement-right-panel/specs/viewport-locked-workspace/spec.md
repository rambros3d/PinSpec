# Spec Delta

## MODIFIED Requirements

### Requirement: Orientation alone selects the layout

The system SHALL choose the layout from viewport orientation only, without
JavaScript orientation detection or a width-only rule. Landscape SHALL show the
combined sidebar with its slim tree and detail column, the pin canvas, and the
summary drawer. Portrait SHALL show the pin canvas and a bottom dock whose
Peripherals tab presents the sidebar side by side and whose Placement tab hosts
placement bubble controls. A width-only change SHALL NOT switch layouts.

#### Scenario: Landscape shows three panes

- **WHEN** the workspace is opened in landscape
- **THEN** the combined sidebar with its tree and detail column, the pin canvas, and the summary drawer are all present in the three-pane arrangement

#### Scenario: Portrait shows the bottom dock

- **WHEN** the viewport orientation changes to portrait
- **THEN** the pin canvas remains and the peripheral tree, detail column, pin table, placement controls in the Placement tab, diagnostics, DMA, and PIO content are presented through the bottom dock, with the tree and detail column side by side in the Peripherals tab

#### Scenario: Width-only resize does not change layout

- **WHEN** the viewport width changes while the orientation stays landscape
- **THEN** the layout remains the landscape three-pane arrangement

### Requirement: Portrait dock shows one tab at a time

Portrait SHALL present a single bottom dock whose tab set is Peripherals, Pins,
Diagnostics, DMA, PIO, Placement, and Audit. Only the selected tab's body SHALL
be visible at a time. The Peripherals tab SHALL show the tree and detail column
side by side. The Placement tab SHALL show the configured-peripheral bubble
list. The dock SHALL occupy about 40 to 45 percent of the viewport height and
scroll internally when its content exceeds that height.

#### Scenario: Selecting a tab changes the visible body

- **WHEN** the user selects a different dock tab in portrait
- **THEN** only the body of the selected tab is displayed and the previously selected body is hidden

#### Scenario: Configuration tab shows peripheral detail

- **WHEN** the user needs peripheral detail in portrait
- **THEN** the Peripherals dock tab shows the detail surface beside the tree and no Configuration tab is rendered

#### Scenario: Placement tab shows bubble controls

- **WHEN** the user selects the Placement dock tab in portrait
- **THEN** the dock body shows the configured-peripheral bubble list and selecting it activates the placement overlay

#### Scenario: Dock body scrolls internally

- **WHEN** the selected dock tab's content is taller than the dock body
- **THEN** the dock body scrolls within its own bounds and the document does not scroll

### Requirement: Active dock tab is persisted

The active portrait dock tab, including Placement, and the active right-drawer
tab SHALL be stored only in browser localStorage as UI preferences. Both SHALL
survive reload, SHALL NOT be serialized into share URLs or project JSON, and
SHALL default to Peripherals and Pins respectively when absent or unknown. No
layout or sidebar section preference SHALL be carried in shareable pin
configuration.

#### Scenario: Dock tab survives every persistence surface

- **WHEN** a workspace with a selected dock tab is saved to a localStorage session and reloaded in the same browser
- **THEN** the same dock tab is active, the share URL and project JSON contain no dock tab field, and all pin configuration is preserved

#### Scenario: Dock tab is not in a share link or project file

- **WHEN** a workspace with a selected dock tab is shared or exported to project JSON
- **THEN** neither the share URL payload nor the project JSON contains a dock tab field

#### Scenario: Absent dock tab defaults to Peripherals

- **WHEN** version-2 workspace state without a dock tab value is loaded
- **THEN** the Peripherals tab is active and existing pin configuration behavior is unchanged

#### Scenario: Legacy dock value is ignored

- **WHEN** an older share link or project file that contains a dock tab value is opened
- **THEN** it loads with the default Peripherals tab and its pin configuration is preserved

#### Scenario: Drawer tab is not shared or exported

- **WHEN** a workspace with a selected right-drawer tab is shared or exported to project JSON
- **THEN** neither the share URL payload nor the project JSON contains a drawer tab field and the same drawer tab is restored from localStorage after reload

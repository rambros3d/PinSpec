# Spec Delta

## MODIFIED Requirements

### Requirement: Orientation alone selects the layout

The system SHALL choose the layout from viewport orientation only, without JavaScript orientation detection and without a width-only rule. Landscape SHALL show three panes: peripheral tree, pin canvas, and summary drawer. Portrait SHALL show the pin canvas and a bottom dock. A width change that does not change orientation SHALL NOT switch layouts.

#### Scenario: Landscape shows three panes

- **WHEN** the workspace is opened in landscape
- **THEN** the peripheral tree, pin canvas, and summary drawer are all present in the three-pane arrangement

#### Scenario: Portrait shows the bottom dock

- **WHEN** the viewport orientation changes to portrait
- **THEN** the pin canvas remains and the peripheral tree, pin table, placement properties, diagnostics, DMA, and PIO content are presented through the bottom dock

#### Scenario: Width-only resize does not change layout

- **WHEN** the viewport width changes while the orientation stays landscape
- **THEN** the layout remains the landscape three-pane arrangement

### Requirement: Portrait dock shows one tab at a time

Portrait SHALL present a single bottom dock whose tab set is Peripherals, Pins, Configuration, Place, Diagnostics, DMA, PIO, and Audit. Only the selected tab's body SHALL be visible at a time. The Configuration tab SHALL show the peripheral detail surface for the selected peripheral through the same summary pane used by the other non-tree tabs. The dock SHALL occupy about 40 to 45 percent of the viewport height, and its body SHALL scroll internally when its content exceeds that height.

#### Scenario: Selecting a tab changes the visible body

- **WHEN** the user selects a different dock tab in portrait
- **THEN** only the body of the selected tab is displayed and the previously selected body is hidden

#### Scenario: Configuration tab shows peripheral detail

- **WHEN** the user selects the Configuration dock tab in portrait
- **THEN** the dock shows the detail surface for the selected peripheral and the tree and canvas stay mounted

#### Scenario: Place tab shows placement properties

- **WHEN** the user selects the Place dock tab in portrait
- **THEN** the dock shows the placement properties panel and the tree and canvas stay mounted

#### Scenario: Dock body scrolls internally

- **WHEN** the selected dock tab's content is taller than the dock body
- **THEN** the dock body scrolls within its own bounds and the document does not scroll

### Requirement: Active dock tab is persisted

The active portrait dock tab, including the Place tab, SHALL be stored only in browser localStorage as a UI preference. It SHALL survive reload and localStorage session restoration, and SHALL NOT be serialized into share URLs or project JSON. When the value is absent or unknown it SHALL default to Peripherals. No layout preference SHALL be carried in shareable pin configuration.

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

#### Scenario: Place dock tab survives reload

- **WHEN** the Place dock tab is selected and the workspace is reloaded in the same browser
- **THEN** the Place tab remains active and no dock tab field appears in the share URL or project JSON

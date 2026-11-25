# placement-toggle-and-accent-icons Specification

## Purpose

Covers the visible feedback of the canvas Placement toggle, its activation of the Placement panel, and the accent-colored navigation icons that make the collapsed sidebar rail readable.

## Requirements

### Requirement: Canvas toggle produces visible placement feedback

Activating the canvas Placement toggle SHALL produce a clearly visible change on the package canvas: the three priority rings and their labels SHALL be legible at the default zoom. Deactivating the toggle SHALL remove them. The rings SHALL remain non-interactive so pin input passes through.

#### Scenario: Toggle on draws legible rings

- **WHEN** the user activates the canvas Placement toggle on a workspace with no enabled bubbles
- **THEN** three priority rings and their labels are visibly drawn on the canvas

#### Scenario: Toggle off removes the rings

- **WHEN** the user deactivates the canvas Placement toggle
- **THEN** the rings and labels are removed from the canvas

#### Scenario: Rings still pass pin input through

- **WHEN** the user clicks a package pin that lies under a visible ring
- **THEN** the normal pin interaction opens and the ring does not capture the click

### Requirement: Canvas toggle activates the Placement panel

Activating the canvas Placement toggle SHALL also activate the Placement surface: the right-drawer Placement tab in landscape and the Placement dock tab in portrait. The toggle SHALL remain the single explicit overlay ON/OFF control and SHALL NOT change bubble preferences or any shareable pin configuration.

#### Scenario: Toggle reveals the right-drawer tab

- **WHEN** the user activates the canvas Placement toggle while another right-drawer tab is active
- **THEN** the Placement tab becomes active and its panel is shown

#### Scenario: Toggle reveals the portrait dock tab

- **WHEN** the user activates the canvas Placement toggle in portrait while another dock tab is active
- **THEN** the Placement dock tab becomes active and hosts the same panel

#### Scenario: Toggle off preserves the panel and bubbles

- **WHEN** the user deactivates the canvas Placement toggle while the Placement tab is active
- **THEN** the rings are hidden, the tab and bubble preferences remain unchanged, and the canvas toggle stays the only ON/OFF control

#### Scenario: No shareable state is added

- **WHEN** the coupled toggle action is used and the workspace is shared or exported
- **THEN** no tab, drawer, or overlay-visibility field appears in the share URL or project file and all pin configuration is preserved

### Requirement: Sidebar navigation icons use the accent token

The collapsed and expanded sidebar navigation icons SHALL resolve their primary color from the daisyUI `accent` token through a theme-aware utility. Labels SHALL keep their inherited foreground treatment, and icons on the active route SHALL retain `info` highlighting.

#### Scenario: Inactive icons use accent while labels stay muted

- **WHEN** the sidebar renders a non-active section in either rail or expanded state
- **THEN** its icon resolves to the accent token and its label keeps the inherited base foreground

#### Scenario: Active route icons keep info highlighting

- **WHEN** a section is the active route
- **THEN** its icon resolves to the `info` token while its label keeps its existing active foreground treatment

#### Scenario: Utility icons follow the same rule

- **WHEN** the Hotkeys entry and the expand or collapse control render their icons
- **THEN** those icons resolve to the accent token and their labels keep the inherited foreground

#### Scenario: Theme switch recolors icons without raw colors

- **WHEN** the active theme changes while the sidebar is visible
- **THEN** icon colors follow the active accent and info tokens and no color literal or emoji appears in sidebar source

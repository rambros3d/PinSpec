# peripheral-tree-detail-panel Specification

## Purpose

Defines how the workspace peripheral tree and the right-hand detail surface
divide navigation from configuration, how view preferences persist, and how pin
configuration stays shareable across STM32, CH32, and RP parts.

## Requirements

### Requirement: Peripheral configuration is edited in the right drawer

The workspace SHALL present peripheral configuration in a detail column of the
combined left-pane sidebar selected from the tree, not in the right drawer, an
expanded tree row, a floating panel, or a stacked portrait section. Selecting a
tree row SHALL open the detail surface beside the tree and SHALL keep the
existing pin assignment, remap, and mode commit behavior. The landscape layout
SHALL keep one tree instance, one detail column, one canvas instance, and one
drawer instance.

#### Scenario: Select a peripheral from the tree

- **WHEN** a user activates a peripheral row in the tree
- **THEN** the sidebar detail column shows the detail surface for that peripheral and the tree rows stay compact

#### Scenario: Commit behavior is unchanged

- **WHEN** a user changes a mode, remap, or signal toggle in the detail surface
- **THEN** the same workspace commit and diagnostics path runs as before the detail surface existed

#### Scenario: Landscape keeps single mounts

- **WHEN** the workspace is shown in landscape
- **THEN** one tree, one detail column, one package canvas, and one summary drawer are mounted

### Requirement: Tree rows are compact

Each peripheral row SHALL show only a status circle and the peripheral name.
The circle hue SHALL encode solver status as neutral, success, warning, or
error, and its fill SHALL encode mode present versus disabled or absent, with
the exact state exposed through `title` and `aria-label`. A row SHALL NOT render
an inline mode label, a placement or selection marker, signal toggles, mode
selectors, remap selectors, or tag pills.

#### Scenario: Fresh workspace row content

- **WHEN** a fresh STM32G431CBU6 workspace is opened
- **THEN** each visible row shows a name and status circle with no inline mode label, inline signal list, or placement marker

#### Scenario: Activating a row does not expand detail inline

- **WHEN** a user activates a peripheral row
- **THEN** the peripheral is selected with a row highlight and without an expanded detail body inside the tree

### Requirement: Configured peripherals precede unconfigured ones

Within each browsable category, peripherals with an active, partial, or error
status or with a selected mode SHALL be listed before peripherals with no
status and no selected mode. The Other category SHALL be collapsed by default
and labeled with its peripheral count.

#### Scenario: Configured first within a category

- **WHEN** a category contains both configured and unconfigured peripherals
- **THEN** configured names are listed before unconfigured names

#### Scenario: Other category is collapsed by default

- **WHEN** the peripheral tree is first shown for a chip with peripherals in Other
- **THEN** Other peripherals (N) is collapsed and N equals the number of peripherals in that category

#### Scenario: Filtering keeps the ordering

- **WHEN** a user filters the tree
- **THEN** configured-first order applies to the matching rows

### Requirement: Fresh workspace shows a browsable empty state

For a workspace with no configured peripherals, the tree SHALL show a short
empty-state line and SHALL keep its categories visible and browsable. The tree
SHALL NOT render an empty pane.

#### Scenario: No peripherals configured

- **WHEN** a fresh workspace with no configured peripherals opens
- **THEN** a short line explains that selecting a peripheral opens its configuration and the categories remain listed

#### Scenario: Categories remain usable in the empty state

- **WHEN** a user expands a category in the empty state
- **THEN** the peripheral rows for that category are shown

### Requirement: View preferences are persisted only in localStorage

Selected peripheral, filter text, category expansion, the active sidebar
section, and the active dock tab are UI preferences. They SHALL persist in
browser localStorage across reloads and SHALL NOT be serialized into share URLs
or project JSON. Absent or unknown values SHALL use documented defaults.

#### Scenario: Preferences survive reload

- **WHEN** a user selects a peripheral, types a filter, collapses a category, switches the sidebar section, and reloads the workspace
- **THEN** those values are restored from localStorage

#### Scenario: Preferences are not shared or exported

- **WHEN** a workspace with selected view preferences is shared or exported
- **THEN** the share URL and project JSON contain no view-preference fields

#### Scenario: Legacy dock value is ignored

- **WHEN** a share link or project file from an earlier version contains a dock tab value
- **THEN** the default Peripherals dock tab is active and the pin configuration is preserved

#### Scenario: Storage is unavailable

- **WHEN** browser localStorage is unavailable
- **THEN** the workspace renders with default view preferences and remains usable

### Requirement: Configured and unconfigured partition is DOM-free

A pure core helper SHALL partition peripheral names into configured and
unconfigured sets from status and mode data, with no Svelte or DOM dependency.
A peripheral SHALL be configured when it has a status other than none or a
selected mode other than disabled.

#### Scenario: STM32 fresh workspace partition

- **WHEN** STM32G431CBU6 or STM32F103C8T6 peripherals are partitioned with no modes
- **THEN** every peripheral name is unconfigured

#### Scenario: Multi-vendor partition

- **WHEN** CH32V203C8T6, RP2040, or RP2350B peripherals include modes and status entries
- **THEN** configured names are separated from unconfigured names

#### Scenario: Host-side unit test

- **WHEN** the helper is imported in a host-side unit test
- **THEN** no DOM or Svelte module is required

### Requirement: Pin configuration exports are preserved

Assignments, labels, locks, peripheral modes, active remaps, PIO bindings,
GPIO electrical settings, placement preferences, and rotation SHALL keep their
version-2 share URL and project JSON round-trip. Removing view preferences
SHALL NOT change any of those fields.

#### Scenario: Share link round-trip

- **WHEN** a configured workspace is shared and reopened from its link
- **THEN** all pin configuration fields match the original workspace

#### Scenario: Project file round-trip

- **WHEN** a configured workspace is exported to project JSON and imported
- **THEN** all pin configuration fields match the original workspace

#### Scenario: Project file without view preferences

- **WHEN** a project file contains only pin configuration fields
- **THEN** it loads without requiring any view-preference field

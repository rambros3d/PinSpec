# placement-right-panel Specification

## Purpose

Defines the right-drawer Placement tab as the primary surface for placement
bubble controls, including automatic overlay activation, configured-only toggle
rows, visual ring adjustment, and the split between shareable placement settings
and local view preferences.

## Requirements

### Requirement: Placement controls are hosted in the right drawer

The workspace SHALL host placement bubble controls in a `Placement` tab of the
right summary drawer and, in portrait, of the bottom dock. The left combined
sidebar SHALL present only the peripheral tree and the peripheral detail
column, with no Detail/Place section switcher and no Place section.

#### Scenario: Landscape drawer hosts the Placement tab

- **WHEN** the workspace is shown in landscape
- **THEN** the right summary drawer tab strip contains a Placement tab and the left sidebar has no Place section or section switcher

#### Scenario: Portrait dock hosts the Placement tab

- **WHEN** the workspace is shown in portrait
- **THEN** the bottom dock tab strip contains a Placement tab whose body hosts the same placement controls as the landscape drawer tab

#### Scenario: One placement control surface per layout

- **WHEN** the workspace switches between landscape and portrait
- **THEN** one placement list is mounted from the drawer or dock and the left sidebar never mounts a second placement panel

### Requirement: Placement tab lists configured peripherals with toggles

The Placement tab SHALL show a simple list of every configured peripheral,
defined as holding at least one assignment or a mode other than disabled. Each
row SHALL provide one toggle that enables or disables that peripheral's
placement bubble. The list SHALL NOT contain a numeric angle input, a ring
selector, or a claimed-pin summary.

#### Scenario: Configured peripherals are listed

- **WHEN** the Placement tab opens for a workspace with assigned or mode-enabled peripherals
- **THEN** each configured peripheral appears once with an enable/disable toggle and no other controls

#### Scenario: Unconfigured peripherals are absent

- **WHEN** a peripheral has no assignment and a disabled or absent mode
- **THEN** that peripheral is absent from the Placement tab list

#### Scenario: Assigned system peripheral is listed

- **WHEN** a system peripheral holds an assignment but exposes no assignable signals in the chip data
- **THEN** that system peripheral still appears in the Placement tab list

#### Scenario: Enabling creates a default preference

- **WHEN** the user enables the bubble of a listed peripheral that has no placement preference
- **THEN** a preference with angle 0, ring low, and enabled true is stored and a bubble is drawn on the low ring

#### Scenario: Disabling removes the preference

- **WHEN** the user disables the bubble of a listed peripheral
- **THEN** its placement preference is removed and allocation for that peripheral falls back to scarcity-only ordering

#### Scenario: No numeric or ring controls in the list

- **WHEN** the Placement tab list is rendered
- **THEN** no angle number input, ring dropdown, ring radio group, or claimed-pin text is present in any row

### Requirement: Angle and ring are adjusted visually on the canvas

The Placement tab SHALL NOT expose angle or ring inputs. Angle and ring SHALL be
changed by dragging the peripheral bubble among the canvas priority rings. A
drag SHALL use the existing live preview and single commit path, SHALL preserve
locked pins, and SHALL keep every previewed assignment set legal.

#### Scenario: Drag updates the stored preference

- **WHEN** the user drags a bubble to a new angle and drops it at the radius of another ring
- **THEN** the stored angle reflects the drop position and the stored ring becomes the nearest ring to the drop radius

#### Scenario: Drag reallocates through preview and commit

- **WHEN** the user drags a bubble through intermediate positions and releases it
- **THEN** pin assignments update during the drag without undo entries and one preference change is committed on release

#### Scenario: Locked pins are preserved during the drag

- **WHEN** a bubble is dragged past pins that the user has locked
- **THEN** the locked pins keep their assignments and are not cleared or reassigned

#### Scenario: Illegal candidates are never previewed

- **WHEN** a bubble is dragged on a matrix-mux chip toward pins that cannot legally host the signal
- **THEN** every previewed assignment set is electrically legal and no illegal plan is rendered

### Requirement: Placement relocation preserves existing behavior

Moving placement controls SHALL NOT change allocation scoring, solver
invariants, exporters, generated catalog data, or STM32 behavior. No new runtime
dependency SHALL be introduced and `src/core/` SHALL remain free of Svelte and
DOM imports.

#### Scenario: Default allocation is unchanged

- **WHEN** a chip is allocated with no enabled placement preference after the relocation
- **THEN** every assigned pin, signal, and score matches the allocation produced before this change

#### Scenario: Exported pin data is unchanged

- **WHEN** a workspace with configured pins is exported to Rust, C header, CSV, and JSON
- **THEN** the exported pin assignments and signal names match the exports produced before this change

#### Scenario: Core stays pure

- **WHEN** the core source files are inspected after the relocation
- **THEN** no Svelte or DOM import exists under `src/core/` and no new runtime dependency is declared

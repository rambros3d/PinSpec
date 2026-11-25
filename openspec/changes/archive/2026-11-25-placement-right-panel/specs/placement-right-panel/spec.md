# Spec Delta

## Purpose

Defines the right-drawer Placement tab as the primary surface for placement
bubble controls, including automatic overlay activation, configured-only toggle
rows, visual ring adjustment, and the split between shareable placement settings
and local view preferences.

## ADDED Requirements

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
- **THEN** the overlay hides or shows without changing the active tab or any bubble preference

#### Scenario: Leaving the Placement tab hides the overlay

- **WHEN** the user moves away from the Placement tab to another drawer or dock tab, or closes the drawer while that tab is active
- **THEN** the overlay is hidden unless the user explicitly re-enabled it with the canvas toggle, and no bubble preference is changed

#### Scenario: Overlay visibility is a local preference

- **WHEN** the overlay is activated by the Placement tab and the workspace is reloaded in the same browser
- **THEN** the overlay visibility is restored from localStorage and is absent from share URLs and project JSON

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

### Requirement: Persistence split for placement controls

Bubble enable/disable SHALL be stored in the shareable version-2 workspace
placement field and round-trip through history, sessions, share URLs, and
project JSON. The active drawer tab, active dock tab, and overlay visibility
SHALL be stored only in browser localStorage and SHALL NOT appear in share URLs
or project JSON.

#### Scenario: Bubble state survives every persistence surface

- **WHEN** a workspace with enabled and disabled bubbles is exported to a share URL, a project JSON file, and a localStorage session and then reloaded from each
- **THEN** every stored angle, ring, and enabled flag is restored and undo and redo reproduce and revert bubble changes

#### Scenario: Tab and visibility are not shared or exported

- **WHEN** a workspace with the Placement tab active and the overlay visible is shared or exported to project JSON
- **THEN** neither the share URL payload nor the project JSON contains a drawer tab, dock tab, sidebar section, or overlay visibility field

#### Scenario: Local preferences survive reload

- **WHEN** the same browser reloads a workspace after selecting the Placement tab and showing the overlay
- **THEN** the Placement tab is active again and the overlay is shown again from localStorage

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

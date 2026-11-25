# multi-vendor-workspace Specification

## Purpose

Defines how the landing page and three-pane workspace present multi-vendor chips so that CH32 remaps and RP PIO/FUNCSEL parts render, filter, preview, and explain themselves correctly alongside STM32.

## Requirements

### Requirement: Mux labels are vendor-correct in every pin view
All pin views SHALL present mux labels using the shared mux-label helper and the chip's mux model: `AF<n>` for STM32, `F<n>` or `PIO` for RP, `RM<n>` for CH32, the matrix route display label or signal name for ESP32, and the GPIO mode for plain GPIO. Hardcoded `AFIO`/`AF<n>` fallback text SHALL NOT appear for a non-AF chip.

#### Scenario: CH32 pin popover
- **WHEN** a CH32 assignment with `remapId` 1 is inspected in the pin popover
- **THEN** the signal is labeled `RM1` and no `AFIO` label is shown

#### Scenario: RP canvas tooltip
- **WHEN** an RP pin with FUNCSEL index 6 and no display override is hovered
- **THEN** the tooltip reads `F6` and a PIO-bound pin without FUNCSEL reads `PIO`

#### Scenario: ESP32 matrix tooltip
- **WHEN** an ESP32 pin with a matrix route display label is hovered
- **THEN** the tooltip shows that display label and no `AF` or `F` index fallback

### Requirement: Package renderers handle two-sided, exposed-pad, and bonded pins
Package rendering SHALL recognize two-sided packages including `SOP`, draw an exposed thermal pad when the package declares one, and display bonded pin names on pins with multiple internal pads; four-sided and grid layouts SHALL remain unchanged. The same generated package geometry SHALL also drive non-interactive catalog and projects thumbnails after shard refinement, without changing pin placement, mux labels, bonded labels, or interaction behavior in the workspace renderers.

#### Scenario: SOP8 package
- **WHEN** an 8-pin SOP package is opened
- **THEN** its eight pads are laid out on two vertical sides rather than four equal sides

#### Scenario: Exposed-pad QFN
- **WHEN** a QFN package declares an exposed pad
- **THEN** an exposed-pad graphic is drawn in the package body

#### Scenario: Bonded CH32 pin
- **WHEN** a CH32 pin carries multiple bonded names
- **THEN** its label includes the bonded names and carries the bonded visual treatment

#### Scenario: Refined thumbnail uses generated geometry

- **WHEN** a visible catalog row for a two-sided package, an exposed-pad QFN, or a grid part is refined from its shard
- **THEN** the thumbnail uses that shard's package kind, side counts, grid rows and columns, and exposed-pad declaration and agrees with the workspace renderer's geometry classification

#### Scenario: Thumbnail does not duplicate interactive rendering

- **WHEN** a package thumbnail is drawn in a catalog row or session card
- **THEN** it contains no pin hit target, pointer handler, texture filter, mux label, or bonded-name text and the two interactive package renderers remain unchanged

### Requirement: Peripheral tree offers a remap selector
For a chip whose peripherals declare remap options, the peripheral tree SHALL expose a remap dropdown that lists each option's name and register note, reflects the active selection, and commits a change through workspace history; chips without remaps SHALL NOT display the dropdown.

#### Scenario: Select a CH32 remap
- **WHEN** a user chooses remap option 1 for a CH32 peripheral
- **THEN** `activeRemaps` is updated, the pin labels refresh to the new remap, and the change is undoable

#### Scenario: STM32 has no remap dropdown
- **WHEN** an STM32 chip is open
- **THEN** the peripheral tree shows no remap selector

### Requirement: RP PIO allocation is visible
For RP chips the workspace SHALL provide a PIO allocation panel that lists each PIO instance, state machine, and role from the current bindings, and SHALL display the valid GPIOBASE windows for the chip with any pin outside every window flagged.

#### Scenario: RP2350B windows
- **WHEN** an RP2350B chip is opened
- **THEN** the panel shows both valid GPIO0-31 and GPIO16-47 windows

#### Scenario: Pin outside every window
- **WHEN** a PIO binding targets a pin outside all valid GPIOBASE windows
- **THEN** the panel flags that binding and the workspace shows a GPIOBASE diagnostic

### Requirement: Catalog discovery is vendor aware

Quick search and the MCU switcher SHALL expose vendor filter tabs and
vendor-aware family/package filters, and SHALL restrict results and the MCU list
to the selected vendor and filters. The vendor set SHALL include `esp32` in
addition to the existing three vendors, and the compatible-MCU finder SHALL
offer the same vendor filter options. The MCU switcher SHALL remain available
from the global top bar on workspace and shared routes with that same vendor
filter behavior.

#### Scenario: Filter to RP parts

- **WHEN** a user selects the RP vendor tab and searches by family or package
- **THEN** only RP chips matching the family/package filters are listed

#### Scenario: Clear vendor filter

- **WHEN** the user clears the vendor tab
- **THEN** chips from all vendors are listed again

#### Scenario: Filter to ESP32 parts

- **WHEN** a user selects the ESP32 vendor tab and searches by family or package
- **THEN** only ESP32 chips matching the family/package filters are listed

#### Scenario: Compatible-MCU vendor options

- **WHEN** the compatible-MCU finder vendor filter is opened
- **THEN** it offers STM32, CH32, RP, and ESP32 and can restrict candidates to ESP32

#### Scenario: MCU switcher from the global bar

- **WHEN** a workspace or shared route is opened and the user activates the MCU switcher in the global bar
- **THEN** the same vendor-filtered MCU list opens as from the previous workspace toolbar

#### Scenario: Chip pill retained in the workspace action cluster

- **WHEN** the left-edge title shows the project name on a workspace or shared route
- **THEN** the chip-id switcher button is still present in the workspace action cluster and still opens the vendor-filtered MCU list

#### Scenario: Chip id is not duplicated at the left edge

- **WHEN** a workspace route is opened with a loaded chip and a named project
- **THEN** the chip id appears in the switcher pill and not in a separate left-edge route title

### Requirement: Export previews and provenance reflect all vendors

The export modal SHALL present tabs that invoke the vendor-aware exporters and show copy/download controls for each format. The start screen's compact catalog facts, the About provenance table, and workspace copy SHALL describe multi-vendor coverage and credit the STM32, CH32, RP, ESP32, Microchip SAM, and Nordic upstream data sources without STM32-only claims. The Rust tab label SHALL name the crate used by the chip vendor.

#### Scenario: Preview CH32 Rust export

- **WHEN** a CH32 workspace opens the export modal and selects the Rust tab
- **THEN** the preview shows `ch32_hal` output and copy/download target that content

#### Scenario: Footer provenance

- **WHEN** the start screen and About route are viewed with generated metadata available
- **THEN** the start screen shows per-vendor chip counts and the About table lists source revisions and license credits with no STM32-only wording

#### Scenario: Preview ESP32 Rust export

- **WHEN** an ESP32 workspace opens the export modal and selects the Rust tab
- **THEN** the preview shows `esp-hal` output and copy/download target that content

#### Scenario: ESP32 source credits

- **WHEN** the About provenance table is rendered with generated metadata
- **THEN** it credits the four ESP32 sources alongside the other upstream sources and lists an ESP32 vendor count

### Requirement: Multi-vendor layouts remain legible across themes and zooms

The package renderers SHALL produce clean, non-overlapping pins and readable labels for SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 in both light and dark themes at the supported zoom range. Replacement bold duotone icons on workspace surfaces SHALL remain legible in both themes at the supported zoom range, and the icon replacement SHALL NOT change renderer geometry, labels, or textures.

#### Scenario: Zoomed inspection in both themes

- **WHEN** each listed package is rendered at minimum and maximum zoom in light and dark themes
- **THEN** pin pads, mux labels, and bonded/exposed-pad annotations remain readable and do not overlap

#### Scenario: Icon legibility in both themes

- **WHEN** workspace toolbar, tree, canvas, and dialog icons are rendered in light and dark themes
- **THEN** both duotone layers remain distinguishable against the active background and no control label is obscured

#### Scenario: Package renderer behavior is unchanged

- **WHEN** the two package renderer files are inspected after the icon replacement
- **THEN** their geometry, label code, and texture filters match the pre-replacement implementation

### Requirement: Presets are cross-vendor

Curated presets SHALL include STM32, CH32, RP, and ESP32 parts and SHALL open the
selected generated chip when activated from the start screen or the workspace.
ESP32 entries SHALL be starter chips that resolve to generated module shards,
and no ESP32 board preset or `.ioc` import SHALL be added. No chip preview on the
start screen SHALL fetch a hardcoded snapshot or build a demo state. New
preset sessions SHALL receive a generated project name from chip data.

#### Scenario: Open an RP preset

- **WHEN** a user selects an RP preset
- **THEN** the workspace loads the generated RP chip data without fetching a hardcoded STM32 snapshot

#### Scenario: Open a CH32 preset

- **WHEN** a user selects a CH32 preset from the start screen
- **THEN** the workspace loads the generated CH32 chip data with its remap data intact

#### Scenario: No hero preview fetches a chip

- **WHEN** the start screen is mounted
- **THEN** no hero demo chip request is made

#### Scenario: Open an ESP32 starter chip

- **WHEN** a user selects an ESP32 starter chip from the start screen
- **THEN** the workspace loads the generated ESP32 module shard without a board preset

#### Scenario: ESP32 import is not offered

- **WHEN** the start screen `.ioc` entry point is used
- **THEN** it resolves STM32 parts only and no ESP32 board preset is listed

#### Scenario: Preset session receives a generated name

- **WHEN** a preset or starter chip creates a new workspace session for a generated chip
- **THEN** the session's project name uses a lowercase sanitized suffix from that chip's generated family or MCU identifier

# Spec Delta

## Purpose

Defines how the landing page and three-pane workspace present multi-vendor chips so that CH32 remaps and RP PIO/FUNCSEL parts render, filter, preview, and explain themselves correctly alongside STM32.

## ADDED Requirements

### Requirement: Mux labels are vendor-correct in every pin view
All pin views SHALL present mux labels using the shared mux-label helper and the chip's mux model: `AF<n>` for STM32, `F<n>` or `PIO` for RP, `RM<n>` for CH32, and the GPIO mode for plain GPIO. Hardcoded `AFIO`/`AF<n>` fallback text SHALL NOT appear for a non-AF chip.

#### Scenario: CH32 pin popover
- **WHEN** a CH32 assignment with `remapId` 1 is inspected in the pin popover
- **THEN** the signal is labeled `RM1` and no `AFIO` label is shown

#### Scenario: RP canvas tooltip
- **WHEN** an RP pin with FUNCSEL index 6 and no display override is hovered
- **THEN** the tooltip reads `F6` and a PIO-bound pin without FUNCSEL reads `PIO`

### Requirement: Package renderers handle two-sided, exposed-pad, and bonded pins
Package rendering SHALL recognize two-sided packages including `SOP`, draw an exposed thermal pad when the package declares one, and display bonded pin names on pins with multiple internal pads; four-sided and grid layouts SHALL remain unchanged.

#### Scenario: SOP8 package
- **WHEN** an 8-pin SOP package is opened
- **THEN** its eight pads are laid out on two vertical sides rather than four equal sides

#### Scenario: Exposed-pad QFN
- **WHEN** a QFN package declares an exposed pad
- **THEN** an exposed-pad graphic is drawn in the package body

#### Scenario: Bonded CH32 pin
- **WHEN** a CH32 pin carries multiple bonded names
- **THEN** its label includes the bonded names and carries the bonded visual treatment

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
Quick search and the MCU switcher SHALL expose vendor filter tabs and vendor-aware family/package filters, and SHALL restrict results and the MCU list to the selected vendor and filters.

#### Scenario: Filter to RP parts
- **WHEN** a user selects the RP vendor tab and searches by family or package
- **THEN** only RP chips matching the family/package filters are listed

#### Scenario: Clear vendor filter
- **WHEN** the user clears the vendor tab
- **THEN** chips from all vendors are listed again

### Requirement: Presets and hero are cross-vendor
Curated presets SHALL include STM32, CH32, and RP parts and open the selected generated chip; the hero SHALL offer a vendor switcher that lazy-fetches a generated chip per vendor and builds demo assignments appropriate to that vendor rather than importing a committed chip snapshot.

#### Scenario: Open an RP preset
- **WHEN** a user selects an RP preset
- **THEN** the workspace loads the generated RP chip data without fetching a hardcoded STM32 snapshot

#### Scenario: Switch hero vendor
- **WHEN** the hero vendor switcher is set to CH32
- **THEN** the preview fetches a generated CH32 chip and shows a demo built from its available peripherals

### Requirement: Export previews and provenance reflect all vendors
The export modal SHALL present tabs that invoke the vendor-aware exporters and show copy/download controls for each format, and the landing footer and workspace copy SHALL describe multi-vendor coverage and credit the STM32, CH32, and RP upstream data sources without STM32-only claims.

#### Scenario: Preview CH32 Rust export
- **WHEN** a CH32 workspace opens the export modal and selects the Rust tab
- **THEN** the preview shows `ch32_hal` output and copy/download target that content

#### Scenario: Footer provenance
- **WHEN** the landing page is viewed with generated metadata available
- **THEN** the footer lists per-vendor chip counts, source revisions, and license credits and contains no STM32-only wording

### Requirement: Multi-vendor layouts remain legible across themes and zooms
The package renderers SHALL produce clean, non-overlapping pins and readable labels for SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 in both light and dark themes at the supported zoom range.

#### Scenario: Zoomed inspection in both themes
- **WHEN** each listed package is rendered at minimum and maximum zoom in light and dark themes
- **THEN** pin pads, mux labels, and bonded/exposed-pad annotations remain readable and do not overlap

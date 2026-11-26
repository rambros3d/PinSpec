# Spec Delta

## Purpose

Defines how upstream-identified ESP32 modules are labeled in generated catalog data, drawn as module packages on the canvas, and marked in discovery, while bare dies and other vendors keep their current data and rendering.

## ADDED Requirements

### Requirement: Module identity is derived from acquired upstream evidence

Catalog generation SHALL attach module identity only when an acquired KiCad symbol name identifies a module by the module-name pattern already used for ESP32 modules and the symbol resolves to a first-party family. No module identity SHALL be inferred from part naming conventions, hardcoded part tables, or static overlays. A part without that evidence SHALL be emitted without module identity and generation SHALL continue.

#### Scenario: KiCad module symbol supplies identity

- **WHEN** an ESP32 part is built from a KiCad symbol whose name identifies a WROOM or MINI module and resolves to an acquired first-party family
- **THEN** the generated part carries module identity derived from that symbol and family

#### Scenario: Bare die has no module identity

- **WHEN** an ESP32 die is built from a symbol that is not a WROOM or MINI module
- **THEN** its shard carries no module field and no module label is inferred from its name

#### Scenario: MPN-only IC has no module identity

- **WHEN** an ESP32 MPN variant is built from a bare-die symbol with a first-party flash declaration
- **THEN** its shard carries no module field even though it has a numeric flash size

#### Scenario: Module evidence cannot be resolved

- **WHEN** a candidate module symbol has no resolvable first-party family or pad evidence
- **THEN** no module identity is invented and generation continues with the existing attributed warning path

### Requirement: Module identity is published in the shard and compact index

A module shard SHALL carry a module record with kind `module`, the module name from the acquired symbol, the resolved base family, and the symbol name. The compact index entry for that shard SHALL carry a module marker that agrees with the shard. Bare dies and non-module parts SHALL omit both the module record and the marker.

#### Scenario: Module shard carries provenance-backed identity

- **WHEN** an ESP32-WROOM-E shard is generated from its acquired KiCad symbol
- **THEN** its module record names that symbol and the resolved base family and uses kind `module`

#### Scenario: Index marker matches the shard

- **WHEN** the catalog index is written for a module part
- **THEN** its entry carries the module marker and the matching shard carries the module record

#### Scenario: Bare die index entry has no marker

- **WHEN** the ESP32-C3 die and the ESP32-C3FH4 MPN are indexed
- **THEN** neither entry carries a module marker and neither shard carries a module record

#### Scenario: Other vendors have no module fields

- **WHEN** STM32, CH32, RP, Microchip SAM, and Nordic shards and index entries are generated
- **THEN** none of them carries a module record or module marker

### Requirement: Generation gates enforce module consistency

The release gate suite SHALL abort generation with a non-zero exit and no partial catalog when a module shard lacks its module record, when a non-module shard declares one, or when the index marker disagrees with the shard. Valid module data SHALL pass the existing shard-value and artifact-budget gates.

#### Scenario: Complete module data passes generation

- **WHEN** every module shard, its index marker, and every bare-die shard satisfy the module rules
- **THEN** generation exits zero and writes the catalog together with the other vendors

#### Scenario: Missing module record blocks generation

- **WHEN** a module shard is emitted without a module record
- **THEN** generation exits non-zero, names the failing part, and writes no catalog artifacts

#### Scenario: Invented module identity blocks generation

- **WHEN** a bare-die shard declares a module record without acquired module evidence
- **THEN** generation exits non-zero, names the failing part, and writes no catalog artifacts

#### Scenario: Index and shard disagree

- **WHEN** an index entry marks a part as a module but its shard has no module record, or the reverse
- **THEN** generation exits non-zero and identifies the mismatched part

### Requirement: Module parts render as modules on the perimeter canvas

When a chip shard declares module identity, the perimeter package renderer SHALL draw a module-style PCB body outline, a dashed inner die outline, castellated half-hole edge marks aligned with the package edges, and the module name. All added marks SHALL use theme-supplied styling and SHALL be decorative and non-interactive. Chips without module identity SHALL render with the existing package body.

#### Scenario: Module body is visible

- **WHEN** an ESP32 module workspace is rendered on the perimeter canvas
- **THEN** its body shows the module outline, dashed inner die outline, edge castellations, and module name

#### Scenario: Bare die rendering is unchanged

- **WHEN** an ESP32 bare die or an STM32 package is rendered on the same canvas
- **THEN** no module outline, inner die outline, castellation, or module name is drawn

#### Scenario: Pin geometry and interaction are unchanged

- **WHEN** a user clicks, right-clicks, or hovers a pad on a module package
- **THEN** the same physical pin, assignment state, popover, menu, and tooltip appear as before and no new interactive pad is introduced

#### Scenario: Module marks use theme styling

- **WHEN** module marks are rendered in either theme
- **THEN** their fills, strokes, and text use existing theme tokens with no raw color literal

### Requirement: Module markings follow package rotation

Module marks SHALL be part of the existing rotated geometry group and SHALL rotate with the package body at every supported orientation. The module name SHALL use the same upright-text rule as the existing centre markings. Rotation SHALL NOT change pin positions, assignments, or interaction targets.

#### Scenario: Module marks rotate with the body

- **WHEN** a module package is rotated to 90, 180, or 270 degrees
- **THEN** its outline, inner die outline, castellations, and body geometry rotate together with the pads

#### Scenario: Module name stays upright

- **WHEN** a module package is shown at any of the four orientations
- **THEN** its module name is readable and not upside down

#### Scenario: Interaction survives rotation

- **WHEN** a module pin is clicked or hovered at any orientation
- **THEN** it resolves to the same physical pin and assignment as in the unrotated view

### Requirement: Discovery surfaces mark modules

Quick MCU search, the MCU switcher, compatible-MCU candidate results, and starter chips SHALL show a compact `MODULE` tag for parts carrying the generated module marker. Parts without that marker SHALL show no such tag. Starter-chip tags SHALL be derived from the generated catalog marker rather than from a new hardcoded module list.

#### Scenario: Search result shows the module tag

- **WHEN** a user searches the catalog for an ESP32 module part
- **THEN** its result shows the compact `MODULE` tag next to the part identity

#### Scenario: MCU switcher shows the module tag

- **WHEN** the MCU switcher lists an ESP32 module part
- **THEN** its result shows the compact `MODULE` tag

#### Scenario: Compatible candidate shows the module tag

- **WHEN** the compatible-MCU finder lists a module part as a candidate
- **THEN** that candidate shows the compact `MODULE` tag

#### Scenario: Starter chip tag follows the catalog

- **WHEN** the starter chips are rendered with a generated index that marks a module part
- **THEN** that starter chip shows the `MODULE` tag and no new hardcoded chip fact is introduced

#### Scenario: Bare die has no module tag

- **WHEN** a bare die or a non-ESP32 part is shown in any discovery surface
- **THEN** no `MODULE` tag is displayed for it

### Requirement: Pin configuration and persistence are unchanged

Module identity SHALL be generated catalog data only. It SHALL NOT introduce a workspace state field, a version-2 share payload field, a project-file field, or a localStorage preference. All assignments, labels, locks, modes, remaps, PIO bindings, and rotation values for module workspaces SHALL keep their existing persistence and undo/redo behavior.

#### Scenario: Module workspace share link is unchanged

- **WHEN** a configured module workspace is shared through a version-2 URL and reopened
- **THEN** its payload has the existing field set and its pin configuration round-trips unchanged

#### Scenario: Module workspace project file is unchanged

- **WHEN** a configured module workspace is exported to a project file and imported again
- **THEN** the file has no module field and its pin configuration round-trips unchanged

#### Scenario: Presentation state stays local

- **WHEN** a user changes a view preference while a module workspace is open and then shares or exports it
- **THEN** the share payload and project file contain no new presentation field

### Requirement: Existing packages, vendors, and verification remain stable

The change SHALL NOT alter STM32 generated bytes, golden shard hashes, the compact STM32 index entry set, grid-package rendering, or the existing two-sided, exposed-pad, bonded-pin, and mux-label contracts for other vendors. The full unit test suite, strict type check, production subpath build, and data generation SHALL pass after the change.

#### Scenario: STM32 output is byte-stable

- **WHEN** data generation runs with the pinned upstream sources
- **THEN** STM32 shards, STM32 index entries, and the golden STM32 hashes match their previous values

#### Scenario: Existing renderer contracts hold

- **WHEN** SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 packages are rendered in both themes
- **THEN** their pads, labels, exposed pads, bonded marks, and mux labels remain as before

#### Scenario: Verification sequence passes

- **WHEN** `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`, and `npm run gen-data` are run after the change
- **THEN** each command exits zero with no new warning or partial catalog

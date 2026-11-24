# Spec Delta

## Purpose

Defines a read-only hardware audit built from generated chip data and user-entered workspace state.
It exposes strapping, interface, unused-pin, and voltage-tolerance facts without changing solver
diagnostics or inventing hardware guidance that upstream sources do not provide.

## ADDED Requirements

### Requirement: Audit output is structured and data-derived

The system SHALL produce an audit report with distinct strapping, interface, unused-pin, and
voltage-tolerance sections. Each fact SHALL carry an enumerated value, identifiers from the chip
shard or workspace state, and an evidence source. The report SHALL NOT contain pull-direction
prescriptions, resistor or capacitor values, VCAP tables, unused-pin policy prose, or diagnostic
codes and severities.

#### Scenario: Build an audit for a configured workspace

- **WHEN** an audit is built for a chip and its current workspace state
- **THEN** the report contains the four named sections with enumerated facts and evidence sources and contains no prose guidance or numeric passive values

#### Scenario: Evidence is absent upstream

- **WHEN** a reported item has no supporting value in the chip shard, an upstream dataset, or user state
- **THEN** the report marks the value as unknown or data-unavailable rather than supplying a default or recommendation

### Requirement: Audit is isolated from solver diagnostics

The audit SHALL be computed independently of `evaluateWorkspace`. Building, rendering, or exporting
an audit SHALL NOT add, remove, reorder, or reclassify solver diagnostics and SHALL NOT change
assignments, labels, locks, peripheral modes, electrical settings, or undo history.

#### Scenario: Diagnostics stay identical

- **WHEN** the solver report and the audit are computed in either order for the same chip and state
- **THEN** the solver diagnostics and their exact counts and codes are identical in both orders

#### Scenario: Workspace stays immutable

- **WHEN** a user opens the audit tab or copies the audit text export
- **THEN** every version-2 workspace field and the undo and redo stacks remain unchanged

### Requirement: STM32 strapping roles come from pin data

The audit SHALL classify dedicated boot and reset pins from `PinInfo.type` and composite `io` pin
names ending in `-BOOT0` or `-NRST` from the name itself. Pins carrying `SYS.SWDIO` or `SYS.SWCLK`
signals SHALL be classified as debug-swd with the signal as evidence.

#### Scenario: STM32 composite and dedicated pins

- **WHEN** an STM32 chip has a dedicated `boot` pin, an `io` pin named `PA0-BOOT0`, and a pin carrying `SYS.SWDIO`
- **THEN** the report lists boot by pin type, boot by composite name, and debug-swd by signal role with the matching evidence source

### Requirement: CH32 and RP strapping roles come from tags and names

The audit SHALL classify CH32 boot and reset pin types plus `debug-sdi` and `debug-swd` tags from
their shard evidence. An RP `RUN` pin SHALL be reset-and-boot, a `~{QSPI_SS}` pin with `qspi` SHALL
be qspi, and tagged pins SHALL be debug-swd. No BOOTSEL role SHALL be reported.

#### Scenario: CH32 and RP roles

- **WHEN** a CH32 pin is typed `reset` or tagged `debug-sdi`, and an RP chip has `RUN`, `~{QSPI_SS}` with `qspi`, and a `debug-swd` pin
- **THEN** the report lists reset and debug-sdi for CH32 and reset-and-boot, qspi, and debug-swd for RP; no BOOTSEL role appears

### Requirement: Strapping pull and label reflect only user state

For each classified strapping pin, the audit SHALL report the user's configured GPIO pull and custom
label when present. When no pull is configured, the field SHALL be unknown. No upstream source
SHALL be treated as a required pull direction.

#### Scenario: Pull configured by the user

- **WHEN** a strapping pin has a configured pull of Up or Down and a custom label in workspace state
- **THEN** the report shows that pull and label with user state as the evidence source

#### Scenario: Pull not configured

- **WHEN** a strapping pin has no configured pull and no custom label
- **THEN** the pull is unknown and the label is absent, with no required direction reported

### Requirement: Interface and power presence comes from parts and pin names

The audit SHALL list I2C and USB interfaces from declared peripherals and active peripheral modes,
oscillator signals from emitted `OSC*` pin signal names, and power domains from pins typed `power`
with their domain names. Decoupling counts, I2C pull-up values, USB series or ESD parts, guard
rings, and VCAP values SHALL be marked data-unavailable when no source supplies them. Where an
upstream dataset contains crystal load-capacitance values, the audit SHALL NOT emit numeric values.

#### Scenario: Interfaces and oscillators present

- **WHEN** a chip declares I2C and USB peripherals with matching active modes and pins named `OSC_IN` and `OSC_OUT`
- **THEN** the report lists I2C and USB as present with peripheral and mode evidence and lists both oscillator signals with pin-name evidence

#### Scenario: Passive data unavailable

- **WHEN** an audit is built for any chip
- **THEN** passive fields without upstream rows are marked data-unavailable and no resistor, capacitor, or VCAP number is emitted

#### Scenario: Power domains

- **WHEN** a chip emits power pins whose names carry domain identifiers
- **THEN** the report lists those domain identifiers with pin-type evidence and no decoupling-capacitor count

### Requirement: Unused pins and bonded pads are enumerated

The audit SHALL list every unassigned `io` pin by position and name as implicitly unused, and SHALL
list every pin with multiple `bondedNames` and the `bonded` tag with all bonded pad names. Slash-named
pins without `bondedNames` SHALL NOT be listed as bonded. The audit SHALL NOT emit an analog-mode
recommendation for unused pins.

#### Scenario: Unused I/O pins

- **WHEN** a workspace leaves `io` pins without assignments
- **THEN** the report lists each by position and name with implicit-unused evidence and no recommended mode

#### Scenario: Bonded pads

- **WHEN** a CH32 pin carries `bondedNames` with PD1 and PD6 and the `bonded` tag
- **THEN** the report lists both pad names as bonded with shard evidence

#### Scenario: STM32 slash-named pin

- **WHEN** an STM32 pin name contains a slash but the pin has no `bondedNames` or `bonded` tag
- **THEN** the report does not list that pin in the bonded section

### Requirement: Voltage tolerance facts are tag- or label-driven

The audit SHALL report `5v-tolerant` when a pin carries the `5v-tolerant` tag, and SHALL report
`user-labeled-5v` when no tag exists and the custom label matches `5V_*` or `UART_5V`. For all other
pins the tolerance SHALL be unknown. The audit SHALL NOT turn a user label into a device tolerance
claim and SHALL NOT assert a voltage value for an unknown pin.

#### Scenario: Tag-backed tolerance

- **WHEN** a pin carries the `5v-tolerant` tag
- **THEN** the report states 5v-tolerant with shard-tag evidence

#### Scenario: User label without a tag

- **WHEN** a pin has no tolerance tag and its custom label is `UART_5V_TX`
- **THEN** the report states user-labeled-5v with user-label evidence and does not claim device tolerance

#### Scenario: No tolerance evidence

- **WHEN** a pin has no tolerance tag and no matching label, including STM32 and RP pins without per-pin tolerance data
- **THEN** the report states unknown without a voltage claim

### Requirement: CH32 adapter reads tolerance evidence

The CH32 adapter SHALL read `evidence/pins.csv` in addition to its manifest-verified `index/` tables
and add the existing `5v-tolerant` tag when the row matching by part number, pin position, and pad
name has `type` of `I/O/FT` after trimming and case folding. Plain `I/O` SHALL not add the tag. The
file SHA-256 SHALL be recorded in generated provenance, and no compatibility shim SHALL be produced.

#### Scenario: FT pin is tagged

- **WHEN** `evidence/pins.csv` has an `I/O/FT` row for a priority CH32 part and its pin and pad
- **THEN** the emitted shard pin carries `5v-tolerant` and `meta.json` records the evidence file digest

#### Scenario: Plain I/O pin is not tagged

- **WHEN** the matching evidence row has `type` of `I/O`
- **THEN** the emitted pin carries no `5v-tolerant` tag from that row

### Requirement: CH32 gate asserts tolerance evidence

The CH32 generation gate SHALL fail when a regenerated priority part has no pin carrying the
`5v-tolerant` tag and SHALL name the failing part in the error.

#### Scenario: Gate rejects a missing tag

- **WHEN** a regenerated priority CH32 part has no `5v-tolerant` pin
- **THEN** the CH32 generation gate fails and names the part

### Requirement: Audit is visible and exportable without new settings

The workspace SHALL expose a read-only Audit tab in the right-pane summary drawer and a plain-text
Audit export that renders the same structured facts in deterministic order. Where the portrait dock
from `viewport-locked-workspace` is present, the audit panel SHALL be reachable from that dock through
its existing persisted active-tab field and SHALL NOT introduce a second unpersisted tab state. The
audit SHALL NOT add fields to workspace state, history, share links, project files, or sessions.

#### Scenario: Review the audit in the workspace

- **WHEN** a user opens the Audit tab in the right pane
- **THEN** the four sections are displayed read-only with no editable control and no diagnostic badge

#### Scenario: Export audit facts

- **WHEN** a user selects the Audit export and copies or downloads it
- **THEN** the text contains the same facts in a stable order and no workspace field changes

#### Scenario: Portrait dock integration

- **WHEN** the portrait dock is active and the persisted dock tab selects Audit
- **THEN** the audit panel is the visible dock body and the selection survives reload and sharing through the existing dock-tab field

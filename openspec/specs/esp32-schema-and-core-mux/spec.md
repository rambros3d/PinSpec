# esp32-schema-and-core-mux Specification

## Purpose

Defines additive core schema and routing semantics for ESP32 chips: a fourth
vendor identity, a GPIO matrix mux model, electrical pin tags, signal direction,
matrix-aware solver invariants and diagnostics, and guarantees that existing
vendor behavior stays unchanged.

## Requirements

### Requirement: ESP32 vendor and GPIO matrix mux model are first-class

The chip schema SHALL accept `esp32` as a `VendorId` and `gpio-matrix` as a
`MuxModel` without overloading `af`, `remap-group`, or `funcsel-pio`. A chip
that declares `vendor: 'esp32'` with no explicit `muxModel` SHALL resolve to
`gpio-matrix`. A matrix route SHALL be labeled from its display label or signal
name rather than an alternate-function index. Existing vendor and mux values
SHALL resolve and render as before.

#### Scenario: ESP32 chip resolves to the matrix mux model

- **WHEN** a chip shard declares `vendor: 'esp32'` and omits `muxModel`
- **THEN** the resolved mux model is `gpio-matrix` and no alternate function is inferred

#### Scenario: Matrix route label uses the route display label

- **WHEN** a matrix route carries a display label or a signal name
- **THEN** the rendered label uses that value instead of an AF or FUNCSEL index

#### Scenario: Existing mux labels are unchanged

- **WHEN** a chip uses `af`, `remap-group`, or `funcsel-pio`
- **THEN** its mux labels match the behavior before this capability existed

### Requirement: ESP32 pin tags are additive and descriptive

Pin metadata SHALL accept the tags `strapping`, `input-only`, `adc-only`,
`rtc`, `lp`, `jtag`, `flash`, `psram`, and `cap-restricted` in addition to the
existing tag set. ESP32 USB and analog pins SHALL reuse the existing `usb` and
`adc` tags. Chips without the new tags SHALL keep their existing diagnostics
and scoring outcomes.

#### Scenario: Matrix chip carries electrical tags

- **WHEN** an ESP32 pin is emitted with one or more of the new tags
- **THEN** the tags are preserved as pin metadata and are available to diagnostics and scoring

#### Scenario: Existing tags are reused

- **WHEN** an ESP32 USB or analog pin is described
- **THEN** the chip uses the existing `usb` or `adc` tag rather than a duplicate value

#### Scenario: Untagged chips keep their behavior

- **WHEN** a chip has none of the new tags
- **THEN** tag-driven diagnostics and scoring are identical to the previous behavior

### Requirement: Matrix signal direction defines route cardinality

Chip signal metadata SHALL carry an optional direction of `input` or `output`
for matrix routes. For a matrix peripheral output, one signal MAY drive several
GPIOs. For a matrix peripheral input, a GPIO SHALL be the only source of that
signal. A GPIO input MAY feed several peripheral inputs, and a GPIO output
SHALL be driven by at most one peripheral output. Non-matrix chips SHALL keep
the single-source rule for every signal.

#### Scenario: Peripheral output fans out to several GPIOs

- **WHEN** a matrix peripheral output signal is assigned to two GPIO positions
- **THEN** no duplicate-signal error is emitted for those positions

#### Scenario: Peripheral input has one source

- **WHEN** two GPIO positions are assigned to the same matrix peripheral input signal
- **THEN** a duplicate-signal error names both positions

#### Scenario: GPIO input fan-out is not a driver conflict

- **WHEN** a GPIO input is routed to a matrix peripheral input while that GPIO input remains available to other peripheral inputs
- **THEN** the solver does not report a driver-conflict diagnostic for that pin

#### Scenario: GPIO output has one driver

- **WHEN** two peripheral output signals are assigned to drive the same GPIO output
- **THEN** the conflicting assignment is reported as an error naming that pin

#### Scenario: Non-matrix duplicate remains an error

- **WHEN** an STM32, CH32, or RP peripheral signal is assigned to two pins
- **THEN** a duplicate-signal error is emitted as before

### Requirement: Input-only pins cannot drive output signals

A pin tagged `input-only` SHALL NOT support a peripheral output assignment or
a GPIO output assignment. Candidate discovery, automatic allocation, one-hop
fixes, and alternate-pin discovery SHALL exclude or reject those assignments
for such a pin. The same pin SHALL remain usable for input roles.

#### Scenario: Output assignment to an input-only pin is rejected

- **WHEN** a peripheral output signal is assigned to a pin tagged `input-only`
- **THEN** the assignment is rejected with an error naming the pin

#### Scenario: Input assignment to an input-only pin is accepted

- **WHEN** a peripheral input signal or a GPIO input is assigned to a pin tagged `input-only`
- **THEN** the assignment is accepted

#### Scenario: Alternates exclude input-only pins for outputs

- **WHEN** alternate pins are discovered for a peripheral output on a matrix chip
- **THEN** pins tagged `input-only` do not appear as valid candidates

### Requirement: Matrix placement scoring is additive and bounded

For matrix chips, candidate scoring SHALL prefer a direct IO_MUX route over a
routed matrix path for speed-critical signals and SHALL penalize strapping,
input-only, and capability-restricted pins. The matrix term SHALL be zero for
chips that are not `gpio-matrix`, so shared scoring output is unchanged for
existing vendors. Candidate ordering SHALL be deterministic and the alternate
pin list SHALL be bounded for matrix chips.

#### Scenario: Direct route is preferred

- **WHEN** a speed-critical peripheral signal can use a direct IO_MUX route or a routed matrix path
- **THEN** the direct-route pin ranks ahead of the routed pin

#### Scenario: Constrained pins are penalized

- **WHEN** a matrix candidate pin carries a strapping, input-only, or capability-restricted tag
- **THEN** its score is penalized relative to an equivalent unconstrained candidate

#### Scenario: Existing scores are byte-identical

- **WHEN** a non-matrix chip is scored with the same workspace as before this capability
- **THEN** every score and assignment is identical to the previous output

#### Scenario: Alternate candidates are bounded and deterministic

- **WHEN** a matrix chip exposes many pins supporting one peripheral signal
- **THEN** alternate discovery returns a bounded list in a stable order

### Requirement: ESP32 diagnostics report electrical and matrix hazards

The solver SHALL emit `STRAPPING_REPURPOSED` when a strapping pin is repurposed,
`INPUT_ONLY_OUTPUT` when an input-only pin is asked to drive,
`ADC2_WIFI_CONFLICT` when an ADC2 channel is used while Wi-Fi is enabled, and
`MATRIX_ROUTE_LIMIT` when declared matrix route capacity is exceeded. Each code
SHALL name the affected pins and carry a severity consistent with existing
diagnostics. Existing diagnostic codes and outcomes SHALL be unchanged.

#### Scenario: Strapping pin is repurposed

- **WHEN** a pin tagged `strapping` is assigned to a non-strapping role
- **THEN** a `STRAPPING_REPURPOSED` warning names that pin

#### Scenario: Input-only pin is asked to drive

- **WHEN** a pin tagged `input-only` is assigned a peripheral output
- **THEN** an `INPUT_ONLY_OUTPUT` error names that pin

#### Scenario: ADC2 channel overlaps Wi-Fi

- **WHEN** an ADC2 channel assignment coexists with an enabled Wi-Fi peripheral
- **THEN** an `ADC2_WIFI_CONFLICT` warning names the affected pin

#### Scenario: Matrix route capacity is exceeded

- **WHEN** a chip declares a matrix route capacity and assignments exceed it
- **THEN** a `MATRIX_ROUTE_LIMIT` warning names the affected pins

#### Scenario: Existing diagnostics are unchanged

- **WHEN** an STM32, CH32, or RP workspace is evaluated
- **THEN** its diagnostics and severities match the behavior before this capability

### Requirement: Core stays pure and version-2 state is unchanged

All added schema and solver behavior SHALL remain in pure TypeScript with no
Svelte or DOM imports. No new workspace-state field SHALL be introduced, so
version-2 share URL and project JSON serialization SHALL be unchanged. With no
matrix chip in use, STM32, CH32, and RP allocations, scores, labels, and
diagnostics SHALL match prior output exactly.

#### Scenario: STM32 scoring snapshots are stable

- **WHEN** an STM32 workspace is allocated and compared with a pre-change snapshot
- **THEN** all scores, assignments, and diagnostics are byte-identical

#### Scenario: Version-2 serialization is unchanged

- **WHEN** a workspace is exported to a share URL and a project file
- **THEN** the encoded schema is the same version-2 shape as before this capability

#### Scenario: Core remains host-testable

- **WHEN** the core is imported in a host-side unit test
- **THEN** no Svelte or browser API is required

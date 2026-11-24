# esp32-ui-exporters-and-docs Specification

## Purpose

Defines how application surfaces present ESP32 chips after the core, placement,
and data adapter changes: discovery and starter chips, electrical-fact display,
esp-hal and C export mechanics, provenance attribution, and non-regression for
the existing vendors.

## Requirements

### Requirement: ESP32 starter chips are the only ESP32 preset surface

The start screen SHALL offer ESP32 starter chips whose identifiers resolve to
generated module shards. No ESP32 board preset SHALL be offered, and `.ioc`
import SHALL remain a start-screen-only STM32 entry point.

#### Scenario: Open an ESP32 starter chip

- **WHEN** a user selects an ESP32 starter chip
- **THEN** the workspace loads the generated module shard for that identifier through the same handoff used by other vendors

#### Scenario: No ESP32 board preset

- **WHEN** the board preset control is opened
- **THEN** it lists STM32 board presets only and no ESP32 board preset

#### Scenario: Import remains STM32-only

- **WHEN** a user imports an `.ioc` file on the start screen
- **THEN** the importer resolves STM32 parts and no ESP32 import or drop target is offered

### Requirement: ESP32 electrical facts are presented without loss

Pin views SHALL display the ESP32 electrical tags introduced by the schema
change and SHALL surface solver diagnostics from those tags without rewriting
their values. Tags without a known display label SHALL NOT be silently dropped.

#### Scenario: Electrical tag pills

- **WHEN** an ESP32 pin carries `strapping`, `input-only`, `flash`, or another schema-defined electrical tag
- **THEN** the pin view shows a monochrome pill for that tag in the shared stable tag order

#### Scenario: Diagnostics are surfaced

- **WHEN** the solver reports an ESP32 electrical or matrix diagnostic for an assignment
- **THEN** the existing summary and diagnostic surfaces show that code, severity, and affected pins

#### Scenario: No fabricated electrical value

- **WHEN** an ESP32 shard omits an electrical fact
- **THEN** the UI shows no inferred value for that fact and records no new pin-configuration field

### Requirement: ESP32 exports use matrix-aware identifiers

Rust and C exports for ESP32 SHALL use esp-hal crate paths and GPIO-number pin
identifiers, and SHALL annotate matrix routes without alternate-function
macros. CSV, JSON, and share-link output SHALL remain vendor-neutral.

#### Scenario: ESP32 Rust export

- **WHEN** an ESP32 pinout with assigned GPIO pins is exported to Rust
- **THEN** the output uses `use esp_hal::peripherals;`, calls `esp_hal::init()`, and names each pad from its GPIO number

#### Scenario: Matrix route comments

- **WHEN** an ESP32 assignment carries a matrix display label or signal name
- **THEN** the Rust and C output includes that label as a matrix-route comment and emits no `_AF` macro

#### Scenario: Empty ESP32 board

- **WHEN** an ESP32 workspace with no assignments is exported to Rust or C
- **THEN** both outputs are valid empty structs or guarded empty headers without GPIO macros

#### Scenario: Neutral formats unchanged

- **WHEN** an ESP32 workspace is exported to CSV, JSON, or a share link
- **THEN** the existing vendor, mux, and version-2 schemas are used with no new field

### Requirement: Provenance attribution covers eleven sources

The start screen footer, document metadata, and repository documentation SHALL
credit the eleven canonical sources and list all four vendors with live counts
and source revisions from generated metadata.

#### Scenario: Footer lists all sources

- **WHEN** generated metadata is available
- **THEN** the footer lists the seven existing sources and the four ESP32 sources with their licenses, revisions, and per-vendor counts

#### Scenario: ESP32 vendor entry

- **WHEN** the provenance vendor summary is rendered
- **THEN** it includes `esp32` alongside STM32, CH32, and RP and reads its count from the generated metadata

#### Scenario: Documentation and metadata agree

- **WHEN** the repository documentation and document metadata are inspected
- **THEN** they describe four vendors and eleven sources and contain no STM32-only coverage claim

### Requirement: Existing vendors keep their behavior

Adding ESP32 SHALL NOT change STM32, CH32, or RP discovery order, labels,
exports, or generated output, and SHALL NOT reintroduce surfaces removed by the
start-screen change.

#### Scenario: Existing exports are unchanged

- **WHEN** existing STM32, CH32, and RP workspaces are exported to Rust and C
- **THEN** the output matches the behavior before this change byte for byte

#### Scenario: Existing tabs and tags are ordered as before

- **WHEN** vendor tabs and pin tag pills are built for a non-ESP32 chip
- **THEN** their identifiers, labels, and relative order match the previous output

#### Scenario: No removed surface returns

- **WHEN** the start screen is mounted
- **THEN** no hero chip preview and no landing export preview is present

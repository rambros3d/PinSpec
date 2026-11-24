# Spec Delta

## MODIFIED Requirements

### Requirement: Rust export dispatches by vendor
The system SHALL emit a Rust `BoardPins` struct whose import path and pin bindings match the chip vendor: `embassy_stm32` for STM32, `embassy_rp` for RP, `ch32_hal` for CH32, and `esp_hal` for ESP32. Custom labels SHALL be sanitized to unique snake_case field names, and unassigned boards SHALL emit a valid empty struct.

#### Scenario: RP board export
- **WHEN** a pinout for an RP chip with assigned GPIO pins is exported to Rust
- **THEN** the output imports `embassy_rp`, declares `BoardPins`, and its `from_peripherals` initializer takes `embassy_rp::Peripherals`

#### Scenario: CH32 board export
- **WHEN** a pinout for a CH32 chip is exported to Rust
- **THEN** the output imports `ch32_hal` and contains no `embassy_stm32` reference

#### Scenario: STM32 board export
- **WHEN** a pinout for an STM32 chip is exported to Rust
- **THEN** the output imports `embassy_stm32` and preserves the existing `BoardPins` shape

#### Scenario: ESP32 board export
- **WHEN** a pinout for an ESP32 chip with assigned GPIO pins is exported to Rust
- **THEN** the output imports `esp_hal::peripherals`, calls `esp_hal::init()`, declares `BoardPins`, and names each pad from its GPIO number

### Requirement: Export mux annotations follow the chip mux model
Exported mux annotations SHALL use `funcLabel` when present, otherwise `F<index>` for RP, `RM<remapId>` for CH32, `AF<index>` for STM32, the matrix display label or signal name for ESP32, and the GPIO mode for plain GPIO. Literal `AF<n>` text SHALL NOT be emitted for a non-AF mux model.

#### Scenario: CH32 remapped signal
- **WHEN** a CH32 assignment carries `remapId` 1 and no `funcLabel`
- **THEN** its annotation in Rust, C, and CSV output is `RM1` and not `AF1`

#### Scenario: RP FUNCSEL signal with a display label
- **WHEN** an RP signal declares `funcLabel` "F4" with a numeric FUNCSEL index
- **THEN** all export formats display "F4"

#### Scenario: ESP32 matrix signal
- **WHEN** an ESP32 assignment carries a matrix display label or signal name
- **THEN** all export formats include that label as a matrix-route annotation and no `AF` index

### Requirement: C header dispatches by vendor
The system SHALL emit a guarded C header whose per-pin macros match the chip vendor: STM32 `_GPIO_PORT`/`_PIN`/`_AF`, RP Pico SDK `GPIO_FUNC_*` plus PWM slice and channel macros, CH32 ch32v003fun macros plus a comment summary of the active remap group, and ESP32 GPIO-number macros plus matrix function comments. No ESP32 header SHALL emit an `_AF` macro.

#### Scenario: RP PWM header
- **WHEN** an RP pin assigned to a PWM signal with a shared PWM slice resource is exported to C
- **THEN** the header defines `GPIO_FUNC_*` and PWM slice/channel macros and contains no `_AF` macro

#### Scenario: CH32 remap header
- **WHEN** a CH32 pinout with an active remap group is exported to C
- **THEN** the header uses ch32v003fun macros and includes a remap-summary comment naming the active remap

#### Scenario: ESP32 matrix header
- **WHEN** an ESP32 pinout with assigned GPIO pins is exported to C
- **THEN** the header defines `GPIO<n>` macros and matrix function comments and contains no `_AF` macro

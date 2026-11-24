# multi-vendor-mux Specification

## Purpose

Defines vendor-driven mux resolution and diagnostics in the pure TypeScript core: tag-based debug/clock warnings, coupled remap-group switching, shared hardware resource collision detection, and RP PIO/GPIOBASE validation, preserving STM32 behavior while enabling CH32 and RP data.

## Requirements

### Requirement: Debug and clock diagnostics are tag-driven
The solver MUST derive debug-pin and clock-pin diagnostics from `PinInfo.tags` and signal roles rather than hardcoded STM32 pin names or `RCC`-only mode checks. It MUST emit `DEBUG_PIN_REPURPOSED` for debug pins, `BONDED_PIN_NOTE` for bonded pins and `RP_HARDWARE_HINT` for RP hardware hints, while producing the same diagnostic outcomes for existing STM32 data.

#### Scenario: STM32 SWD warning is preserved
- **WHEN** an STM32 GPIO with a `debug-swd` tag is repurposed to another peripheral
- **THEN** the solver emits a debug-pin repurposing warning as before, without referencing PA13/PA14 by name

#### Scenario: CH32 bonded pin is noted
- **WHEN** a CH32 pin with the `bonded` tag is assigned
- **THEN** the solver emits an informational `BONDED_PIN_NOTE` diagnostic

### Requirement: Remap groups switch atomically
The solver MUST support `WorkspaceState.activeRemaps` by moving all signals of a selected `PeripheralRemapOption` together as one operation. A locked target pin MUST block the move and produce a `REMAP_LOCKED` diagnostic; an occupied target MUST produce a `REMAP_MISMATCH` diagnostic identifying the conflict. Remap-related one-hop fixes MUST carry enough fields to describe a group move.

#### Scenario: Atomic remap of a peripheral
- **WHEN** a remap group is selected for a CH32 peripheral
- **THEN** every signal in that group is relocated to its remap target in one state transition and no signal is left on the old pins

#### Scenario: Locked remap target blocks the move
- **WHEN** a target pin of a remap group is locked
- **THEN** the state is unchanged and a `REMAP_LOCKED` diagnostic names the blocking pin

#### Scenario: Occupied remap target is diagnosed
- **WHEN** a target pin of a remap group is occupied by another peripheral
- **THEN** a `REMAP_MISMATCH` diagnostic identifies both the remap peripheral and the occupying assignment

### Requirement: Shared resource collisions are errors
The solver MUST detect when two active assignments carry the same non-empty `resourceId` and emit a `RESOURCE_CONFLICT` error that lists both pins and marks both as conflicting. This MUST cover RP PWM slice wrap (A/B sharing a slice) and other shared hardware resources.

#### Scenario: PWM slice channel collision
- **WHEN** two GPIOs are assigned FUNCSEL functions whose `resourceId` is `PWM0A` and `PWM0B`
- **THEN** the solver emits a `RESOURCE_CONFLICT` error listing both pins and marks both pins red

#### Scenario: Distinct resources are allowed
- **WHEN** two GPIOs carry `PWM0A` and `PWM1A`
- **THEN** no resource conflict is emitted for those pins

### Requirement: RP PIO blocks and GPIOBASE windows are validated
The solver MUST validate RP PIO assignments by reserving contiguous blocks of PIO state machines and by checking every PIO-bound pin against the chip's `gpioBaseOptions`. Pin positions outside every valid 32-pin GPIOBASE window MUST emit a `PIO_GPIOBASE_CONFLICT` error naming the pin. RP2350B MUST accept windows starting at GPIO0 or GPIO16 only.

#### Scenario: Valid shifted GPIOBASE window
- **WHEN** RP2350B PIO pins lie in GPIO16-47 and the base option `[0, 16]` is available
- **THEN** no GPIOBASE conflict is emitted

#### Scenario: Invalid GPIOBASE window
- **WHEN** an RP2350B PIO pin lies outside GPIO0-31 and GPIO16-47
- **THEN** a `PIO_GPIOBASE_CONFLICT` error names the pin

#### Scenario: Overlapping PIO block
- **WHEN** two PIO assignments request the same PIO state machine
- **THEN** the solver emits a resource conflict for that state machine

### Requirement: Extended assignment fields survive all core operations
Every core operation that reconstructs a `PinAssignment` MUST preserve `funcLabel`, `remapId` and `resourceId` from the source assignment. Solver reports MUST expose `infoCount` and the new diagnostic codes. The core MUST remain pure TypeScript with no Svelte or DOM imports, and no legacy compatibility shims.

#### Scenario: Remap preserves extended fields
- **WHEN** an assignment carrying a `resourceId` and `funcLabel` is moved to an alternate pin
- **THEN** the resulting assignment retains both fields

#### Scenario: Report counts informational diagnostics
- **WHEN** a workspace has informational diagnostics
- **THEN** `SolverReport.infoCount` equals the number of emitted info diagnostics

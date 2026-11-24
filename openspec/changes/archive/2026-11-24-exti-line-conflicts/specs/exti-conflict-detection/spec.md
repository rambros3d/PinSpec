# Spec Delta

## Purpose

Detects when two GPIO pins assigned the EXTI signal share the same hardware EXTI line by deriving line identifiers from pin names in the pure core, and surfaces the conflict in the workspace without changing generated catalog data.

## ADDED Requirements

### Requirement: EXTI line identifiers derive from pin names
The system SHALL derive an `EXTI<n>` line identifier for GPIO pins in the pure core from the numeric GPIO index in the pin name, so pins at the same index across different ports resolve to the same line. The rule SHALL apply to STM32 and CH32 parts.

#### Scenario: Same index across ports derives one line
- **WHEN** pins `PA0`, `PB0`, and `PC0` are evaluated
- **THEN** each derives the line identifier `EXTI0`

#### Scenario: Higher index derives its own line
- **WHEN** pin `PA13` is evaluated
- **THEN** it derives the line identifier `EXTI13`

### Requirement: Derived EXTI resource is attached at evaluation time
The system SHALL attach the derived EXTI line identifier as a resource identifier to `GPIO` / `EXTI` assignments during workspace evaluation, before shared-resource conflict analysis runs. Generated chip shards SHALL NOT be modified to carry this data.

#### Scenario: Derived line feeds conflict analysis
- **WHEN** a workspace contains a `GPIO` / `EXTI` assignment
- **THEN** evaluation supplies a derived line identifier that shared-resource conflict analysis consumes

#### Scenario: On-disk data is unchanged
- **WHEN** evaluation completes
- **THEN** the chip shard on disk is unchanged

### Requirement: Shared EXTI lines are reported as conflicts
The system SHALL emit an `EXTI_LINE_CONFLICT` diagnostic when two pins derive the same EXTI line identifier, listing both pins and marking both as conflicting. Distinct line identifiers SHALL NOT produce an EXTI conflict.

#### Scenario: Shared line is a conflict
- **WHEN** `PA0` and `PB0` are both assigned `GPIO` / `EXTI`
- **THEN** an `EXTI_LINE_CONFLICT` error names both pins and both are marked as conflicting

#### Scenario: Distinct lines are allowed
- **WHEN** `PA0` and `PB1` are both assigned `GPIO` / `EXTI`
- **THEN** no EXTI conflict is emitted for those pins

### Requirement: Non-EXTI behavior is unchanged
The system SHALL leave non-GPIO pins, non-EXTI assignments, and all pre-existing diagnostics unchanged. Pins without a derivable GPIO index SHALL NOT gain an EXTI line identifier or an EXTI conflict.

#### Scenario: Workspace without EXTI assignments
- **WHEN** a workspace has no `GPIO` / `EXTI` assignments
- **THEN** evaluation emits no EXTI diagnostics and existing diagnostic counts are unchanged

#### Scenario: Non-GPIO pin has no derived line
- **WHEN** an assignment is on a pin that is not a GPIO pin
- **THEN** no EXTI line identifier is derived for it

### Requirement: Derived EXTI line is displayed in the workspace
The workspace SHALL display the derived EXTI line identifier for `GPIO` / `EXTI` assignments in the pin popover, context menu, and hover tooltip.

#### Scenario: Line identifier is visible
- **WHEN** a user inspects a pin assigned `GPIO` / `EXTI`
- **THEN** the UI shows the derived line identifier such as `EXTI0`

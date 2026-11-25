# Spec Delta

## Purpose

Adjusts the generated project-name format while keeping name reuse and
shareability unchanged.

## MODIFIED Requirements

### Requirement: New workspaces receive a generated project name

Every newly created workspace session SHALL receive a project name made of
exactly two curated words joined by `-`, chosen through an injectable RNG. The
generator SHALL NOT read any MCU fact. Existing saved names SHALL be reused
verbatim without regeneration.

#### Scenario: Generated name format

- **WHEN** a new workspace is created and the injected RNG selects `amber` and `quartz`
- **THEN** the project name is `amber-quartz` for every chip family and MCU

#### Scenario: Injected RNG is deterministic

- **WHEN** the same injected RNG sequence is used to create two workspaces
- **THEN** both workspaces receive the same two-word name without a host-level random source

#### Scenario: Family suffix falls back to the MCU identifier

- **WHEN** a generated chip has no family identifier and its MCU identifier is `RP2040`
- **THEN** the name is still two curated words and contains no `rp2040` suffix

#### Scenario: Name characters and length are bounded

- **WHEN** any project name is generated
- **THEN** it contains only lowercase letters, digits, and hyphens, is at most 48 characters long, and contains no emoji or color token

#### Scenario: Suffixes use only generated chip data

- **WHEN** new workspaces are created for STM32, CH32, RP, ESP32, Microchip, and Nordic chips
- **THEN** no family or MCU identifier appears in any generated name and no part table is consulted

#### Scenario: No chip facts enter generated names

- **WHEN** the project-name generator is called with any chip metadata
- **THEN** its output depends only on the injected RNG samples

#### Scenario: Saved names are not rewritten

- **WHEN** a session with the stored name `amber-quartz-stm32h5` is reopened
- **THEN** its project name remains `amber-quartz-stm32h5`

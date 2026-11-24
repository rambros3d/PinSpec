# Spec Delta

## Purpose

Defines electrically legal live placement for matrix-mux chips such as ESP32,
covering backtracking reallocation, legality filtering and electrical penalties,
exclusive channel resources, post-allocation validation, bounded alternate
lists, hard lock constraints, and unchanged behavior for non-matrix chips.

## ADDED Requirements

### Requirement: Matrix placement reallocation uses backtracking

For chips whose mux model is a pin matrix, live placement reallocation SHALL
select pins through a backtracking search over the required signals instead of
a greedy per-signal pick. The search SHALL consider every candidate pin for each
signal, enforce at most one assignment per physical pin, and prefer a complete
legal plan over a partial one.

#### Scenario: A complete plan replaces a greedy collision

- **WHEN** a matrix chip peripheral has several signals whose individually best pins collide on one physical pin
- **THEN** reallocation returns a plan that assigns all signals to distinct physical pins

#### Scenario: The search backtracks past an attractive candidate

- **WHEN** the highest-affinity candidate for an early signal blocks a legal placement of a later signal
- **THEN** reallocation selects an alternative candidate for the early signal instead of leaving the later signal unallocated

### Requirement: Live matrix previews are electrically legal

Every intermediate preview and every committed state produced by a matrix
placement drag SHALL be electrically legal before it is shown. A candidate that
creates a duplicate signal, a shared-resource conflict, or an ESP32-specific
electrical hazard SHALL be discarded during search, so no illegal plan is
rendered at any point in the drag.

#### Scenario: Illegal top-ranked pins are skipped

- **WHEN** a drag moves an indicator across angles and radii whose top-ranked candidate pins are electrically illegal
- **THEN** each rendered preview uses only legal assignments

#### Scenario: No legal candidate leaves the signal unallocated

- **WHEN** no legal candidate exists for a required signal at the current placement preference
- **THEN** that signal is left unallocated and reported instead of assigning an illegal pin

### Requirement: Electrical penalties rank legal candidates

For matrix chips, candidate ranking SHALL apply electrical penalties after
legality filtering and before angular and radial affinity. The penalties SHALL
cover boot-strapping pins, input-only pins used for outputs, ADC2 pins when
Wi-Fi or Bluetooth is active, and flash or PSRAM reserved pins. Geometry SHALL
never outrank a lower-penalty legal candidate.

#### Scenario: A strapping pin is avoided

- **WHEN** a matrix signal has both a legal strapping candidate and a legal non-strapping candidate
- **THEN** the non-strapping candidate is selected

#### Scenario: An input-only pin is not used as an output

- **WHEN** a matrix signal requires output capability and its closest candidate is input-only
- **THEN** an output-capable legal candidate is selected instead

#### Scenario: ADC2 is avoided while a radio is active

- **WHEN** Wi-Fi or Bluetooth is active and a signal has both ADC2 and non-ADC2 legal candidates
- **THEN** a non-ADC2 candidate is selected

#### Scenario: Flash and PSRAM pins are excluded

- **WHEN** a candidate pin is reserved for flash or PSRAM
- **THEN** that pin is excluded from selection regardless of its angular and radial score

### Requirement: Channel resource identifiers are exclusive

For matrix chips, an active assignment's LEDC, RMT, or GDMA channel resource
identifier SHALL be treated as an exclusive resource. Two active assignments
SHALL NOT claim the same resource identifier; a collision SHALL be reported as
a RESOURCE_CONFLICT that identifies both pins.

#### Scenario: A channel collision is reported

- **WHEN** two active matrix assignments resolve to the same LEDC channel resource identifier
- **THEN** a RESOURCE_CONFLICT diagnostic lists both affected pins

#### Scenario: Distinct channels pass validation

- **WHEN** every active matrix assignment resolves to a distinct channel resource identifier
- **THEN** no resource conflict diagnostic is reported for those assignments

### Requirement: Matrix reallocation validates the resulting plan

After each matrix placement reallocation, the system SHALL validate the
resulting assignments for DUPLICATE_SIGNAL, RESOURCE_CONFLICT, and the
ESP32-specific diagnostics supplied by the version-2 schema and core mux
capability, reporting every involved pin and signal. Validation SHALL NOT
mutate assignments during a live preview.

#### Scenario: A duplicate signal is reported

- **WHEN** a reallocation leaves the same peripheral signal assigned to two physical pins
- **THEN** a DUPLICATE_SIGNAL diagnostic identifies both pins

#### Scenario: Adapter hazard evidence surfaces as a diagnostic

- **WHEN** chip data marks a selected matrix pin with an electrical hazard that has a corresponding ESP32 diagnostic
- **THEN** that diagnostic is reported for the pin without mutating the preview state

#### Scenario: A legal plan adds no conflict

- **WHEN** a complete legal plan is produced for a matrix peripheral
- **THEN** no new conflict diagnostic is added for that peripheral

### Requirement: Locked pins are hard constraints in matrix reallocation

In matrix placement reallocation, locked pins SHALL be excluded from the
candidate set and their existing assignments SHALL count as satisfied signals.
The search SHALL NOT move, clear, or overwrite a locked pin. When no legal plan
exists without moving a locked pin, the affected signal SHALL remain unallocated
and be reported.

#### Scenario: A locked signal stays fixed while others are placed

- **WHEN** a locked pin hosts a required signal of the dragged matrix peripheral
- **THEN** reallocation keeps that assignment and places the remaining signals around it

#### Scenario: No plan displaces a locked pin

- **WHEN** the only legal candidate pins for a signal are locked
- **THEN** the signal is reported unallocated and the locked assignments are unchanged

### Requirement: Matrix alternate lists are capped

The highlighted alternate-pin list for a matrix signal SHALL be bounded by a
fixed maximum count after illegal and locked candidates are removed. Remaining
candidates SHALL be ordered by legality, then electrical penalty, then angular
and radial affinity, with physical position as a deterministic final tie-break.

#### Scenario: A large candidate set is capped

- **WHEN** a matrix signal has more legal candidate pins than the fixed maximum
- **THEN** its highlighted alternate list contains at most that maximum number of pins

#### Scenario: Illegal alternates are omitted

- **WHEN** a candidate pin is electrically illegal or locked
- **THEN** that pin is absent from the highlighted alternate list

#### Scenario: Alternate ordering is deterministic

- **WHEN** the same matrix chip and workspace state are queried twice
- **THEN** the highlighted alternate list has the same pins in the same order

### Requirement: Non-matrix chips keep their existing placement behavior

Matrix placement behavior SHALL activate only for chips with a matrix mux
model. For AF, remap-group, and funcsel-pio chips, reallocation SHALL keep the
existing greedy path, default assignments SHALL remain byte-identical, and the
placement affinity term SHALL be exactly zero whenever no preference is
enabled.

#### Scenario: STM32 default allocations are unchanged

- **WHEN** an STM32 chip is allocated with placement disabled
- **THEN** every assigned pin, signal, and score matches the allocator before matrix placement existed

#### Scenario: The placement term is zero when disabled

- **WHEN** no placement preference is enabled on any chip
- **THEN** the additive placement term evaluates to zero for every candidate pin

#### Scenario: Non-matrix drags use the greedy path

- **WHEN** a peripheral indicator is dragged on a non-matrix chip
- **THEN** reallocation uses the existing greedy path without matrix legality filtering

### Requirement: Hazard facts come from chip data rather than per-MCU rules

Electrical hazard facts used by matrix placement SHALL be derived from chip
shard fields and vendor evidence rather than per-MCU hardcoding. Missing hazard
data SHALL degrade to no penalty rather than a failure, and a synthetic matrix
chip SHALL be sufficient to exercise every legality and penalty rule.

#### Scenario: Shard evidence drives penalties

- **WHEN** a matrix chip shard marks a pin with a strapping or reserved hazard fact
- **THEN** placement applies the corresponding penalty without an MCU-specific branch

#### Scenario: Missing hazard data degrades safely

- **WHEN** a matrix chip shard omits hazard fields
- **THEN** allocation completes with no hazard penalty and no error

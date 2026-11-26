# Spec Delta

## ADDED Requirements

### Requirement: Non-matrix placement uses backtracking

Non-matrix placement reallocation SHALL build one candidate group per
unsatisfied signal and use the shared bounded backtracking search to select a
combination of pins. The search SHALL maximize assigned signals first and total
score second. Greedy per-signal commitment SHALL NOT be used.

#### Scenario: Earlier pin is reconsidered

- **WHEN** a scarce signal's best pin is required by a later signal
- **THEN** the search can move the scarce signal to another pin so both signals remain assigned

#### Scenario: Work stays bounded

- **WHEN** a peripheral has many candidate pins
- **THEN** the search respects the existing node and branch limits used by matrix reallocation

### Requirement: Locked pins and labels follow placement rules

Locked assignments SHALL remain fixed, mark their signals satisfied, and SHALL
NOT be candidates. When an assignment moves to a different pin, its custom label
SHALL move with it. If no candidate can be found for a signal, the previous
assignment and label SHALL be preserved.

#### Scenario: Locked pin stays put

- **WHEN** placement changes for a peripheral with a locked assignment
- **THEN** the locked assignment and its signal satisfaction are unchanged

#### Scenario: Label follows the move

- **WHEN** reallocation moves an assignment from one pin to another
- **THEN** the custom label appears on the new pin and is removed from the old pin

#### Scenario: No candidate preserves state

- **WHEN** a signal has no assignable pin after the search
- **THEN** its prior assignment and label remain in the workspace state

### Requirement: Scoring and persistence stay unchanged

Scarcity, affinity, electrical penalties, matrix legality, and candidate caps
SHALL remain unchanged. Matrix reallocation SHALL keep its current path.
Disabled placement preferences SHALL leave the workspace byte-identical, and no
share or project schema field SHALL change.

#### Scenario: Disabled preference is neutral

- **WHEN** placement reallocation runs with no enabled preference
- **THEN** the resulting workspace matches the input byte for byte

#### Scenario: Matrix path is unchanged

- **WHEN** a flexible-routing package is reallocated
- **THEN** it continues through the existing matrix legality and electrical penalty path

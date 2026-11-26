# Spec Delta

## ADDED Requirements

### Requirement: Placement eligibility is a pure classification

A pure core helper SHALL classify each configured non-GPIO peripheral as
eligible, locked-only, or ineligible from the chip, assignments, and locked
state. An unlocked assigned pin qualifies when it has a free alternate or an
occupied alternate whose occupant is unlocked and has a free alternate of its
own. No deeper chain SHALL be followed.

#### Scenario: Free alternate qualifies

- **WHEN** an assigned non-locked pin has another unlocked, unoccupied pin supporting the same signal
- **THEN** its peripheral is classified eligible

#### Scenario: One-hop occupied alternate qualifies

- **WHEN** the only alternate is occupied by an unlocked pin that itself has a free alternate
- **THEN** its peripheral is classified eligible

#### Scenario: Locked-only is distinct

- **WHEN** a peripheral has assignments but every assigned pin is locked
- **THEN** it is classified locked-only rather than eligible or ineligible

### Requirement: Placement tab shows only actionable peripherals

The placement tab SHALL render eligible peripherals with active toggles,
locked-only peripherals with disabled toggles and an explanatory title, and
SHALL hide ineligible peripherals. GPIO SHALL remain excluded. The empty state
SHALL state that no configured peripheral has a reassignable pin.

#### Scenario: Disabled locked row

- **WHEN** a locked-only peripheral is listed
- **THEN** its checkbox is disabled and its title explains that all assigned pins are locked

#### Scenario: Ineligible row is hidden

- **WHEN** a configured peripheral has no movable pin and is not locked-only
- **THEN** no row is rendered for it in the placement tab

### Requirement: Canvas indicators follow the same eligibility

`PackageCanvas.svelte` SHALL derive placement options from the same eligibility
result used by the panel. Existing stored preferences for temporarily hidden
peripherals SHALL NOT be deleted and SHALL reappear when eligibility returns.

#### Scenario: Panel and canvas agree

- **WHEN** the placement overlay is visible
- **THEN** every indicator corresponds to a row the placement tab allows the user to enable

#### Scenario: Hidden preference survives

- **WHEN** a peripheral becomes ineligible and then eligible again
- **THEN** its stored placement preference is unchanged throughout

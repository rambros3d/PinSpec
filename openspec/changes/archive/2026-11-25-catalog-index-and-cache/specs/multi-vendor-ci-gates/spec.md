# Spec Delta

## ADDED Requirements

### Requirement: Index geometry gate

The shard-integrity gate SHALL reject any index entry whose `vendor` is missing or disagrees with its shard, whose `geometry` is absent or disagrees with the shard's package kind, sides, rows, columns, or exposed-pad flag, or which reintroduces `peripherals` or `series`. Geometry checks SHALL treat omitted optional perimeter or grid fields as equivalent to their generated absence and MUST NOT invent values.

#### Scenario: Geometry agrees with the shard

- **WHEN** generation finishes with each index entry carrying the exact geometry of its shard
- **THEN** the shard-integrity gate passes for all six vendors

#### Scenario: Divergent or missing geometry is rejected

- **WHEN** an index entry declares different sides, rows, columns, or exposed-pad state than its shard, or omits geometry entirely
- **THEN** generation exits non-zero and identifies the offending entry

#### Scenario: Removed index fields are rejected

- **WHEN** an index entry still carries peripheral counts or an upstream series field
- **THEN** generation exits non-zero before any artifact is written

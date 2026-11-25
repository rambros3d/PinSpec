# Spec Delta

## MODIFIED Requirements

### Requirement: Package renderers handle two-sided, exposed-pad, and bonded pins
Package rendering SHALL recognize two-sided packages including `SOP`, draw an exposed thermal pad when the package declares one, and display bonded pin names on pins with multiple internal pads; four-sided and grid layouts SHALL remain unchanged. The same generated package geometry SHALL also drive non-interactive catalog and projects thumbnails after shard refinement, without changing pin placement, mux labels, bonded labels, or interaction behavior in the workspace renderers.

#### Scenario: SOP8 package
- **WHEN** an 8-pin SOP package is opened
- **THEN** its eight pads are laid out on two vertical sides rather than four equal sides

#### Scenario: Exposed-pad QFN
- **WHEN** a QFN package declares an exposed pad
- **THEN** an exposed-pad graphic is drawn in the package body

#### Scenario: Bonded CH32 pin
- **WHEN** a CH32 pin carries multiple bonded names
- **THEN** its label includes the bonded names and carries the bonded visual treatment

#### Scenario: Refined thumbnail uses generated geometry

- **WHEN** a visible catalog row for a two-sided package, an exposed-pad QFN, or a grid part is refined from its shard
- **THEN** the thumbnail uses that shard's package kind, side counts, grid rows and columns, and exposed-pad declaration and agrees with the workspace renderer's geometry classification

#### Scenario: Thumbnail does not duplicate interactive rendering

- **WHEN** a package thumbnail is drawn in a catalog row or session card
- **THEN** it contains no pin hit target, pointer handler, texture filter, mux label, or bonded-name text and the two interactive package renderers remain unchanged

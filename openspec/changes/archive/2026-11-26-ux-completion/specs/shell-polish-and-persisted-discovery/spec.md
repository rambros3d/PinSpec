# Spec Delta

## ADDED Requirements

### Requirement: Catalog results can be sorted and linked directly

The catalog route SHALL offer sorting by part number, pin count, flash, and RAM
over the existing filtered results, with deterministic part-number tie-breaking
and absent memory values sorted last. Each result row SHALL expose a hash link
to its `#/mcu/<PART>` workspace in addition to the existing Open button. Sorting
SHALL be transient view state and SHALL NOT enter localStorage, share URLs, or
version-2 project files.

#### Scenario: Sort changes result order

- **WHEN** a user selects a sort field in the catalog
- **THEN** the visible rows are ordered by that field with stable part-number tie-breaking and without changing the filter set or any persisted state

#### Scenario: Direct part link opens the workspace

- **WHEN** a user activates the part-number link on a catalog row
- **THEN** the hash route becomes `#/mcu/<PART>` for that row's part and the workspace loads the same shard as the Open button

### Requirement: Catalog memory values use one display contract

The catalog memory column SHALL use a single `KB` unit in its header and SHALL
render `—` for absent flash or RAM values. No other catalog column SHALL change.

#### Scenario: Missing flash is explicit

- **WHEN** an index entry has a null flash size
- **THEN** the memory cell shows `— / <ram> KB` and the column header declares the `KB` unit once

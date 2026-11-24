# Spec Delta

## REMOVED Requirements

### Requirement: Lazy hero chip data

Reason: The start screen no longer renders an interactive chip preview or a
landing export preview, so no chip shard is loaded for a hero demo. Runtime
catalog loading for search and statistics is specified below.

## ADDED Requirements

### Requirement: Start screen reads generated catalog data at runtime

The landing start screen SHALL load `meta.json` and `index.json` from the
generated catalog through `import.meta.env.BASE_URL` and SHALL use them for
quick search, catalog statistics, and provenance. It MUST NOT import a committed
chip snapshot from application source, and the generator MUST NOT emit one.

#### Scenario: Generated catalog is available

- **WHEN** the start screen mounts and the generated catalog files are available
- **THEN** quick search returns parts from the index and the start screen shows counts and source revisions from the metadata

#### Scenario: Generated catalog cannot be loaded

- **WHEN** a catalog request fails
- **THEN** the start screen shows the existing retryable search error and a loading or unavailable state in the statistics rail without crashing

#### Scenario: No committed snapshot is recreated

- **WHEN** application source and generator output are inspected
- **THEN** no committed hero chip snapshot is imported by the application and none is emitted by generation

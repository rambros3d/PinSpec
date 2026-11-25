# Spec Delta

## ADDED Requirements

### Requirement: Nordic SVD evidence is fetched as raw files

The Nordic SVD source SHALL declare only the three SVD files consumed by the adapter and fetch them as individual raw files from a pinned upstream ref into the cache. It SHALL record a content SHA for provenance and SHALL NOT shallow-clone the whole `nrf-pacs` repository. The adapter SHALL read the same cached paths during generation and gate evaluation.

#### Scenario: Acquisition fetches exactly three SVDs

- **WHEN** sources are acquired for a clean checkout
- **THEN** the `nrf-pacs` source fetches nrf52840, nrf5340-app, and nrf5340-net SVD files and records a non-empty content SHA

#### Scenario: Generation and gates read the cached SVDs

- **WHEN** the Nordic adapter or its strict gates read an SVD
- **THEN** the file resolves from the declared raw-file cache directory and the reference part still passes its assertions

### Requirement: Zephyr evidence has one source declaration

RP and Nordic Zephyr files SHALL be declared under one source id and one cache directory. The consolidated source SHALL keep every raw file both adapters consume, and the recorded provenance SHALL remain one complete Zephyr record with SHA, URL, and license.

#### Scenario: One Zephyr source is acquired

- **WHEN** source specs are enumerated
- **THEN** exactly one Zephyr declaration exists and its raw files include both RP and Nordic device-tree, binding, and header paths

#### Scenario: Provenance remains complete

- **WHEN** generation builds `meta.json`
- **THEN** the single `zephyr` source record has a SHA, URL, and license and the Nordic vendor summary lists that source

## MODIFIED Requirements

### Requirement: STM32 output byte-stability

The refactored STM32 adapter SHALL produce chip shards byte-for-byte identical to the pre-refactor generator for the same pinned source commits and timestamp-independent content. Index entries MAY change shape to carry generated package geometry and explicit vendor identity, but all other index values SHALL remain identical.

#### Scenario: Golden comparison against baseline output

- **WHEN** the refactored STM32 adapter generates a catalog from two pinned upstream commits
- **THEN** every STM32 chip shard matches the baseline generator output byte for byte, ignoring only the generated timestamp and the documented index-entry shape change

### Requirement: CI source acquisition and scheduled rebuild

The GitHub Actions workflow SHALL cache the gitignored `.cache/` directory keyed on source declarations and the lockfile, fetch every configured reference source before generation, and rebuild on pushes, manual dispatch, and the weekly schedule. Scheduled runs SHALL delete `.cache/` before acquisition; cached SHAs SHALL be saved only for non-scheduled runs.

#### Scenario: Scheduled CI build

- **WHEN** the weekly schedule triggers the deployment workflow
- **THEN** the job deletes any restored cache, checks out all configured sources fresh, runs generation, tests, type checks, and the subpath production build, then deploys the result

#### Scenario: Repeated push reuses the source cache

- **WHEN** a push build runs with an unchanged source declaration and lockfile
- **THEN** the Actions cache restores `.cache/` before acquisition, acquisition only fills missing files, and the build succeeds without committed generated data

#### Scenario: A configured source is absent locally

- **WHEN** generation runs in a clean Actions checkout with no matching source cache
- **THEN** the workflow fetches the sources before generation and the build succeeds without committed generated data

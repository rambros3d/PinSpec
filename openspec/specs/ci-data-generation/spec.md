# ci-data-generation Specification

## Purpose

Defines the build-time catalog pipeline that runs in CI, acquires reference sources, delegates to per-vendor adapters, records provenance and warnings, enforces per-vendor gates, and serves generated data to the static site without committed artifacts.

## Requirements

### Requirement: Vendor-neutral generation pipeline
The catalog build SHALL execute one orchestrator that delegates each configured vendor to an independent adapter writing a shared set of JSON artifacts. A problem confined to one vendor's optional parts MUST NOT prevent other vendors' parts from being emitted.

#### Scenario: Adding a new vendor adapter
- **WHEN** a new vendor adapter is registered with the orchestrator
- **THEN** generation runs that adapter alongside existing ones and writes its chips, index entries, provenance, and warnings into the same output directory

#### Scenario: One vendor has malformed optional parts
- **WHEN** an adapter encounters a malformed part or unmatched reference record
- **THEN** the orchestrator records a warning and continues emitting all other parts from every vendor

### Requirement: STM32 output byte-stability

The refactored STM32 adapter SHALL produce chip shards byte-for-byte identical to the pre-refactor generator for the same pinned source commits and timestamp-independent content. Index entries MAY change shape to carry generated package geometry and explicit vendor identity, but all other index values SHALL remain identical.

#### Scenario: Golden comparison against baseline output

- **WHEN** the refactored STM32 adapter generates a catalog from two pinned upstream commits
- **THEN** every STM32 chip shard matches the baseline generator output byte for byte, ignoring only the generated timestamp and the documented index-entry shape change

### Requirement: Source provenance metadata
The generated `meta.json` SHALL record a `sources` object keyed by vendor, containing each source's resolved commit or content SHA and license, plus its emitted chip count. Existing STM32 top-level metadata fields MUST remain present.

#### Scenario: Inspecting provenance after generation
- **WHEN** a catalog generation completes
- **THEN** `meta.json` contains a source entry for every vendor with a non-empty revision identifier, license, and chip count, and retains the existing STM32 revision fields

#### Scenario: Source revision cannot be resolved
- **WHEN** a source checkout does not expose a revision identifier
- **THEN** generation records the literal value `unknown` for that revision and does not crash

### Requirement: Centralized build warnings
The orchestrator SHALL write `build-warnings.json` containing warnings from all vendors, each with a vendor label, a reference identifier where available, and an explicit reason, together with aggregate counts.

#### Scenario: Unmatched STM32 variant
- **WHEN** an STM32 XML variant cannot be matched to an Embassy chip
- **THEN** a warning with vendor `stm32`, the part reference, and a reason is written to `build-warnings.json` and generation continues

#### Scenario: No warnings produced
- **WHEN** every configured part is emitted successfully
- **THEN** `build-warnings.json` is still written with an empty warning list and a warning count of zero

### Requirement: Per-vendor generation gates
The generator SHALL evaluate build-blocking gates per vendor. The STM32 gates MUST retain the six reference part assertions and the thresholds of at least 1,000 MCUs, at least 95 percent Embassy match rate, and under 150 MB total JSON output.

#### Scenario: STM32 reference assertion fails
- **WHEN** an STM32 reference part has incorrect package, pin count, power pins, or key signal mapping
- **THEN** generation fails with a gate error identifying that part

#### Scenario: STM32 thresholds regressed
- **WHEN** MCU count, match rate, or total output size crosses a configured STM32 threshold
- **THEN** generation fails with a gate error naming the violated threshold

#### Scenario: Non-STM32 vendor fails a subset
- **WHEN** a non-STM32 vendor emits fewer parts than expected but its own required reference parts pass
- **THEN** generation continues with the shortfall recorded in `build-warnings.json` rather than aborting the whole catalog

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

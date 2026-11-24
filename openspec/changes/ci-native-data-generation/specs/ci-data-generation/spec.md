# Spec Delta

## Purpose

Defines the build-time catalog pipeline that runs in CI, acquires reference sources, delegates to per-vendor adapters, records provenance and warnings, enforces per-vendor gates, and serves generated data to the static site without committed artifacts.

## ADDED Requirements

### Requirement: Vendor-neutral generation pipeline
The catalog build SHALL execute one orchestrator that delegates each configured vendor to an independent adapter writing a shared set of JSON artifacts. A problem confined to one vendor's optional parts MUST NOT prevent other vendors' parts from being emitted.

#### Scenario: Adding a new vendor adapter
- **WHEN** a new vendor adapter is registered with the orchestrator
- **THEN** generation runs that adapter alongside existing ones and writes its chips, index entries, provenance, and warnings into the same output directory

#### Scenario: One vendor has malformed optional parts
- **WHEN** an adapter encounters a malformed part or unmatched reference record
- **THEN** the orchestrator records a warning and continues emitting all other parts from every vendor

### Requirement: STM32 output byte-stability
The refactored STM32 adapter SHALL produce chip shards and index entries byte-for-byte identical to the pre-refactor generator for the same pinned source commits and timestamp-independent content.

#### Scenario: Golden comparison against baseline output
- **WHEN** the refactored STM32 adapter generates a catalog from two pinned upstream commits
- **THEN** every STM32 chip shard and each index entry matches the baseline generator output byte for byte, ignoring only the generated timestamp

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

### Requirement: Lazy hero chip data
The landing page SHALL fetch the `STM32G431CBU6` chip JSON from the generated `public/data` catalog at runtime and MUST NOT import a committed hero snapshot from application source.

#### Scenario: Landing page loads with generated data
- **WHEN** the landing page mounts and the generated hero chip JSON is available
- **THEN** the hero preview and export previews render from the fetched `ChipData` and the chip is available to the catalog store

#### Scenario: Hero data fetch fails
- **WHEN** the generated hero chip JSON cannot be fetched
- **THEN** the page shows a non-crashing error or loading state and the rest of the landing page remains usable

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
The GitHub Actions workflow SHALL fetch every configured reference source during the build job before running the generator, and SHALL rebuild on pushes to `main`, manual dispatch, and the weekly schedule.

#### Scenario: Scheduled CI build
- **WHEN** the weekly schedule triggers the deployment workflow
- **THEN** the job checks out all configured sources, runs generation, tests, type checks, and the subpath production build, then deploys the result

#### Scenario: A configured source is absent locally
- **WHEN** generation runs in a clean Actions checkout with no source caches
- **THEN** the workflow fetches the sources before generation and the build succeeds without committed generated data

# p0-cleanup-baseline Specification

## ADDED Requirements

### Requirement: Dependency and tooling surface is minimal

The project SHALL declare only packages and scripts used by the build, runtime,
tests, and data generator. React, React DOM, `lucide-react`, `motion`, the React
Vite plugin, `svelte-check`, `autoprefixer`, a direct `esbuild` dependency, and a
duplicate `lint` script SHALL NOT be declared. Installation SHALL succeed with
the default npm peer-dependency resolution or with a documented override if a
real conflict remains.

#### Scenario: Clean install from the lockfile

- **WHEN** `npm ci` runs from a freshly regenerated `package-lock.json`
- **THEN** installation succeeds and the declared scripts contain one `check` command and no `lint` command

#### Scenario: No unused UI framework is installed

- **WHEN** the dependency manifest is inspected
- **THEN** no React, `lucide-react`, or `motion` entry is present and the Solar Svelte icon package remains

#### Scenario: Peer override is justified

- **WHEN** `.npmrc` still contains `legacy-peer-deps=true`
- **THEN** a documented unresolved peer conflict requires it, otherwise the setting is absent and installation still succeeds

### Requirement: Runtime surface has no dead state or helpers

The application SHALL NOT expose unused view-state fields, unused store mutators,
unused history counters, unused helper functions, or a Vite plugin and path
alias that no source uses. Dialog flags, theme cycling, history navigation,
catalog loading, and About provenance SHALL continue to work through the APIs
that remain.

#### Scenario: Top bar retains only used state

- **WHEN** the transient top-bar store is inspected
- **THEN** it exposes dialog flags and the search-focus callback but no workspace-mode flag

#### Scenario: Theme and history keep their public behavior

- **WHEN** a user cycles the theme or undoes and redoes an assignment
- **THEN** the existing `cycle()` and `undo()`/`redo()` operations apply and no alias method or unused counter is present

#### Scenario: About has one provenance surface

- **WHEN** the About route is opened
- **THEN** it renders the single grouped provenance table with no tab strip, tab preference, or tab prop

#### Scenario: Catalog shards load without a priming helper

- **WHEN** a workspace opens an MCU that is not yet cached
- **THEN** the catalog store fetches and caches the shard through `loadChip()` alone

### Requirement: Persistence accepts only the current version-2 schema

Decoders SHALL accept the current version-2 shape and normalize only untrusted
values within that shape. Legacy spatial ring names, the `-90` rotation value,
and UI keys that were never shareable SHALL NOT be mapped into workspace state.

#### Scenario: Legacy ring names are rejected

- **WHEN** a placement preference or payload uses `inner`, `middle`, or `outer`
- **THEN** ring normalization returns no valid ring and codec output contains no current ring value derived from it

#### Scenario: Counter-clockwise rotation is rejected

- **WHEN** a payload declares a package rotation of `-90`
- **THEN** normalization yields the default zero rotation and no rotated state is stored

#### Scenario: UI keys never enter decoded state

- **WHEN** a share payload or project file contains `w`, `d`, `placementOverlayVisible`, or `dockTab`
- **THEN** decoded workspace state contains no corresponding field

#### Scenario: Unsupported versions remain rejected

- **WHEN** a payload or project file declares a version other than 2
- **THEN** its decoder returns a banner-friendly error and no state

### Requirement: Generated metadata has one documented shape

`meta.json` SHALL carry `generatedAt`, per-vendor summaries, and the thirteen
canonical source records under `sources`. It SHALL NOT carry legacy STM32
top-level fields, and its type SHALL describe vendor and source records without
an ambiguous union lookup. The provenance gate SHALL keep validating source
records, vendor counts, and ratios against this shape.

#### Scenario: Generated metadata omits legacy fields

- **WHEN** `npm run gen-data` completes
- **THEN** `meta.json` has no `openPinDataCommit`, `stm32DataCommit`, top-level `chipCount`, top-level `matchRate`, or `families` field

#### Scenario: Provenance still renders

- **WHEN** About reads the generated metadata
- **THEN** per-vendor counts and all thirteen source revisions and licenses resolve from `sources`

#### Scenario: Gate rejects an incomplete record

- **WHEN** a canonical source record lacks a SHA, URL, or license
- **THEN** the provenance gate fails generation before any artifact is written

### Requirement: Documentation and copy match shipped behavior

Repository documentation, OpenSpec requirements, and user-facing copy SHALL
describe the surfaces that exist. They SHALL name all six vendors, use the
shipped icon library and component counts, describe the generated metadata
shape, and avoid claims about a landing technical footer or offline fonts.

#### Scenario: Documentation matches the runtime

- **WHEN** `AGENTS.md` and `README.md` are inspected
- **THEN** they describe Solar icons, nine runes stores, six data adapters, the About provenance table, the current CSV columns, and no checked-in hero snapshot

#### Scenario: Start-screen copy is accurate

- **WHEN** the start screen is rendered
- **THEN** vendor copy names all six vendors, no offline-ready badge appears, and the catalog action opens the catalog route

#### Scenario: File inputs accept only supported formats

- **WHEN** the compare modal's file inputs are inspected
- **THEN** they accept version-2 JSON project files and not `.ioc` files

#### Scenario: Specs contain no footer requirement

- **WHEN** main OpenSpec requirements are inspected
- **THEN** no requirement mandates a landing technical footer and provenance attribution is owned by About and documentation

# Spec Delta

## ADDED Requirements

### Requirement: PinSpec is the single application identity

The application display name SHALL be `PinSpec`. Every tracked file SHALL use
`pinspec` for lowercase identifiers, package names, URLs, paths, storage keys,
file-format identifiers, generated download stems, temp-directory prefixes, and
filenames, `PINSPEC` for uppercase constants and C include guards, and
`PinSpec` for PascalCase type names and user-visible display strings. No tracked
content SHALL retain any variant of the former application name.

#### Scenario: Tracked content has no former name

- **WHEN** every tracked file is searched case-insensitively for the former name
- **THEN** no match is found and no exception is required

#### Scenario: Naming variants follow the declared form

- **WHEN** source identifiers, type names, constants, and display strings are inspected
- **THEN** lowercase forms use `pinspec`, uppercase forms use `PINSPEC`, and title-case forms use `PinSpec`

### Requirement: Shareable and local identifiers use the new name

The version-2 project-file format identifier SHALL be `pinspec-pinout` and the
state-version constant SHALL be `PINSPEC_STATE_VERSION`. All localStorage keys,
including theme, shell preferences, discovery preferences, workspace view
preferences, and recent sessions, SHALL use the `pinspec:` prefix. The numeric
state version SHALL remain 2, and the split between shareable pin configuration
and local-only UI preferences SHALL be unchanged.

#### Scenario: Project files declare the new format

- **WHEN** a project file is exported and then imported
- **THEN** it declares `format: 'pinspec-pinout'` and version 2 and round-trips the same pin configuration

#### Scenario: Preferences remain local under the new prefix

- **WHEN** a preference or recent-session list is written
- **THEN** it is written under a `pinspec:` localStorage key and is absent from share URLs and project files

### Requirement: External URLs and deployment path use pinspec

The repository URL SHALL be `https://github.com/rambros3d/pinspec` and the
production site URL SHALL be `https://rambros3d.github.io/pinspec/`. The GitHub
Pages base path SHALL be `/pinspec/` in the build check, CI workflow, smoke
checks, documentation, specs, and verification commands. Hash routing SHALL be
unchanged, and runtime fetches SHALL continue to resolve through
`import.meta.env.BASE_URL`.

#### Scenario: Subpath build and smoke checks use the new path

- **WHEN** `BASE_PATH="/pinspec/" npm run build` is followed by the CI subpath smoke checks
- **THEN** `index.html`, `data/index.json`, and a sample chip shard resolve under `/pinspec/` with no root-absolute data or asset request

#### Scenario: Documentation and specs point at the new URLs

- **WHEN** tracked documentation and OpenSpec artifacts are inspected
- **THEN** they reference the `pinspec` repository and site URLs and the `/pinspec/` base path

### Requirement: Documentation, specs, and tests are renamed deliberately

`README.md`, `AGENTS.md`, active and archived OpenSpec artifacts, generated-code
comments, export headers, alt text, toasts, and all test fixtures and assertions
SHALL use the PinSpec identity. Tracked paths containing the former identity
SHALL be renamed. Static tests that assert names, keys, URLs, or base paths
SHALL be updated to assert the new values with the same coverage.

#### Scenario: Spec capability path is renamed

- **WHEN** the OpenSpec spec inventory is inspected
- **THEN** the start-screen capability path is `pinspec-start-screen` and no capability path contains the former identity

#### Scenario: Static assertions keep their coverage

- **WHEN** the test suite is inspected and run
- **THEN** every name, key, URL, and base-path assertion checks the new value and the suite passes

### Requirement: Rename verification is green

A case-insensitive search of tracked content for the former name SHALL return no
matches. `npm test`, `npm run check`, and `BASE_PATH="/pinspec/" npm run build`
SHALL exit zero with no warnings. `openspec validate --all --strict` SHALL pass
after the change is archived. No new dependency, backend, or gitignored data
source SHALL be introduced, and `src/core/` SHALL remain free of Svelte and DOM
imports.

#### Scenario: Full verification passes

- **WHEN** the rename verification sequence is run
- **THEN** each command exits zero and the working tree is clean after the commit is pushed

#### Scenario: Core layer stays pure

- **WHEN** `src/core/` is inspected after the rename
- **THEN** it contains no Svelte or DOM import and no change other than identifier and display-string updates

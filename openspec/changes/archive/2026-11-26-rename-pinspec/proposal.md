# Proposal: Rename the Application to PinSpec

## Why

The application and its repository are being renamed to PinSpec. The former
identity remains in source identifiers, package metadata, storage keys,
project-file identifiers, generated artifacts, URLs, deployment paths,
documentation, specs, and test fixtures, so two identities currently coexist. A
single change is needed to make PinSpec the only identity across tracked content
while preserving application behavior.

## What Changes

- **BREAKING** Change the exported project-file identifier to
  `pinspec-pinout` and the state-version constant to `PINSPEC_STATE_VERSION`.
  The numeric state version stays 2; only the file-format identifier changes.
- Rename all lowercase identifiers, package names, URLs, paths, storage keys,
  temp-file prefixes, download stems, and spec capability paths to the `pinspec`
  form.
- Rename all uppercase constant and include-guard prefixes to `PINSPEC` and all
  PascalCase type names and display strings to `PinSpec`.
- Point repository and site URLs at `https://github.com/rambros3d/pinspec` and
  `https://rambros3d.github.io/pinspec/`, and change the GitHub Pages base path
  from the former subpath to `/pinspec/` in code, configuration, documentation,
  CI, specs, and verification commands.
- Rename tracked paths that contain the former identity, including the
  start-screen spec capability directory and its archived change directory.
- Update static tests and fixtures deliberately so the assertions verify the new
  identifiers rather than dropping coverage.

## Capabilities

### New Capabilities

- `pinspec-identity`: Canonical application name across display strings,
  identifiers, file-format ids, persistence keys, external URLs, deployment
  base path, documentation, specs, and verification contracts.

### Modified Capabilities

None. Existing capability requirements keep their behavior; only their literal
identifier values change, and the canonical naming contract is owned by the new
capability.

## Impact

- `package.json`, `package-lock.json`, `index.html`, `metadata.json`,
  `vite.config.ts`, and `.github/workflows/deploy.yml`.
- `src/core/` pure TypeScript (types, URL state, exporters, importer, data URL
  helper) and `src/state/` localStorage key constants.
- `src/components/` and `src/pages/` display strings and download names.
- All `tests/` fixtures and assertions, `README.md`, `AGENTS.md`, and active
  and archived OpenSpec artifacts.
- GitHub Pages subpath changes to `/pinspec/`; the GitHub repository itself is
  renamed separately by the repository owner.

## Out of scope

No feature work, solver changes, routing changes (hash routing stays), new
npm dependency, backend, or changes to the separate shell/top-bar redesign
discussion. No generated catalog data or gitignored directory is edited.

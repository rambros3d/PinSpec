# Proposal: P0 cleanup

## Why

The repository carries unused React and animation dependencies, a peer-dependency
override that is no longer justified, dead store and helper surface, version-2
compatibility shims for payloads the project no longer supports, and technical
copy that describes surfaces which were removed in earlier phases. These leftovers
make verification noisier and let documentation disagree with shipped behavior.

## What Changes

- Remove unused runtime and dev dependencies, the redundant `lint` script, and
  the `copy-unbundled-src-assets` Vite plugin and unused `@/*` alias. Regenerate
  `package-lock.json` and keep `.npmrc` only if a real peer conflict remains.
- Remove dead view state and helpers: `topBarUI.workspaceMode`,
  `themeStore.toggle()`, `HistoryStack.undoCount`/`redoCount`, the single-value
  About tab machinery, `catalogStore.primeChip()`, `signalCountsOrMap()`, and the
  discarded `validateMatrixPlan()` call in the allocator.
- Remove legacy persisted-shape shims: spatial placement-ring aliases, `-90`
  rotation normalization, ignored UI keys in codecs, and legacy STM32 top-level
  fields and the dual vendor/source union in `meta.json`. Version-2 payloads
  remain strict: unknown or legacy values resolve to documented defaults and
  never enter workspace state.
- Reconcile `AGENTS.md`, `README.md`, and the main OpenSpec requirements with the
  shipped shell, icon library, store/component counts, adapters, CSV columns,
  provenance surface, and generated metadata shape. **BREAKING**: documentation
  and specs no longer promise a landing technical footer; About owns provenance.
- Correct start-screen copy that names three vendors, calls a remote-font build
  offline-ready, offers `.ioc` files to a diff view that rejects them, and labels
  a home-navigation action "Browse Catalog".

## Capabilities

### New Capabilities

- `p0-cleanup-baseline`: The shipped dependency, runtime-state, persistence,
  metadata, and documentation surfaces contain no dead or legacy-only entries,
  and user-facing copy matches actual behavior.

### Modified Capabilities

- `multi-vendor-workspace`: Provenance is presented by the start-screen catalog
  facts and About table, not a landing footer.
- `multi-vendor-ci-gates`: Documentation and provenance requirements describe
  the About table and forbid a landing-footer claim.
- `rp-chip-data`: RP provenance is consumed by the About provenance table.
- `esp32-ui-exporters-and-docs`: Provenance attribution covers thirteen sources
  on About and in documentation, with no start-screen footer.

## Impact

Affected files: `package.json`, `package-lock.json`, `.npmrc`, `vite.config.ts`,
`tsconfig.json`, `README.md`, `AGENTS.md`, `index.html`, core types and codecs,
the history and solver modules, the affected runes stores and components,
`tools/data-gen/{artifacts,gates,index}.ts`, four main spec files, and the static
tests covering those surfaces. No pin-configuration behavior, STM32 shard bytes,
exporter output, routing, or theme behavior changes. Verification is
`npm ci`, `npm test`, `npm run check`, `BASE_PATH="/pinspec/" npm run build`,
`npm run gen-data`, and `openspec validate --all --strict`.

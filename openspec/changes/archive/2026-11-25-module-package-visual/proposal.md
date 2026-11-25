# Proposal

## Why

ESP32 module shards such as `ESP32-WROOM-E` are generated from first-party KiCad module symbols, but the workspace draws them as bare ICs and discovery lists them without any module indication. The upstream symbol already distinguishes modules from dies; the catalog and UI currently discard that distinction.

## What Changes

- Add an optional generated `ChipData.module` metadata field for parts whose KiCad symbol name matches the module pattern already used by `tools/data-gen/adapters/esp32/modules.ts`. Bare dies and MPN-only ICs carry no module field. No chip fact is transcribed by hand and no static module overlay is added to the repository.
- Carry a compact module marker on `index.json` entries so discovery surfaces can identify modules without fetching a shard.
- Draw module parts with a module-style PCB body outline, a dashed inner die outline, castellated half-hole edge marks, and the module name. The marks are decorative and non-interactive; pad geometry, hit areas, labels, and all pin interactions remain the same as for bare ICs. The treatment lives inside the existing rotated geometry group and keeps text upright at every orientation.
- Show a compact `MODULE` tag in quick search results, MCU switcher results, and starter chips. Starter-chip tags are derived from the generated catalog marker instead of new hardcoded chip facts.
- Add a generation gate that requires module metadata on module shards and its absence on bare dies, and that checks the index marker agrees with the shard. STM32 shards, index entries, and golden hashes stay byte-identical.
- Keep the version-2 share-link and project-file schema, workspace state, undo/redo, and all pin-configuration persistence unchanged. Module metadata is generated catalog data: it is not a UI preference and is not shareable pin configuration.
- Update the affected data-generation, core I/O, exporter, renderer, discovery, rotation, and theme-token tests.

## Capabilities

### New Capabilities

- `module-package-visual`: Generated module identity metadata, its canvas rendering as a module package, module tags in discovery surfaces, and the generation gates and non-regression rules that keep this treatment consistent for modules and absent for bare dies and other vendors.

### Modified Capabilities

- None. The ESP32 chip-data requirements for first-party joins, pad mapping, flash evidence, and gates remain true without replacement; module metadata is additive. The multi-vendor workspace requirements for vendor tabs, two-sided/grid layouts, presets, and export previews also remain true: only the perimeter body decoration and a compact discovery tag are added.

## Impact

- Schema and generator: `src/core/types.ts`, `tools/data-gen/adapters/esp32/join.ts`, `tools/data-gen/adapters/esp32/index.ts`, `tools/data-gen/adapters/esp32/gates.ts`; `tools/data-gen/adapters/esp32/modules.ts` is reused as the module-evidence source.
- Canvas: `src/components/workspace/PerimeterPackage.svelte`; the grid renderer is unchanged because module shards are perimeter packages.
- Discovery: `src/components/landing/QuickSearchBar.svelte`, `src/components/workspace/McuSwitcherModal.svelte`, `src/components/landing/PresetGrid.svelte`, and the preset handoff in `src/pages/LandingPage.svelte`.
- Tests: `tests/data-gen-esp32.test.ts`, `tests/core-io.test.ts`, `tests/exporters-vendor.test.ts`, `tests/ui-multi-vendor.test.ts`, `tests/theme-tokens.test.ts`, and `tests/package-rotation.test.ts`.
- Generated output: module shards and index entries gain the new fields; other vendor output is unchanged. No new dependency, no backend, no new workspace state field, and no change to `import.meta.env.BASE_URL` data fetching.

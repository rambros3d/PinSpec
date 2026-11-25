# Tasks

## 1. Schema and generated module identity

- [ ] 1.1 Add `ChipModuleMetadata` with `kind: 'module'`, `name`, `baseFamily`, and `symbol` to `src/core/types.ts`, plus optional `ChipData.module` and optional `CatalogIndexEntry.module` marker; document both as generated catalog data with no workspace-state meaning. Verify with `npm run check` that strict TypeScript passes and with a repository search that no new module field appears in `WorkspaceState`.
- [ ] 1.2 Emit the module record in `tools/data-gen/adapters/esp32/join.ts` only when `buildEspModules()` supplies a module input, taking name, base family, and symbol from that acquired evidence; emit no record for bare dies or MPN-only ICs. Verify in `tests/data-gen-esp32.test.ts` that an ESP32-WROOM-E shard carries the record with kind `module` and that ESP32-C3 and ESP32-C3FH4 carry no `module` key.
- [ ] 1.3 Add the compact marker to `tools/data-gen/adapters/esp32/index.ts` using a conditional spread so absent markers are omitted from JSON. Verify in `tests/data-gen-esp32.test.ts` that the WROOM index entry is marked, die and MPN entries are not, and all ESP32 index fields remain finite and defined.

## 2. Generation gates and catalog integrity

- [ ] 2.1 Add one strict ESP32 module gate in `tools/data-gen/adapters/esp32/gates.ts` and register it with `createEsp32Gates()`, checking module metadata on the WROOM reference part, absence on die and MPN reference parts, and agreement between every ESP32 index marker and its shard. Verify in `tests/data-gen-esp32.test.ts` that a valid catalog passes all gates and that a missing module record, an invented die module record, and a shard/index mismatch each produce a named error.
- [ ] 2.2 Confirm the new gate blocks artifact writes through the existing orchestrator path. Verify by running `npm run gen-data` with acquired sources and checking that `public/data/index.json`, the module shard, `meta.json`, and `build-warnings.json` are emitted with no partial catalog or new unattributed warning.

## 3. Module visual on the perimeter canvas

- [ ] 3.1 Add an `isModule` derivation in `src/components/workspace/PerimeterPackage.svelte` and a module-only branch inside the existing body group: PCB-style outline, dashed inner die outline, castellated half-hole edge marks aligned with placed pads, and the module name from `chip.module.name`. Keep all new marks `pointer-events="none"` and styled only with existing theme utilities. Verify in `tests/ui-multi-vendor.test.ts` that the module branch and its marks exist, that `data-pin-pos`, pad rectangles, and pin handlers are unchanged, and that non-module chips have no module branch.
- [ ] 3.2 Ensure the module marks live inside `geometryTransform` and the module name uses the same `centreLabelAngle` transform as the existing centre markings. Verify in `tests/package-rotation.test.ts` that module marks rotate at all four orientations, the name stays upright, and pin click, hover, and context-menu targets remain the same physical pin.
- [ ] 3.3 Keep the renderer free of raw color literals and emojis. Verify with `tests/theme-tokens.test.ts` that both renderers still use theme utilities, no hex or `rgb()` literal appears outside the vendored theme file, and the texture-effect scope remains limited to the two package renderers.

## 4. Module tags in discovery surfaces

- [ ] 4.1 Render a compact `MODULE` badge in `src/components/landing/QuickSearchBar.svelte`, `src/components/workspace/McuSwitcherModal.svelte`, and `src/components/workspace/CompatibleMcuFinder.svelte` when the catalog entry marker is set. Verify in `tests/ui-multi-vendor.test.ts` that each surface contains the tag string guarded by the marker and that vendor tabs, family/package filters, and search result navigation are unchanged.
- [ ] 4.2 Derive starter-chip tags from the generated index: pass a set of module part ids from `src/pages/LandingPage.svelte` to `src/components/landing/PresetGrid.svelte` and render the same compact badge for matching ids. Add no module literal to the curated starter-chip array. Verify in `tests/ui-multi-vendor.test.ts` and `tests/start-screen.test.ts` that the tag comes from catalog data, appears only for marked ids, and leaves starter-chip part identifiers and open-workspace handoff unchanged.

## 5. Persistence and non-regression contracts

- [ ] 5.1 Keep the version-2 share-link and project-file schema unchanged. Verify in `tests/core-io.test.ts` and `tests/exporters-vendor.test.ts` that a chip fixture with module metadata still encodes and decodes the same version-2 payloads, that no `module` key appears in a share or project file, and that the CSV, Rust, C, and JSON exporters keep their existing output.
- [ ] 5.2 Confirm STM32 and other-vendor stability. Verify in `tests/data-gen-pipeline.test.ts` that STM32 golden shard hashes, index hash, and reference-part assertions are unchanged, and in `tests/ui-multi-vendor.test.ts` that SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 two-sided, exposed-pad, bonded-pin, and mux-label contracts still pass.

## 6. Full verification

- [ ] 6.1 Run `npm test` and confirm the full Vitest suite passes with zero failures, including the new module data, gate, tag, rotation, and rendering assertions.
- [ ] 6.2 Run `npm run check` and confirm strict TypeScript and Svelte checks pass with zero errors or warnings.
- [ ] 6.3 Run `BASE_PATH="/pincraft/" npm run build` and confirm the production subpath build succeeds with no root-absolute data or asset path and no build warning.
- [ ] 6.4 Run `npm run gen-data` after all code changes and confirm the catalog is generated once, all release gates pass, the STM32 golden output is unchanged, and total JSON remains under the 150 MB budget.
- [ ] 6.5 Review the final diff: no emoji, no marketing wording, no raw color literal outside `src/themes/daisyui.css`, no Svelte or DOM import in `src/core/`, no handwritten chip fact, no `.cache/`, `public/data/`, `dist/`, or `node_modules/` file changed, and no new dependency.

## Workflow follow-up

- After every task passes and all verification is green, the implementation agent runs `openspec archive module-package-visual -y` and includes the synced `openspec/specs/module-package-visual/spec.md` plus the archived change files in the implementation commit.
- Commit and push only after archive, using the commit format in `AGENTS.md` and reporting validation, test, check, generation, build, and archive output as evidence.

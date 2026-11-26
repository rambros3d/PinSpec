# Tasks

## 1. Schema prerequisites and source declarations

- [x] 1.1 Confirm the `esp32-schema-and-core-mux` change has landed `vendor: 'esp32'`, nullable `flashKb`, the ESP32 mux model, and the required pin tags in `src/core/types.ts`, and verify `npm run check` passes.
- [x] 1.2 Add the four license constants and `esp32SourceSpecs()` to `tools/data-gen/sources.ts`, including a pinned ESP-IDF release tag and raw-file paths for `soc_caps.h`, `gpio_sig_map.h`, and `io_mux_reg.h`, and verify `npm run acquire-sources` fetches all four sources into gitignored `.cache/` locations.
- [x] 1.3 Extend `CatalogSourceId` and `CATALOG_SOURCE_IDS` in `src/core/types.ts` from seven to eleven identifiers and add explicit `canonicalSourceId` mappings in `tools/data-gen/artifacts.ts` so `espressif-kicad` does not collapse into `kicad`, and verify the new source-id cases in `tests/data-gen-esp32.test.ts` pass.
- [x] 1.4 Add the initial `tests/data-gen-esp32.test.ts` cases for source declarations, pinning, and canonical ids, and verify `npx vitest run tests/data-gen-esp32.test.ts` passes.

## 2. First-party parsers and electrical join

- [x] 2.1 Implement the narrow `esp-gpio-tool` YAML reader for target GPIO records, power domain, strapping text, at-reset pull, output flag, functions, SoC reserved and not-connected pins, SRAM, and peripheral counts, and verify parser cases in `tests/data-gen-esp32.test.ts` pass.
- [x] 2.2 Implement the `esp-hal` `esp-metadata` TOML reader for GPIO functions, analog and low-power flags, limitations, and numeric matrix signal IDs, plus `soc.toml` DMA and memory facts, and verify a P4 input-select offset case in `tests/data-gen-esp32.test.ts` passes.
- [x] 2.3 Implement the `espressif/kicad-libraries` symbol and footprint pad reader that resolves pad numbers and multi-function labels such as `GPIO0/BOOT` and emits power, reset, boot, and exposed-pad pins, and verify pad-number cases in `tests/data-gen-esp32.test.ts` pass.
- [x] 2.4 Implement the pinned ESP-IDF header reader for matrix signal count evidence and verify a count case against a checked-in header fixture in `tests/data-gen-esp32.test.ts` passes.
- [x] 2.5 Implement the GPIO-number join with one-sided-record and unmatched-pad deferral, preserving strapping, pull, input-only, flash and PSRAM reserved, JTAG and USB-JTAG, ADC2 Wi-Fi conflict, and `wifi_conflict` facts, and verify join and electrical cases in `tests/data-gen-esp32.test.ts` pass.

## 3. Adapter emission, shards, and warnings

- [x] 3.1 Implement `tools/data-gen/adapters/esp32/` modules and the `VendorAdapter` object with `vendor: 'esp32'`, `sourceSpecs`, the four declared sources, and `strict: true`, and verify an adapter-list test confirms it is present in `DEFAULT_ADAPTERS`.
- [x] 3.2 Emit all twelve available families in `index.json` and `public/data/chips/`, with one shard per named module or MPN and numeric flash size, bare dies with `flashKb: null`, and no `NaN` or `undefined`, and verify emission cases in `tests/data-gen-esp32.test.ts` pass.
- [x] 3.3 Add a module manifest derived from first-party module names and flash data so `ESP32-WROOM-E` is emitted with a numeric flash size and a module without flash evidence is deferred, and verify the module cases in `tests/data-gen-esp32.test.ts` pass.
- [x] 3.4 Route every unavailable or ambiguous ESP32 record to `ctx.warnings` with id, vendor, source, and reason, and verify `tests/gates-contracts.test.ts` accepts a warnings document containing those ESP32 records.
- [x] 3.5 Run `npm run gen-data` and verify ESP32 shards, index entries, `meta.json` vendor summary, and `build-warnings.json` are emitted consistently with no partial catalog on a forced gate error.

## 4. Strict gates and provenance

- [x] 4.1 Implement strict ESP32 gates asserting ESP32-C3 QFN32 with 32 pads, exposed pad, GPIO2 at pad 6 with strapping and flash-reserved pins, ESP32-WROOM-E pad 25 GPIO0/BOOT and pad 3 EN, ESP32 GPIO34-39 input-only, and matrix signal counts against the pinned `gpio_sig_map.h`, and verify passing and failing cases in `tests/gates-contracts.test.ts` pass.
- [x] 4.2 Add the no-`NaN` and no-`undefined` shard check to the ESP32 gate list using the existing invalid-value helper, and verify a deliberately invalid shard fails generation in `tests/gates-contracts.test.ts`.
- [x] 4.3 Extend the provenance gate vendor list with `esp32` and require all four ESP32 source SHAs plus the `esp32` chip count and ratios, and verify the provenance cases in `tests/gates-contracts.test.ts` pass.
- [x] 4.4 Update the shard-integrity gate so matching `flashKb: null` in a bare-die shard and index entry is valid while a numeric flash mismatch fails, and verify both cases in `tests/gates-contracts.test.ts` pass.
- [x] 4.5 Add adapter-list and source-registry tests covering the eleven canonical ids and the distinct `espressif-kicad` mapping, and verify `tests/data-gen-esp32.test.ts` passes.

## 5. Documentation and attribution

- [x] 5.1 Update `README.md` and `AGENTS.md` from seven to eleven upstream sources, add the four ESP32 sources with their licenses and the ESP32 generation and gate description, and verify `tests/docs-attribution.test.ts` passes.
- [x] 5.2 Confirm generated `meta.json` carries the four ESP32 source records with non-empty SHA, URL, and license for footer rendering, and verify the attribution data case in `tests/docs-attribution.test.ts` passes.
- [x] 5.3 Scan all files touched by this change for emoji characters and raw color literals outside `src/themes/daisyui.css`, and verify no matches are found.

## 6. Full verification

- [x] 6.1 Run `npm test` and `npm run check` and verify zero failures and zero warnings.
- [x] 6.2 Run `BASE_PATH="/pinspec/" npm run build` and verify the subpath checks in `tests/subpath-contracts.test.ts` pass with no broken asset or data request.
- [x] 6.3 Run `npm run gen-data` end to end and verify all per-vendor and global gates pass with consistent `index.json`, `meta.json`, and `build-warnings.json`.
- [x] 6.4 Run `openspec validate esp32-data-adapter-and-gates --strict` and verify no validation errors.

## Workflow follow-up

- Archive the change after all tracked tasks and verification pass: `openspec archive esp32-data-adapter-and-gates -y`. The implementation agent performs this step and includes the synced specs and archived change files in the implementation commit.
- Verify the archived specs under `openspec/specs/esp32-chip-data/` and `openspec/specs/multi-vendor-ci-gates/` contain the eleven-source wording and ESP32 gate contract, then commit and push.

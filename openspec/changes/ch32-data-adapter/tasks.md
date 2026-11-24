# Tasks: CH32 Data Adapter

Depends on `ci-native-data-generation` (orchestrator, `sources.ts`, warnings, and per-vendor gates) being applied first.

## 1. Source acquisition and integrity

- [x] 1.1 Register `ch32-riscv-ug/ch32-device-data` in `tools/data-gen/sources.ts` with a `.cache/ch32-device-data` clone path, resolved commit, MIT license, and required-column checks for all consumed CSVs; verify `meta.json.sources.ch32` contains a non-empty revision after `npm run gen-data`.
- [x] 1.2 Implement SHA-256 verification of every consumed CSV against `index/manifest.csv`; verify a unit test corrupts a temporary fixture digest and observes a named abort with no CH32 shards written.

## 2. Parts, packages, and physical pins

- [x] 2.1 Parse `index/parts.csv` and `index/packages.csv` into `ChipData` skeletons with `vendor: 'ch32'`, `muxModel: 'remap-group'`, flash/RAM from the part record, and perimeter package sides; verify a unit test counts exactly 105 covered parts with non-zero memory.
- [x] 2.2 Convert `index/pinout.csv` rows into one `PinInfo` per physical `pin` position, including `EP` as `hasExposedPad`, mapping `kind` values to catalog pin types; verify tests assert pin counts, exposed-pad handling, and no duplicate positions for CH32V003F4P6 and CH32X035G8U6.

## 3. Bonded pads, signals, remaps, and tags

- [x] 3.1 Merge multiple pads sharing a physical lead into one pin, deduplicate signals by `(peripheral, signal, remapId)`, populate `bondedNames`, and add the `bonded` tag; verify a unit test on CH32V003J4M6 yields 8 pins with at least one bonded lead and no duplicate signals.
- [x] 3.2 Group `pinout.csv` signals by peripheral and `route` into `PeripheralInfo.remaps`, using `selector`/`value` and `evidence/remap_fields.csv` for `registerNote`, `funcLabel` for display, and `af: null` for all CH32 signals; verify tests cover default plus `remap-N` routes and absence of fabricated notes.
- [x] 3.3 Apply `debug-sdi`, `debug-swd`, `usb`, `adc`, `boot`, and `5v-tolerant` tags only when `condition`, `basis`, or `evidence/pins.csv` supports them; verify unit tests assert tag presence on documented pins and absence elsewhere.

## 4. Warnings and reference gates

- [x] 4.1 Defer uncovered stems, low-confidence rows, and unparsable records to `build-warnings.json` with vendor `ch32`, part reference, and explicit reason; verify a unit test shows generation succeeds with warnings and all other parts still emitted.
- [x] 4.2 Add CH32 gate assertions for CH32V003F4P6 (20), CH32V003J4M6 (8 bonded), CH32V203C8T6 (48), and CH32X035G8U6 (28); verify `npm run gen-data` passes the gate and logs per-part results and the total of 105 parts.

## 5. Provenance, documentation, and regression coverage

- [x] 5.1 Emit CH32 chip count and source revision into `meta.json.sources.ch32`; verify a generated `meta.json` shows a count matching the emitted shards and the same revision used during acquisition.
- [x] 5.2 Update `README.md` upstream credits and the landing footer provenance display for the CH32 MIT source; verify the documented fields match a generated `meta.json` and contain no emojis.
- [x] 5.3 Add a regression check confirming STM32 golden hashes from `ci-native-data-generation` are unchanged after the CH32 adapter is registered; verify `npm test` passes with both adapters present.

## 6. Integration verification

- [x] 6.1 Run `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` with all three catalogs generated; verify all succeed with zero warnings and no broken subpath data requests.
- [x] 6.2 Inspect emitted `index.json` and a sample CH32 shard to confirm `vendor`, `muxModel`, `remaps`, `tags`, and `bondedNames` fields are present and `af` is `null`; verify by reading generated JSON after `npm run gen-data`.

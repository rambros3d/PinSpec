# Tasks

## 1. CH32 evidence-backed tolerance tags

- [x] 1.1 Declare `evidence/pins.csv` as an additional CH32 source with required `part_number`, `pin`, `pad`, and `type` columns, and record its SHA-256 in `meta.json` provenance; verify a data-gen test fails on a missing or malformed file and passes with a valid fixture containing the digest
- [x] 1.2 Map upstream `type: I/O/FT` rows to the existing `5v-tolerant` tag by normalized part number, pin position, and pad name, leaving plain `I/O` untagged and deduplicating against condition-based tags; verify unit tests cover an FT pin, a plain I/O pin, and a bonded FT pin on CH32V003F4P6
- [x] 1.3 Add a CH32 gate assertion that a priority part carries at least one `5v-tolerant` pin, regenerate shards, and verify `npm run gen-data` passes the gate with no partial catalog and `meta.json` records the evidence digest
- [x] 1.4 Update `README.md` CH32 attribution to name the consumed evidence file and the absence of a compatibility shim; verify the attribution documentation test passes

## 2. Pure hardware audit core

- [x] 2.1 Define the audit report types and `buildHardwareAudit(chip, state)` in a new pure `src/core/hardware-audit.ts` with strapping, interface, unused-pin, and voltage-tolerance sections, an evidence source per fact, and deterministic pin-position ordering; verify unit tests build reports from STM32, CH32, and RP fixtures with no Svelte or DOM import
- [x] 2.2 Classify strapping roles from pin type, composite `-BOOT0` and `-NRST` names, `SYS.SWDIO`/`SYS.SWCLK` signals, CH32 `debug-sdi`/`debug-swd` tags, RP `RUN` and `~{QSPI_SS}` names with the `qspi` tag, and never synthesize BOOTSEL; verify tests assert each vendor case and that pull and label come only from `gpioConfig` and state labels, with unknown when absent
- [x] 2.3 Derive I2C and USB presence from declared peripherals and active modes, oscillator presence from emitted `OSC*` signal names, and power domains from `type: power` pin names, marking unsupported passive fields data-unavailable without numeric values; verify tests cover present, absent, and data-unavailable cases and assert no resistor, capacitor, or VCAP number appears
- [x] 2.4 List unassigned `io` pins as implicitly unused and pins with multiple `bondedNames` plus the `bonded` tag as bonded, excluding slash-named STM32 pins without those fields and emitting no analog-mode recommendation; verify tests cover an unused pin, a CH32 PD1/PD6 bonded pin, and an STM32 slash-named pin
- [x] 2.5 Report `5v-tolerant` from the tag, `user-labeled-5v` from labels matching `5V_*` or `UART_5V` when no tag exists, and `unknown` otherwise, with no device claim from a label and no voltage claim for unknown pins; verify tests cover tag-backed, label-only, and unknown STM32 and RP pins
- [x] 2.6 Add a pure `formatHardwareAuditText(report)` helper that renders the same facts in stable order; verify a snapshot test confirms identical output for identical inputs and identical facts across repeated calls
- [x] 2.7 Add a regression check that solver diagnostic ids, codes, severities, and counts for fixed STM32, CH32, and RP fixtures are unchanged, and confirm existing exact-count solver tests still pass; verify with `npm test` and confirm `src/core/solver.ts` has no diff

## 3. Workspace UI and export

- [x] 3.1 Add a read-only `HardwareAuditPanel.svelte` under `src/components/workspace/` that renders the four report sections with existing semantic tokens and no commit callback; verify a component check shows all sections and no workspace mutation method is referenced
- [x] 3.2 Add an Audit tab to `SummaryDrawer.svelte` that mounts the panel from the chip prop and `workspaceStore.state`; verify the tab renders the report, shows no diagnostic badge, and leaves assignments, labels, locks, modes, and history unchanged, with `npm run check` passing
- [x] 3.3 Add an `audit` format tab to `ExportModal.svelte` using the pure text formatter and existing copy and download controls; verify the preview matches the formatter output and the downloaded filename uses the chip id, with `npm run check` passing
- [x] 3.4 After `viewport-locked-workspace` is applied, mount the same panel as a portrait dock body and add the `audit` value to that change's existing persisted dock-tab union and normalizer without a second unpersisted tab state; verify the dock selection survives reload and sharing and the panel is visible in portrait, with `npm test` and `npm run check` passing. Do not edit that change's artifacts; if it is not applied, confirm the right-pane tab remains reachable and leave this task pending

## 4. Integration verification

- [x] 4.1 Run `npm test` and confirm the full Vitest suite passes, including CH32 tag tests, per-vendor audit tests, solver diagnostic counts, and provenance contracts
- [x] 4.2 Run `npm run check` and confirm strict type checking passes with zero warnings
- [x] 4.3 Run `BASE_PATH="/pinspec/" npm run build` and confirm a clean production subpath build with no broken `/data/` or `/assets/` requests
- [x] 4.4 Verify touched files add no workspace state field, schema version, share-link field, project-file field, or `localStorage` setting, contain no emoji or raw color literal, and introduce no new npm dependency; verify with a repository scan and a review of `package.json`

## Workflow follow-up

- Archive the change with `openspec archive hardware-erc-data-derived -y` after all tracked tasks and verification are green
- Verify the archived spec and include it with the implementation commit
- Do not commit `.cache/`, `public/data/`, `dist/`, or `node_modules/`

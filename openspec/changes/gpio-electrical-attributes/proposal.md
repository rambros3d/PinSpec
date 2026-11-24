# Proposal

## Why

A completed pinout must also specify how each configured GPIO is driven: output level, output drive, pull resistor, and speed. These settings are currently neither recorded in workspace state nor carried into generated code, so users must add them by hand after export.

## What Changes

- Add a `GpioConfig` type with `outputLevel` (`High`/`Low`), `drive` (`PushPull`/`OpenDrain`), `pull` (`None`/`Up`/`Down`), and `speed` (`Low`/`Medium`/`High`/`VeryHigh`), stored as an optional `WorkspaceState.gpioConfig?: Record<string, GpioConfig>` keyed by physical position.
- Extend history cloning and equality, the URL codec (a compact key in `CompactUrlPayload`), the version-2 JSON codec, and recent-session persistence to carry the new field. The schema version stays at 2; the field is additive and optional, so existing v2 payloads remain valid.
- Add a GPIO electrical inspector tab in `SummaryDrawer.svelte`, bound to the selected pin, that edits these four settings through workspace history.
- Add conditional export support: Rust output includes embedded-HAL-style configuration comments/struct fields, the C header emits `_LEVEL`/`_DRIVE`/`_PULL`/`_SPEED` macros, and CSV gains the corresponding columns. When no config is set, STM32 export output is byte-for-byte unchanged.
- Add tests for state round-trip (history, URL, JSON) and for each exporter. CSV header/schema tests are updated together with the exporter.
- No new dependency is introduced.

5V-tolerance badges are explicitly out of scope because that attribute is not available in the ST XML source.

## Capabilities

### New Capabilities
- `gpio-electrical-config`: Recording per-pin GPIO electrical settings (output level, drive, pull, speed) in workspace state and share/project files, editing them in the workspace inspector, and emitting them conditionally in Rust, C, CSV, and JSON exports.

### Modified Capabilities
None. The new field is additive and optional; when unset, existing workspace and export behavior and output are unchanged.

## Impact

- `src/core/types.ts` (`GpioConfig`, `WorkspaceState.gpioConfig`), `src/core/history.ts`, `src/core/url-state.ts`, `src/core/exporters/json.ts`, and the workspace state store.
- Inspector UI in `src/components/workspace/SummaryDrawer.svelte`.
- Exporters: `embassy-rust.ts`, `c-header.ts`, `csv.ts` (CSV header/ext schema and its tests change together); `json.ts` inherits the field from state.
- Tests across core I/O, exporters, and workspace state; version stays at 2 with v1/v3 rejection preserved.

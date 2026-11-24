# Design

## Context

See proposal.md for motivation. State is strictly version 2 (`PINCRAFT_STATE_VERSION = 2`) with no v1 path; tests assert v2 and reject v1/v3. Every new workspace field must be threaded through `WorkspaceState`, `cloneWorkspaceState()`, `statesEqual()`, the URL codec (`CompactUrlPayload`), and the JSON codec together. Exporters dispatch by vendor and existing STM32 output is asserted by tests. `SummaryDrawer.svelte` is the right-pane summary surface. No new dependency is allowed. 5V-tolerance badges are out of scope because the ST XML source has no such attribute.

## Goals / Non-Goals

**Goals:**
- Add an optional per-pin electrical settings field to workspace state and carry it through all state operations and persistence paths.
- Edit the settings in the right pane through the existing history mechanism.
- Emit the settings in Rust, C, CSV, and JSON exports only when configured.

**Non-Goals:**
- Changing the schema version or adding a legacy import path.
- 5V-tolerance indicators or any electrical attribute not present in workspace input.
- Changing exporter output for workspaces that have no settings configured (except the CSV header, see Decisions).

## Decisions

- **Additive optional field at version 2.** Add `gpioConfig?: Record<string, GpioConfig>` keyed by physical position. Threading it through clone/equality/URL/JSON is required; bumping the version is rejected because it would break existing v2 payloads and tests. Alternative: a new top-level version-3 schema, rejected for unnecessary breakage.
- **Fixed value sets.** Use four explicit unions for level, drive, pull, and speed matching embedded-HAL naming. This keeps exports deterministic and avoids free-form strings.
- **History-backed inspector.** Add a tab in `SummaryDrawer.svelte` bound to the selected pin; each control commits through the existing workspace history action so undo/redo works without new machinery.
- **Conditional exporter output.** Rust and C add settings content only when the field is present; when absent, output is byte-for-byte unchanged. JSON inherits the field through state serialization automatically.
- **CSV header extends unconditionally.** Because CSV is a flat table, the four new columns are always present in the header; cells are empty when no setting is configured, so all pre-existing cell values and their order are unchanged. CSV header/schema tests are updated in the same task as the exporter. This is the one format whose default header changes; it is called out explicitly rather than hidden.
- **Compact URL key.** Encode the new field under a short key in `CompactUrlPayload` and omit it when empty, matching the existing rule for omitted empty fields.

## Risks / Trade-offs

- [Version-2 compatibility] -> Keep the field optional and verify a v2 payload without it loads; keep v1/v3 rejection intact with tests.
- [Exporter regressions] -> Guard every new emission on the field's presence and assert unchanged default output in tests.
- [CSV schema change] -> Update header and parsing tests together with the exporter so downstream consumers see one consistent schema.
- [History/equality drift] -> Add round-trip tests covering clone, equality, undo/redo, URL, and JSON in one group so a missed path fails immediately.

## Migration Plan

Additive only: no schema version bump, no generated-data change, and no route change. Existing v2 share links and project files remain valid; rollback is removal of the field and related UI/exporter additions paired with reverting the CSV header tests.

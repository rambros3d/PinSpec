# Spec Delta

## MODIFIED Requirements

### Requirement: About presents provenance and shortcuts

The `#/about` destination SHALL present catalog statistics, upstream source
revisions, licenses, and the indexed total in one grouped Catalog sources
table. It SHALL read live values from `meta.json`, SHALL keep loading and retry
states on that merged surface, SHALL NOT contain a separate summary card or any
keyboard shortcut reference, and SHALL NOT contain pin configuration or
shareable fields.

#### Scenario: About reports provenance

- **WHEN** generated metadata is available and the user opens About
- **THEN** the merged table shows per-vendor counts, match and coverage ratios, sync time, nested source ids, revisions, licenses, links, and the indexed total in its header

#### Scenario: About lists shortcuts

- **WHEN** the About panel is rendered in any tab or metadata state
- **THEN** it lists no shortcut key, shortcut action, inline shortcut summary, or Shortcuts tab

#### Scenario: About tolerates missing metadata

- **WHEN** `meta.json` has not loaded or cannot be loaded
- **THEN** About shows a loading or unavailable state with a retry control on the merged table and no shortcut reference as a fallback

#### Scenario: About carries no pin configuration

- **WHEN** About is rendered or left
- **THEN** no assignment, label, lock, mode, remap, or PIO field is written to a share URL or project file

#### Scenario: About keeps non-shortcut tabs

- **WHEN** the About tab strip is rendered
- **THEN** only non-shortcut tabs are offered and the Sources tab remains available

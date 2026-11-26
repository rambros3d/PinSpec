# Spec Delta

## REMOVED Requirements

### Requirement: A collapsible sidebar is present on every route

**Reason**: The sidebar rail is replaced by a thin global navigation bar that keeps every section reachable without an expandable overlay.

**Migration**: Use the thin bar defined in `thin-top-bar-navigation` for all section navigation.

### Requirement: The sidebar provides four section entries

**Reason**: Section navigation now lives in the thin bar's left and right groups, with About and Hotkeys represented by icons.

**Migration**: Use the navigation labels and icon controls defined in `thin-top-bar-navigation`.

### Requirement: Recent projects are listed in the sidebar

**Reason**: The Projects route already lists, searches, renames, exports, and deletes recent sessions.

**Migration**: Open the Projects route to manage sessions; the shell no longer renders a session list.

## MODIFIED Requirements

### Requirement: Shell preferences stay in localStorage

Catalog discovery filters and equivalent quick-search filters SHALL be UI
preferences persisted only in localStorage, with default empty query, family,
and package values and an `all` vendor value. Retired sidebar expansion and
About tab preferences SHALL NOT be read or written. Discovery values SHALL NOT
appear in share URLs, project JSON, recent session state, or undo history.

#### Scenario: Shell preferences survive reload

- **WHEN** discovery filters are changed and the page reloads
- **THEN** the same query, family, package, and vendor values are restored from localStorage

#### Scenario: Absent or unknown preference values use defaults

- **WHEN** no stored filter record exists or the record is malformed
- **THEN** discovery surfaces use their defaults without failing and in-memory filter changes still apply

#### Scenario: Shell preferences are never shared

- **WHEN** a workspace is shared or exported as project JSON
- **THEN** neither payload contains a navigation, sidebar, or About-tab field and all pin configuration is preserved

#### Scenario: Discovery filters are local only

- **WHEN** discovery filters are changed and the workspace is shared or exported
- **THEN** the filters persist across reload in localStorage and no filter field appears in a share URL or project file

#### Scenario: Discovery filters use defaults when storage is unavailable

- **WHEN** localStorage is unavailable or the stored filter record is malformed
- **THEN** discovery surfaces use their defaults without failing and in-memory filter changes still apply

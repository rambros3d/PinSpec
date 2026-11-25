# Spec Delta

## MODIFIED Requirements

### Requirement: Workspace search shortcut selects existing text

The workspace pin and signal search shortcut SHALL focus the package canvas HUD
search input and select its current text, matching the landing quick-search
shortcut. Repeated activation SHALL keep the whole query selected. The shortcut
SHALL reach the moved input without changing its focus guard while the user is
typing or a dialog is open.

#### Scenario: Repeated shortcut keeps the query selected

- **WHEN** the user presses the workspace search shortcut while the search input already contains a query
- **THEN** the package canvas HUD input is focused and the full query is selected so typing replaces it

#### Scenario: Find input is reachable in the canvas HUD

- **WHEN** the user presses Ctrl+F while no dialog is open and focus is outside a text field
- **THEN** the canvas HUD find input receives focus and no bar input is activated

#### Scenario: Shortcut does not interrupt typing

- **WHEN** the user presses the search shortcut while a text field has focus
- **THEN** the shortcut is not handled by the workspace key handler and focus stays in that text field

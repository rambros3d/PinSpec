# Spec Delta

## MODIFIED Requirements

### Requirement: The document never scrolls

The workspace SHALL fit entirely within the visible viewport in both
orientations, and the root document SHALL NOT scroll or overscroll at any
viewport size. Panes and modal bodies SHALL scroll internally. The home,
catalog, projects, and about routes SHALL scroll inside their own containers
while the root document and workspace stay viewport-locked. An expanded global
sidebar SHALL NOT create a document scrollbar or resize the workspace.

#### Scenario: Small viewport does not scroll the document

- **WHEN** the viewport is small or a mobile browser shows a dynamic toolbar and workspace content is taller than the visible area
- **THEN** the document does not scroll or overscroll and the workspace root remains sized to the visible viewport

#### Scenario: Internal panes scroll independently

- **WHEN** the user scrolls inside the peripheral tree, detail column, summary drawer, dock body, or a modal body
- **THEN** that content scrolls within its own container while the document stays fixed

#### Scenario: Landing page scrolls inside its own container

- **WHEN** landing page content is taller than the visible viewport on a short screen
- **THEN** the landing scroll container moves the content vertically inside the viewport and the root document does not scroll

#### Scenario: Landing scroll does not affect the workspace

- **WHEN** the user navigates from a scrolled landing page to a workspace route
- **THEN** the workspace root remains sized to the visible viewport and the document stays fixed

#### Scenario: Shell route scroll does not affect the workspace

- **WHEN** the user scrolls a catalog, projects, or about route and then opens a workspace route
- **THEN** the workspace root remains sized to the visible viewport and the document stays fixed

#### Scenario: Expanded sidebar does not introduce document scrolling

- **WHEN** the global sidebar is expanded over a workspace or a shell route
- **THEN** the root document neither scrolls nor widens and the underlying workspace keeps its viewport bounds

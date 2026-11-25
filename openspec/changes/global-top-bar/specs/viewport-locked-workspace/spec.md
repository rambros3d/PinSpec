# Spec Delta

## MODIFIED Requirements

### Requirement: The document never scrolls

The workspace SHALL fit entirely within the visible viewport in both
orientations, and the root document SHALL NOT scroll or overscroll at any
viewport size. Panes and modal bodies SHALL scroll internally. The home,
catalog, projects, and about routes SHALL scroll inside their own containers
while the root document and workspace stay viewport-locked. An expanded global
sidebar SHALL NOT create a document scrollbar or resize the workspace. The
rail and global bar SHALL NOT widen the document.

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

#### Scenario: Reserved rail does not widen the document

- **WHEN** any route is opened with the 3rem rail space reserved
- **THEN** the document width does not increase and no horizontal document scrollbar appears

#### Scenario: Global bar does not add document scrolling

- **WHEN** the global top bar is rendered on any route
- **THEN** the root document stays fixed and the route content scrolls inside its own container

### Requirement: Toolbar stays within the viewport width

The global top bar SHALL remain within the viewport width on narrow screens and
on every route. Its controls SHALL compact where possible and, when they do not
fit, SHALL be reachable through horizontal scrolling inside the bar. The bar
SHALL NOT widen the document.

#### Scenario: Narrow toolbar scrolls internally

- **WHEN** the viewport is too narrow for every toolbar control to fit
- **THEN** the toolbar stays within the viewport and its controls are reachable by scrolling the toolbar horizontally

#### Scenario: Toolbar cannot widen the document

- **WHEN** a long part number or many toolbar controls are present on a narrow viewport
- **THEN** the document width does not increase and no horizontal document scrollbar appears

#### Scenario: Global bar scrolls on narrow viewports

- **WHEN** a shell route or workspace is opened on a narrow viewport with many bar controls
- **THEN** the global bar stays within the viewport and its controls are reachable by horizontal scrolling inside the bar

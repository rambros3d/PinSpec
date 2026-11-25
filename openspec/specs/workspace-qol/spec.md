# workspace-qol Specification

## Purpose

Defines the error, empty, focus, feedback, and touch behaviors of the landing
and workspace surfaces so that pinout planning remains usable, readable, and
operable by keyboard on desktop and mobile viewports.

## Requirements

### Requirement: Catalog load failure is visible and retryable

When the static catalog cannot be loaded, the landing quick-search dropdown
SHALL show the failure message and a retry action instead of a normal result
list. Retrying SHALL start a new catalog load; a successful retry SHALL restore
normal search results, and a failed retry SHALL show the failure again. Covered
error rows SHALL use daisyUI alert classes and pending rows SHALL use daisyUI
loading indicators.

#### Scenario: Failed catalog fetch shows an error row

- **WHEN** the catalog index or metadata request fails and the user opens the quick-search dropdown
- **THEN** the dropdown shows the failure message and a retry control instead of an empty-result message

#### Scenario: Retry recovers the catalog

- **WHEN** the user activates the retry control and the catalog requests now succeed
- **THEN** the error row is replaced by the loading state and then by matching parts

#### Scenario: Retry failure is reported again

- **WHEN** the user activates the retry control and the catalog requests fail again
- **THEN** the dropdown shows the failure message and the retry control again without leaving an empty result list

#### Scenario: Error and pending surfaces adopt component classes

- **WHEN** a catalog error or pending state is shown on any covered surface
- **THEN** the error uses `alert alert-soft alert-error` with unchanged text and the pending text is accompanied by `loading loading-spinner loading-xs`

### Requirement: Pin table empty states are distinct and sortable headers are described

The pin table SHALL distinguish a board with no assignments from a board whose
assignments do not match the active filter. The no-match state SHALL offer a
clear-filter action. Sortable column headers SHALL expose the active sort
column and direction as `aria-sort`.

#### Scenario: Board with no assignments

- **WHEN** no pins are assigned and the pin table is shown with an empty filter
- **THEN** the table shows the no-assignments message and guidance to assign a pin, without the clear-filter action

#### Scenario: Assignments hidden by the filter

- **WHEN** pins are assigned but the active filter matches none of them
- **THEN** the table shows a no-match message and a clear-filter action, and activating it restores the filtered-out rows

#### Scenario: Sort state is announced

- **WHEN** the user changes the pin table sort column or direction
- **THEN** the sorted column header reports ascending or descending through `aria-sort` and the other sortable headers are neutral

### Requirement: Toast stays clear of the portrait dock and can be dismissed

Workspace notifications SHALL use a dedicated toast class. In portrait the
toast SHALL sit above the bottom dock with a bottom offset of
`calc(43dvh + 0.75rem)` so it does not cover the dock tabs or dock body. The
toast SHALL provide a dismiss control in addition to its existing timeout. It
SHALL remain fully visible when the global sidebar is expanded over the
workspace.

#### Scenario: Portrait toast clears the dock

- **WHEN** a notification is shown while the workspace is in portrait orientation
- **THEN** the toast is fully visible above the dock and does not overlay the dock tabs or dock body

#### Scenario: Toast is dismissed manually

- **WHEN** the user activates the toast dismiss control
- **THEN** the toast is removed immediately and can be replaced by a later notification

#### Scenario: Landscape placement is unchanged

- **WHEN** a notification is shown in landscape
- **THEN** the toast remains centered at the bottom of the workspace with its existing tone and timeout

#### Scenario: Expanded sidebar does not hide the toast

- **WHEN** a notification is shown while the global sidebar is expanded in either orientation
- **THEN** the toast remains fully visible and its dismiss control remains operable above the sidebar overlay

### Requirement: Copy and download failures are reported

Failure of a clipboard write or file download SHALL be reported to the user in
the workspace export dialog. That dialog SHALL keep its success confirmation
indicator on a successful copy. A generated object URL SHALL remain valid until
the browser has started the download. The start screen SHALL NOT provide an
export preview, so no copy or download failure strings are required there.

#### Scenario: Clipboard write is rejected

- **WHEN** the browser rejects a clipboard write from the workspace export dialog
- **THEN** a visible failure notification is shown and the success indicator is not set

#### Scenario: Download cannot be started

- **WHEN** a download action in the workspace export dialog fails
- **THEN** a visible failure notification is shown instead of failing silently

#### Scenario: Object URL lifetime

- **WHEN** a download is started from the workspace export dialog
- **THEN** the object URL is revoked only after the download has begun, so the anchor can still read its content

#### Scenario: No landing export surface

- **WHEN** the start screen is rendered
- **THEN** it shows no copy or download control for an export preview, and export failure handling is exercised only by the workspace dialog

### Requirement: Native dialogs manage focus on open and close

Every native dialog in the workspace SHALL move focus to a control inside the
dialog when it opens and SHALL return focus to the control that opened it when
it closes, including close by Escape, cancel, backdrop click, and the dialog's
own close action. This applies to the export, MCU switcher, board selector,
compatible-part finder, pinout diff, ambiguous-part, and shortcut-help dialogs.
The shortcut-help modal backdrop SHALL be a direct child of the dialog element
outside `.modal-box`.

#### Scenario: Export dialog opens with focus inside

- **WHEN** the export dialog is opened
- **THEN** focus is on a control inside the dialog and not on the underlying page

#### Scenario: Focus returns after close

- **WHEN** any workspace native dialog is closed by Escape or its close control
- **THEN** focus returns to the control that opened that dialog

#### Scenario: Shortcut help backdrop keeps dismissal behavior

- **WHEN** shortcut help is closed by a backdrop click with the backdrop placed directly under the dialog
- **THEN** the dialog closes and focus returns to the control that opened it

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

### Requirement: Keyboard focus is visible and motion respects user preference

Interactive controls SHALL show a visible focus indicator driven by existing theme tokens. Reduced-motion preference SHALL suppress decorative animations across the landing and workspace surfaces, not only the pin pulse. Small body copy SHALL use sufficient contrast without changing decorative icon tint. Icon replacements SHALL preserve focus indicators and accessible names, and any duotone icon tint SHALL resolve from theme tokens.

#### Scenario: Keyboard focus ring appears

- **WHEN** a user navigates to an interactive control with the keyboard
- **THEN** a visible focus ring is shown around that control in both light and dark themes

#### Scenario: Reduced motion suppresses decorative animation

- **WHEN** the operating system requests reduced motion
- **THEN** decorative animations on landing and workspace surfaces do not play while state changes remain instantaneous

#### Scenario: Body copy remains legible

- **WHEN** small supporting body copy is rendered on a landing or workspace surface
- **THEN** its text contrast is at least that of the standard muted text token and decorative icon tint is unchanged

#### Scenario: Replaced icons keep accessible controls intact

- **WHEN** an icon-only control in a dialog, the canvas toolbar, or a modal is focused after the icon replacement
- **THEN** its focus ring and accessible name match the pre-replacement control and only the glyph drawing differs

### Requirement: Placement overlay supports Escape and keyboard focus

The placement overlay SHALL end an active indicator drag when Escape is
pressed and SHALL keep a visible focus indicator on the keyboard-operable SVG
indicator group. Arrow-key angle adjustment and the ability to close the
overlay SHALL remain available.

#### Scenario: Escape ends an indicator drag

- **WHEN** the user is dragging a placement indicator and presses Escape
- **THEN** the drag ends without committing a further angle change and focus remains on a visible control

#### Scenario: Indicator group is visibly focusable

- **WHEN** the user moves keyboard focus to a placement indicator group
- **THEN** a visible focus indicator is shown around the group and arrow keys still adjust its angle

### Requirement: Portrait dock tabs have touch-sized accessible controls

Portrait dock tab controls SHALL have a minimum height of `min-h-11` and SHALL
be exposed as a tablist of tabs with selection state. Only the selected tab
SHALL be reported as selected, and switching tabs SHALL keep the existing
single-layout behavior and persisted active tab.

#### Scenario: Dock tabs expose selection semantics

- **WHEN** the workspace is in portrait orientation and a dock tab is active
- **THEN** the tab strip is exposed as a tablist, each tab is exposed as a tab, and only the active tab reports selected state

#### Scenario: Dock tabs have touch-sized targets

- **WHEN** the dock tab strip is rendered in portrait
- **THEN** each tab has a minimum height of `min-h-11` and remains horizontally reachable without scrolling the document

### Requirement: Toolbar overflow has a scroll affordance

The horizontally scrollable global top bar SHALL indicate when its control row
has more content to the right and SHALL keep the existing internal horizontal
scrolling behavior and h-12 bar height.

#### Scenario: Scrollable toolbar shows an affordance

- **WHEN** the toolbar control row overflows its available width
- **THEN** a visible affordance indicates additional controls to the right and scrolling the row reveals those controls without widening the document

#### Scenario: Fitting toolbar has no stale affordance

- **WHEN** all toolbar controls fit within the available width
- **THEN** no scroll affordance is shown and the control row remains unchanged

#### Scenario: Global bar overflow affordance

- **WHEN** the global bar control row overflows on any route
- **THEN** the affordance indicates additional controls and scrolling reveals them without widening the document

### Requirement: First-time recent-sessions hint is derived from existing state

When no recent local sessions exist, the landing presets area SHALL show a
short hint explaining that opening a part creates a recent session. When at
least one session exists, the hint SHALL NOT be shown. No new persisted setting
SHALL be required for the hint.

#### Scenario: No recent sessions

- **WHEN** the landing page loads with an empty recent-sessions list
- **THEN** a short hint near the starter chips explains that opening a part creates a recent session

#### Scenario: Existing recent sessions

- **WHEN** the landing page loads with at least one recent session
- **THEN** the recent sessions are listed and the first-time hint is not shown

### Requirement: Shortcut help is available on demand

A help dialog SHALL be openable with the `?` key and from the shortcuts control
in the global top bar, and SHALL list the keyboard shortcuts available in the
workspace. It SHALL follow the same focus, Escape, and close behavior as the
other workspace dialogs and SHALL NOT appear while the user is typing in a text
field. The inline project-name input in the global top bar is such a text field,
and Escape there SHALL cancel the name edit before any dialog or popover closes.

#### Scenario: Help opens from the keyboard

- **WHEN** the user presses `?` outside a text field
- **THEN** a dialog opens listing the available keyboard shortcuts with focus inside the dialog

#### Scenario: Help does not interrupt typing

- **WHEN** the user types `?` inside a text field
- **THEN** the help dialog does not open and the character is entered normally

#### Scenario: Help opens from the global bar

- **WHEN** the user activates the shortcuts control in the global top bar
- **THEN** the same help dialog opens with focus inside and the same close behavior as the `?` shortcut

#### Scenario: Project-name input does not open help

- **WHEN** the user types `?` while the inline project-name input has focus
- **THEN** the character is entered in that input and no help dialog opens

#### Scenario: Escape cancels the name edit first

- **WHEN** the inline project-name input has focus and the user presses Escape
- **THEN** the name edit is cancelled and no help dialog or other popover is opened

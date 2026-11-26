# placement-toggle-and-accent-icons Specification

## Purpose

Covers the visible feedback of the canvas Placement toggle, its activation of the Placement panel, and the accent-colored navigation icons that make the collapsed sidebar rail readable.

## Requirements

### Requirement: Sidebar navigation icons use the accent token

The collapsed and expanded sidebar navigation icons SHALL resolve their primary color from the daisyUI `accent` token through a theme-aware utility. Labels SHALL keep their inherited foreground treatment, and icons on the active route SHALL retain `info` highlighting.

#### Scenario: Inactive icons use accent while labels stay muted

- **WHEN** the sidebar renders a non-active section in either rail or expanded state
- **THEN** its icon resolves to the accent token and its label keeps the inherited base foreground

#### Scenario: Active route icons keep info highlighting

- **WHEN** a section is the active route
- **THEN** its icon resolves to the `info` token while its label keeps its existing active foreground treatment

#### Scenario: Utility icons follow the same rule

- **WHEN** the Hotkeys entry and the expand or collapse control render their icons
- **THEN** those icons resolve to the accent token and their labels keep the inherited foreground

#### Scenario: Theme switch recolors icons without raw colors

- **WHEN** the active theme changes while the sidebar is visible
- **THEN** icon colors follow the active accent and info tokens and no color literal or emoji appears in sidebar source

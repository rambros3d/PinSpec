# landing-declutter Specification

## Purpose

Defines the focused presentation of the start screen after the declutter pass:
spacing, card density, and visual hierarchy across the action, discovery, and
rail zones, plus the non-regression contract for the behavior those zones host.

## Requirements

### Requirement: The start screen keeps its shell frame and content boundaries

The presentation pass SHALL keep one global top bar and the `.landing-shell`
scroll container, with no per-page navbar. No promotional language, emoji, new
route, or new feature SHALL be introduced.

#### Scenario: Shell frame is unchanged

- **WHEN** the start screen renders on any route-supported viewport
- **THEN** one global top bar is present, no page-level navbar is rendered, and the `.landing-shell` container scrolls its own content

#### Scenario: No promotional copy or emoji

- **WHEN** the reworked start screen copy is inspected
- **THEN** no marketing claim or emoji appears in any zone and the text describes what each action does

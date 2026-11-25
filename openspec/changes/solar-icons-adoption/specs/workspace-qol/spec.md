# Spec Delta

## MODIFIED Requirements

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

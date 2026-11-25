# Spec Delta

## MODIFIED Requirements

### Requirement: Token integration keeps the static UI clean

Delivered UI source SHALL contain no raw color literals outside `src/themes/daisyui.css` and no emoji characters, and all type checks, unit tests, and the subpath production build SHALL pass with zero warnings. Icon markup SHALL inherit its primary color from `currentColor` and SHALL derive any duotone secondary color from an existing theme token rather than a literal value.

#### Scenario: Source hygiene scan

- **WHEN** the repository source files are scanned for hex/rgb/oklch color literals and emoji code points
- **THEN** color literals occur only in `src/themes/daisyui.css` and no emoji is found

#### Scenario: Verification sequence

- **WHEN** `npm test`, `npm run check`, and `BASE_PATH="/pincraft/" npm run build` are run
- **THEN** all three commands exit zero and the build reports no Svelte warnings

#### Scenario: Duotone color follows the active theme

- **WHEN** a duotone icon is rendered in the light theme and again in the dark theme
- **THEN** its secondary color resolves from the documented theme token and no color literal appears in the icon markup or stylesheet

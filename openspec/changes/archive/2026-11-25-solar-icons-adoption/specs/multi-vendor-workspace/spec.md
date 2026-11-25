# Spec Delta

## MODIFIED Requirements

### Requirement: Multi-vendor layouts remain legible across themes and zooms

The package renderers SHALL produce clean, non-overlapping pins and readable labels for SOP8, TSSOP20, LQFP48, QFN-56, and QFN-80 in both light and dark themes at the supported zoom range. Replacement bold duotone icons on workspace surfaces SHALL remain legible in both themes at the supported zoom range, and the icon replacement SHALL NOT change renderer geometry, labels, or textures.

#### Scenario: Zoomed inspection in both themes

- **WHEN** each listed package is rendered at minimum and maximum zoom in light and dark themes
- **THEN** pin pads, mux labels, and bonded/exposed-pad annotations remain readable and do not overlap

#### Scenario: Icon legibility in both themes

- **WHEN** workspace toolbar, tree, canvas, and dialog icons are rendered in light and dark themes
- **THEN** both duotone layers remain distinguishable against the active background and no control label is obscured

#### Scenario: Package renderer behavior is unchanged

- **WHEN** the two package renderer files are inspected after the icon replacement
- **THEN** their geometry, label code, and texture filters match the pre-replacement implementation

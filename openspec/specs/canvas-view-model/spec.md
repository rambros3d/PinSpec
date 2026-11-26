# canvas-view-model Specification

## Purpose

Defines the pure canvas view model for fit, zoom, wheel, and pinch transforms, and the boundary between that arithmetic and the DOM orchestration in PackageCanvas.

## Requirements

### Requirement: Canvas view math is pure and reusable

The canvas fit, zoom, wheel, and pinch formulas SHALL live in a pure
`src/core/canvas-view.ts` module with no Svelte or DOM import. The module SHALL
preserve the existing zoom clamps, quarter-turn extent selection, cursor-centered
zooming, wheel step behavior, and three-decimal rounding.

#### Scenario: Fit keeps declared extents and clamps

- **WHEN** a stage is fitted from declared SVG width and height plus a viewBox
- **THEN** the returned zoom is clamped to the existing range and quarter-turn rotations use the viewBox extents before centering

#### Scenario: Zoom and pinch anchor at a point

- **WHEN** zooming by a factor around a client-space point, including pinch input
- **THEN** the returned pan keeps that point fixed and the zoom stays within the existing clamp and rounding rules

### Requirement: PackageCanvas delegates arithmetic but keeps DOM behavior

`PackageCanvas.svelte` SHALL call the pure helpers for view math while keeping
its exported `fitView()` method, pointer capture rules, wheel and gesture
listeners, HUD markup, and overlay coordinates unchanged.

#### Scenario: Existing workspace fit call still works

- **WHEN** the workspace calls the canvas instance's `fitView()` method
- **THEN** the canvas reads the rendered SVG extents, applies the pure fit transform, and centers the package as before

#### Scenario: Static contracts inspect the helper seam

- **WHEN** a source assertion checks zoom or pinch arithmetic
- **THEN** it inspects the pure helper module and the component call sites instead of inline formulas

# Spec Delta

## ADDED Requirements

### Requirement: Package pins are operable by keyboard

Every interactive I/O pin in `PerimeterPackage.svelte` and `GridPackage.svelte`
SHALL be focusable with a button role and an accessible label derived from its
pin title. Enter or Space SHALL invoke the existing pin-click callback with
coordinates centred on the focused pin. Fixed pads SHALL NOT be focusable and
SHALL be marked `aria-disabled`. The SVG wrapper SHALL keep its diagram role and
label, and focus styling SHALL come from the global `:focus-visible` rule.

#### Scenario: Keyboard opens the pin popover

- **WHEN** a keyboard user tabs to an I/O pin in either renderer and presses Enter or Space
- **THEN** that pin's click callback runs with coordinates centred on the focused pin, opening the same AF popover a left-click would open

#### Scenario: Keyboard remap follows the pointer path

- **WHEN** remap mode is active and a focused alternate pin is activated with Enter
- **THEN** the assignment moves or reports the same occupied or locked result as a pointer click on that pin

#### Scenario: Non-I/O pads are skipped

- **WHEN** focus moves through the package diagram
- **THEN** only I/O pads receive focus and the diagram keeps its existing accessible name

### Requirement: Portrait shell routes fit narrow screens

The single portrait media query SHALL reduce horizontal padding for the landing
grid and the other shell route bodies. No second orientation query, JavaScript
layout selection, or document scroll SHALL be introduced, and the workspace
grid areas SHALL remain unchanged.

#### Scenario: Narrow portrait route padding

- **WHEN** a shell route is shown in portrait on a phone-width viewport
- **THEN** its main content uses reduced horizontal padding while staying inside the viewport and scrolling only in its existing container

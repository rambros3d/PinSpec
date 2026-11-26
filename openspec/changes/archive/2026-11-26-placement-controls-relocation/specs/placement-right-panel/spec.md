# Spec Delta

## REMOVED Requirements

### Requirement: Opening the Placement tab activates the overlay

**Reason**: Overlay visibility is derived from enabled bubbles, so opening a tab no longer changes it.

**Migration**: Enable a bubble in the Placement tab; rings appear automatically.

### Requirement: Persistence split for placement controls

**Reason**: Overlay visibility is no longer a localStorage preference.

**Migration**: Use the bubble-based persistence contract in `placement-controls-relocation`; drawer and dock tabs remain local-only.

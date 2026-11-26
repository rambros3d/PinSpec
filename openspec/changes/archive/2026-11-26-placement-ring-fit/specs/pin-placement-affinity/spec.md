# Spec Delta

## REMOVED Requirements

### Requirement: Overlay rings are closer with a larger outer ring

**Reason**: Fixed ring factors relative to a stage-centred radius cannot keep the rendered IC body inside the inner ring after pan or zoom.

**Migration**: Use the body-centred dynamic radii in `placement-ring-fit`.

### Requirement: Outer radius comes from a pure measured helper

**Reason**: The furniture-safe radius helper remains, but it is now one input to body-centred ring geometry rather than the single source of all ring radii.

**Migration**: Keep `measuredSafeRadius` with an arbitrary centre and feed its result into the pure ring-geometry helpers.

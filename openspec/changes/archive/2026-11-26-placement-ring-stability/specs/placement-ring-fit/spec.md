# Spec Delta

## REMOVED Requirements

### Requirement: The inner ring clears the IC body

**Reason**: The furniture-safe clamp could invert ring order when the body grew larger than the safe radius.

**Migration**: Use fixed body-relative factors 1.4 / 1.55 / 1.7 defined in `placement-ring-stability`.

### Requirement: Oversized packages zoom out

**Reason**: Continuous auto-fit on chip, rotation, resize, and enable conflicted with manual zoom and caused the regression.

**Migration**: Apply a single enable-time fit only, as described in `placement-ring-stability`.

# Spec Delta

## REMOVED Requirements

### Requirement: Angular and radial scoring applies within a ring

**Reason**: Angular gap and normalized radius from the package centre do not match the visible bubble position.

**Migration**: Use the bubble-to-pad-centre distance contract in `placement-affinity-bubble-distance`; ring rank remains primary.

# Spec Delta

## REMOVED Requirements

### Requirement: Ring radii scale only from the IC body

**Reason**: The ring reference radius now comes from the farthest measured pin pad/ball bounds so visible pins stay inside the high ring.

**Migration**: Use the pin-bounds radius contract in `placement-pin-ring-refinement`; keep the body centre as the ring centre.

# Design: Placement Affinity Bubble Distance

1. **One coordinate system.** `PinGeometry` gains `x` and `y` alongside
   `angle` and `radius`. Both perimeter and grid geometry derive them from the
   existing normalized side/row-col math, so no DOM measurement enters core.

2. **Bubble point.** A pure helper maps a `{ angle, ring }` preference to a
   package-space point: `radius = ringFactor × geometry.maxRadius`, with ring
   factors `1.4 / 1.55 / 1.7`. The stored preference schema stays unchanged.

3. **Score.** `placementAffinityForPin()` remains `rank × 10000 + penalty`,
   where `penalty = distance(padCentre, bubblePoint) / maxPossibleDistance × 60`.
   Disabled preferences still return zero. `maxPossibleDistance` uses the
   bubble radius plus the maximum pad radius so the penalty stays in `0–60`.

4. **Cache.** `PlacementAffinityContext.geometry` remains the single reusable
   map used by allocation and matrix alternate ranking. No new state is added.

5. **Tests.** Host tests pin pad-centre coordinates, bubble points, distance
   monotonicity, ring-rank dominance, and disabled zero. Existing allocation,
   persistence, and matrix-cap tests must stay green.

## Risks / Trade-offs

- Canvas ring radii come from measured farthest pin corners, while the solver
  uses pad centres. Both share the same factors and centre, so ordering is
  consistent; absolute scale differs slightly by pad size.
- Replacing angular/radial penalties changes allocation for enabled placement
  preferences by design; disabled preferences remain byte-identical.

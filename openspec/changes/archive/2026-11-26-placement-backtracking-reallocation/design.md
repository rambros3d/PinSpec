# Design: Placement Backtracking Reallocation

1. **One search for both paths.** `reallocatePeripheralPlacement()` builds
   `BacktrackingOption` groups for every unsatisfied signal from free, unlocked
   I/O pins supporting that signal. Each option score is the existing scarcity
   plus affinity sum. Groups are ordered by option count, then
   `searchBacktracking()` chooses the combination with the most assigned signals
   and lowest total score.

2. **Bounded work.** The existing `maxNodes` and `branchLimit` limits are kept so
   live dragging stays responsive. The result is better than greedy selection
   but not globally optimal.

3. **Locked pins.** Locked assignments remain in `next.assignments`, mark their
   signals satisfied, and are never offered as candidates.

4. **Labels move with assignments.** When a pick changes a pin position, copy
   `next.labels[fromPos]` to `toPos` and delete the old label. If a signal has no
   pick, restore its previous assignment and label rather than dropping it.

5. **No scoring change.** Scarcity, affinity, electrical penalties, matrix
   legality, and candidate caps remain exactly as they are. Disabled placement
   preferences still produce a byte-identical workspace.

6. **Tests.** A fixture where a scarce signal must yield its first-choice pin so
   another signal can be placed, plus locked immovability, label movement,
   no-pick preservation, matrix parity, and disabled-preference regression.

## Risks / Trade-offs

- Backtracking maximizes assigned signals before score; a higher-scoring but
  smaller assignment set is intentionally rejected.
- Restoring a previous assignment may leave a pin that the new search wanted for
  another signal; this is preferable to silently losing a signal and matches the
  previous behavior when no candidate existed.

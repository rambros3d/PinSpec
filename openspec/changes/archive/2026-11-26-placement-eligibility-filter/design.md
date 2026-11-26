# Design: Placement Eligibility Filter

1. **Pure classification.** A new `src/core/` helper takes `chip`,
   `assignments`, and `locked`. For each non-GPIO peripheral with assignments it
   calls `findAlternatePins()` for every non-locked assigned pin. A `free`
   candidate qualifies; an `occupied` candidate qualifies when its occupant is
   not locked and `findAlternatePins()` gives that occupant a `free` candidate.
   One hop is enough; no deeper recursion is performed.

2. **Three outcomes.** `eligible` means at least one movable pin; `locked-only`
   means the peripheral has assignments but none of them are unlocked;
   `ineligible` covers everything else. The helper also returns a short reason
   string for disabled rows.

3. **Panel behavior.** `PlacementPanel.svelte` filters configured names through
   the helper, renders eligible rows normally, renders locked-only rows with a
   disabled checkbox and explanatory `title`/`aria-label`, and hides ineligible
   names. The empty state explains that no configured peripheral has a
   reassignable pin.

4. **Canvas parity.** `PackageCanvas.svelte` derives `placementOptions` from the
   same eligible names, so no overlay indicator appears for a peripheral the
   panel cannot enable. Existing placement preferences for hidden peripherals
   are left untouched in persisted state.

5. **Tests.** Host tests cover free alternates, occupied one-hop mobility,
   locked-only classification, no-alternate ineligibility, and GPIO exclusion.
   Static tests verify disabled row markup and reason text. Allocation,
   persistence, ring-selection, and rotation coverage must remain green.

## Risks / Trade-offs

- One-hop mobility is an approximation: a chain of two occupied pins is not
  treated as movable. This matches the existing one-hop remap contract.
- Hiding a peripheral does not delete its stored preference; it can reappear
  when pins become movable again.

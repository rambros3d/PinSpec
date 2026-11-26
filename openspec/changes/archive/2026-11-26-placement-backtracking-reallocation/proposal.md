# Proposal: Placement Backtracking Reallocation

## Why

Non-matrix placement reallocation currently commits each signal to its best
free pin and never revisits that decision. A scarce signal can therefore consume
a pin needed by a later signal, leaving that signal unassigned even though a
different combination would place both. Matrix reallocation already uses the
shared backtracking search; ordinary packages should get the same benefit.

## What Changes

- Build candidate option groups per unsatisfied signal and run the existing
  `searchBacktracking()` for non-matrix placement changes.
- Keep locked pins fixed and satisfied; only free, unlocked pins are candidates.
- Carry a custom label with its assignment when the chosen pin changes.
- Preserve the previous assignment when no candidate group can be satisfied, so
  reallocation never silently drops a signal.
- Leave matrix reallocation, disabled preferences, and the share/project schema
  unchanged.
- Add host tests for pin lock-in, locked immovability, label movement, and
  no-regression behavior.

## Capabilities

- `placement-backtracking-reallocation`
- `pin-placement-affinity`

## Out of scope

No solver rules outside placement reallocation, no allocation scoring formula,
no persistence or generated-data change, no new dependency or preference.

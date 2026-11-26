/**
 * Pure placement eligibility classification. A placement bubble is only useful
 * when at least one assigned pin of the peripheral can move. Alternate discovery
 * is reused from the remap phase so the panel shows exactly the mobility the
 * solver can perform, with no DOM or Svelte dependency.
 */

import { findAlternatePins } from './solver-remap';
import type { ChipData, PinAssignment, WorkspaceState } from './types';

/** Eligibility of one configured peripheral for a placement bubble. */
export type PlacementEligibilityStatus = 'eligible' | 'locked-only' | 'ineligible';

/** One classified peripheral and the reason shown when its row is disabled. */
export interface PeripheralPlacementEligibility {
  name: string;
  status: PlacementEligibilityStatus;
  /** Empty for eligible rows; explains disabled rows in the placement panel. */
  reason: string;
}

const LOCKED_ONLY_REASON = 'All assigned pins are locked. Unlock a pin before enabling placement.';
const NO_ALTERNATE_REASON = 'No assigned pin has a movable alternate, so placement cannot move it.';

/**
 * Build the minimal state required by alternate discovery. The classification
 * reads only assignments and locks, so labels, modes, and preferences are not
 * part of its inputs.
 */
function stateFor(
  chip: ChipData,
  assignments: Record<string, PinAssignment>,
  locked: Record<string, boolean>,
): WorkspaceState {
  return { mcuId: chip.id, assignments, labels: {}, locked, peripheralModes: {} };
}

function hasFreeAlternate(chip: ChipData, state: WorkspaceState, pos: string): boolean {
  return findAlternatePins(chip, state, pos).some((candidate) => candidate.status === 'free');
}

/**
 * One hop of mobility: a free alternate qualifies directly; an occupied
 * alternate qualifies only when its unlocked occupant has a free alternate of
 * its own. Longer chains are deliberately not followed.
 */
function pinIsMovable(chip: ChipData, state: WorkspaceState, pos: string): boolean {
  for (const candidate of findAlternatePins(chip, state, pos)) {
    if (candidate.status === 'free') return true;
    if (candidate.status !== 'occupied' || !candidate.occupant) continue;
    if (candidate.occupant.peripheral === 'GPIO') continue;
    if (state.locked[candidate.pos]) continue;
    if (hasFreeAlternate(chip, state, candidate.pos)) return true;
  }
  return false;
}

/**
 * Classify configured non-GPIO peripherals from chip, assignments, and locked
 * state. When `names` is omitted, every assigned non-GPIO peripheral is used;
 * callers with mode configuration pass `configuredPeripheralNames()` so the
 * result stays aligned with the peripheral tree. GPIO is always excluded.
 */
export function classifyPlacementEligibility(
  chip: ChipData,
  assignments: Record<string, PinAssignment>,
  locked: Record<string, boolean>,
  names?: readonly string[],
): PeripheralPlacementEligibility[] {
  const state = stateFor(chip, assignments, locked);
  const sourceNames = names ?? Array.from(
    new Set(
      Object.values(assignments)
        .map((asgn) => asgn.peripheral)
        .filter((name) => name && name !== 'GPIO'),
    ),
  );
  return sourceNames
    .filter((name) => name !== 'GPIO')
    .map((name) => {
      const positions = Object.entries(assignments)
        .filter(([, asgn]) => asgn.peripheral === name)
        .map(([pos]) => pos);
      if (positions.length === 0) {
        return { name, status: 'ineligible' as const, reason: NO_ALTERNATE_REASON };
      }
      const unlocked = positions.filter((pos) => !state.locked[pos]);
      if (unlocked.length === 0) {
        return { name, status: 'locked-only' as const, reason: LOCKED_ONLY_REASON };
      }
      if (unlocked.some((pos) => pinIsMovable(chip, state, pos))) {
        return { name, status: 'eligible' as const, reason: '' };
      }
      return { name, status: 'ineligible' as const, reason: NO_ALTERNATE_REASON };
    });
}

/** Names the placement panel and canvas may offer as toggleable bubbles. */
export function eligiblePlacementNames(
  chip: ChipData,
  assignments: Record<string, PinAssignment>,
  locked: Record<string, boolean>,
  names?: readonly string[],
): string[] {
  return classifyPlacementEligibility(chip, assignments, locked, names)
    .filter((entry) => entry.status === 'eligible')
    .map((entry) => entry.name);
}

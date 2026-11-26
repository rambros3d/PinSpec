/**
 * Public solver API. The implementation is split into pure phase modules;
 * this barrel preserves every import path used by the application and tests.
 */

export {
  PERIPHERAL_MODE_TEMPLATES,
  getModesForPeripheral,
  resolveCanonicalSignal,
} from './solver-modes';
export {
  createEmptyWorkspace,
  pinSupportsSignal,
  computePinScarcityScore,
} from './solver-common';
export {
  MATRIX_ALTERNATE_LIMIT,
  findAlternatePins,
  remapPinAssignment,
  applyRemapGroup,
  remapGroupFix,
  findOneHopFixForSignal,
  applyOneHopFix,
  type RemapGroupResult,
} from './solver-remap';
export {
  searchBacktracking,
  allocatePeripheralMode,
  togglePeripheralSignal,
  reallocatePeripheralPlacement,
  reallocateMatrixPlacement,
  reallocatePlacementOrdered,
  type BacktrackingOption,
  type BacktrackingPick,
  type BacktrackingSearchResult,
  type AllocationResult,
} from './solver-allocation';
export {
  validateMatrixPlan,
  deriveExtiLineId,
  evaluateWorkspace,
} from './solver-diagnostics';

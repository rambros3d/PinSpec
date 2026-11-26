/**
 * Pin alternates, remap groups, and one-hop fixes. Every fix returns a cloned
 * workspace state; no assignment is mutated in place.
 */

import { cloneWorkspaceState } from './history';
import { rankMatrixAlternates } from './placement';
import { getChipMuxModel, isFlexibleRoutingMux } from './types';
import type {
  AlternatePinCandidate,
  ChipData,
  DiagnosticItem,
  OneHopFix,
  PeripheralRemapOption,
  PinInfo,
  PinAssignment,
  RemapMove,
  WorkspaceState,
} from './types';
import {
  assignmentFromSignal,
  computePinScarcityScore,
  computeSignalPinCounts,
  findPinByName,
  muxMetadata,
  pinSupportsSignal,
} from './solver-common';

/** Maximum number of matrix alternates shown after deterministic sorting. */
export const MATRIX_ALTERNATE_LIMIT = 12;

export function findAlternatePins(
  chip: ChipData,
  state: WorkspaceState,
  pos: string,
): AlternatePinCandidate[] {
  const current = state.assignments[pos];
  if (!current || current.peripheral === 'GPIO') return [];

  if (isFlexibleRoutingMux(getChipMuxModel(chip))) {
    const usedSignals = new Set<string>();
    const usedResources = new Set<string>();
    for (const asgn of Object.values(state.assignments)) {
      if (asgn.peripheral !== 'GPIO') usedSignals.add(`${asgn.peripheral}:${asgn.signal}`);
      if (asgn.resourceId) usedResources.add(asgn.resourceId);
    }
    // The source pin is being changed, so it must not block its own alternates.
    usedSignals.delete(`${current.peripheral}:${current.signal}`);
    if (current.resourceId) usedResources.delete(current.resourceId);
    return rankMatrixAlternates(
      chip.pins,
      chip,
      state,
      current.peripheral,
      current.signal,
      usedSignals,
      usedResources,
    );
  }

  const candidates: AlternatePinCandidate[] = [];
  for (const pin of chip.pins) {
    if (pin.pos === pos) continue;
    if (pin.type !== 'io') continue;
    const match = pinSupportsSignal(pin, current.peripheral, current.signal);
    if (!match) continue;

    const occupant = state.assignments[pin.pos];
    const isLocked = Boolean(state.locked[pin.pos]);
    let status: AlternatePinCandidate['status'] = 'free';
    if (isLocked) {
      status = 'locked';
    } else if (occupant) {
      status = 'occupied';
    }

    candidates.push({
      pos: pin.pos,
      pinName: pin.name,
      af: match.af,
      ...(match.funcLabel !== undefined ? { funcLabel: match.funcLabel } : {}),
      ...(match.remapId !== undefined ? { remapId: match.remapId } : {}),
      ...(match.resourceId !== undefined ? { resourceId: match.resourceId } : {}),
      status,
      occupant,
    });
  }

  const sorted = candidates.sort((a, b) => {
    const rank = { free: 0, occupied: 1, locked: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.pinName.localeCompare(b.pinName, undefined, { numeric: true });
  });
  return sorted;
}

export function remapPinAssignment(
  chip: ChipData,
  state: WorkspaceState,
  fromPos: string,
  toPos: string,
): WorkspaceState {
  if (fromPos === toPos) return state;
  const source = state.assignments[fromPos];
  if (!source) return state;
  const targetPin = chip.pins.find((p) => p.pos === toPos);
  if (!targetPin || targetPin.type !== 'io') return state;
  if (state.locked[toPos]) return state;

  const match = pinSupportsSignal(targetPin, source.peripheral, source.signal);
  if (!match) return state;

  const next = cloneWorkspaceState(state);
  delete next.assignments[fromPos];
  next.assignments[toPos] = assignmentFromSignal(source, match);

  // A CH32 group move updates the active remap slot alongside the pin move.
  if (getChipMuxModel(chip) === 'remap-group' && match.remapId !== undefined) {
    next.activeRemaps = { ...(next.activeRemaps ?? {}), [source.peripheral]: match.remapId };
  }

  // Preserve custom user label on remap
  if (next.labels[fromPos]) {
    next.labels[toPos] = next.labels[fromPos];
    delete next.labels[fromPos];
  }
  if (next.locked[fromPos]) {
    delete next.locked[fromPos];
  }

  return next;
}

/** Result of an atomic remap-group switch; state is unchanged when blocked. */
export interface RemapGroupResult {
  state: WorkspaceState;
  applied: boolean;
  diagnostics: DiagnosticItem[];
}

export function findRemapOption(
  chip: ChipData,
  peripheral: string,
  remapId: number,
): PeripheralRemapOption | undefined {
  return chip.peripherals[peripheral]?.remaps?.find((option) => option.id === remapId);
}

/**
 * Plan and apply a coupled CH32-style remap group in one operation.
 * Every target is validated before the cloned state is mutated; a locked or
 * occupied target blocks the whole move and returns a resolvable diagnostic.
 */
export function applyRemapGroup(
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  remapId: number,
): RemapGroupResult {
  const option = findRemapOption(chip, peripheral, remapId);
  const unchanged = (diagnostics: DiagnosticItem[]): RemapGroupResult => ({
    state,
    applied: false,
    diagnostics,
  });
  if (!option) {
    return unchanged([
      {
        id: `remap:${peripheral}:${remapId}:missing`,
        severity: 'error',
        code: 'REMAP_MISMATCH',
        pins: [],
        peripheral,
        message: `${peripheral} has no remap option with ID ${remapId}.`,
      },
    ]);
  }

  const moves: Array<{ move: RemapMove; source: PinAssignment }> = [];
  const diagnostics: DiagnosticItem[] = [];

  for (const [signal, pinName] of Object.entries(option.signals)) {
    // Only signals currently active are relocated; inactive ones need no target.
    const sourceEntry = Object.entries(state.assignments).find(
      ([, a]) => a.peripheral === peripheral && a.signal === signal,
    );
    const targetPin = findPinByName(chip, pinName);
    if (!sourceEntry || !targetPin || sourceEntry[0] === targetPin.pos) continue;
    const [fromPos, source] = sourceEntry;

    if (state.locked[fromPos]) {
      diagnostics.push({
        id: `remap:${peripheral}:${remapId}:${signal}:sourcelocked`,
        severity: 'error',
        code: 'REMAP_LOCKED',
        pins: [fromPos],
        peripheral,
        message: `${peripheral} remap ${option.name} is blocked: source pin ${fromPos} is locked.`,
      });
      continue;
    }
    if (state.locked[targetPin.pos]) {
      diagnostics.push({
        id: `remap:${peripheral}:${remapId}:${signal}:locked`,
        severity: 'error',
        code: 'REMAP_LOCKED',
        pins: [targetPin.pos],
        peripheral,
        message: `${peripheral} remap ${option.name} is blocked: target pin ${targetPin.name} (${targetPin.pos}) is locked.`,
      });
      continue;
    }
    const match = pinSupportsSignal(targetPin, peripheral, signal);
    if (!match) {
      diagnostics.push({
        id: `remap:${peripheral}:${remapId}:${signal}:unsupported`,
        severity: 'error',
        code: 'REMAP_MISMATCH',
        pins: [fromPos, targetPin.pos],
        peripheral,
        message: `${targetPin.name} (${targetPin.pos}) does not support ${peripheral}_${signal}.`,
      });
      continue;
    }
    const occupant = state.assignments[targetPin.pos];
    if (occupant && (occupant.peripheral !== peripheral || occupant.signal !== signal)) {
      diagnostics.push({
        id: `remap:${peripheral}:${remapId}:${signal}:occupied`,
        severity: 'error',
        code: 'REMAP_MISMATCH',
        pins: [fromPos, targetPin.pos],
        peripheral,
        message: `${peripheral} remap ${option.name} cannot place ${signal} on ${targetPin.name} (${targetPin.pos}): occupied by ${occupant.peripheral}_${occupant.signal}.`,
      });
      continue;
    }

    moves.push({
      source,
      move: {
        signal: match.signal,
        fromPos,
        toPos: targetPin.pos,
        af: match.af,
        ...muxMetadata(match),
      },
    });
  }

  if (diagnostics.length > 0) return unchanged(diagnostics);

  const next = cloneWorkspaceState(state);
  for (const { move, source } of moves) {
    delete next.assignments[move.fromPos];
    const targetPin = chip.pins.find((p) => p.pos === move.toPos)!;
    const match = pinSupportsSignal(targetPin, peripheral, move.signal)!;
    next.assignments[move.toPos] = assignmentFromSignal(source, match);
    if (next.labels[move.fromPos]) {
      next.labels[move.toPos] = next.labels[move.fromPos];
      delete next.labels[move.fromPos];
    }
  }
  next.activeRemaps = { ...(next.activeRemaps ?? {}), [peripheral]: remapId };
  return { state: next, applied: true, diagnostics: [] };
}

/** Diagnostic describing a failed remap-group move, offered as a one-click fix. */
export function remapGroupFix(
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  remapId: number,
): OneHopFix | null {
  const option = findRemapOption(chip, peripheral, remapId);
  if (!option) return null;
  const remapMoves = planMoves(chip, state, peripheral, option);
  if (remapMoves.length === 0) return null;
  const primary = remapMoves[0];
  const targetPin = chip.pins.find((p) => p.pos === primary.toPos)!;
  return {
    label: `Switch ${peripheral} to ${option.name} (${remapMoves.length} signal${remapMoves.length > 1 ? 's' : ''})`,
    targetPeripheral: peripheral,
    targetSignal: primary.signal,
    targetAf: primary.af,
    targetPos: primary.toPos,
    displacedFromPos: primary.fromPos,
    displacedToPos: primary.toPos,
    displacedPeripheral: peripheral,
    displacedSignal: primary.signal,
    displacedAf: primary.af,
    targetMetadata: {
      ...(primary.funcLabel !== undefined ? { funcLabel: primary.funcLabel } : {}),
      ...(primary.remapId !== undefined ? { remapId: primary.remapId } : {}),
      ...(primary.resourceId !== undefined ? { resourceId: primary.resourceId } : {}),
    },
    remapPeripheral: peripheral,
    remapId,
    remapMoves,
  };
}

function planMoves(
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  option: PeripheralRemapOption,
): RemapMove[] {
  const moves: RemapMove[] = [];
  for (const [signal, pinName] of Object.entries(option.signals)) {
    const sourceEntry = Object.entries(state.assignments).find(
      ([, a]) => a.peripheral === peripheral && a.signal === signal,
    );
    if (!sourceEntry) continue;
    const targetPin = findPinByName(chip, pinName);
    if (
      !targetPin ||
      targetPin.pos === sourceEntry[0] ||
      state.locked[sourceEntry[0]] ||
      state.locked[targetPin.pos]
    ) {
      continue;
    }
    const match = pinSupportsSignal(targetPin, peripheral, signal);
    if (!match) continue;
    moves.push({
      signal: match.signal,
      fromPos: sourceEntry[0],
      toPos: targetPin.pos,
      af: match.af,
      ...muxMetadata(match),
    });
  }
  return moves;
}

export function findOneHopFixForSignal(
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  signal: string,
): OneHopFix | null {
  const signalCounts = computeSignalPinCounts(chip);
  const candidatePins = chip.pins.filter(
    (p) => p.type === 'io' && pinSupportsSignal(p, peripheral, signal) !== null,
  );

  let bestFix: OneHopFix | null = null;
  let bestScore = Infinity;

  for (const targetPin of candidatePins) {
    if (state.locked[targetPin.pos]) continue;
    const blocker = state.assignments[targetPin.pos];
    if (!blocker) continue; // Already free — doesn't need 1-hop fix
    if (blocker.peripheral === peripheral && blocker.signal === signal) continue;
    if (blocker.peripheral === 'GPIO') continue;

    // Can the blocking signal move to a free, unlocked alternate pin?
    const altPins = chip.pins.filter((alt) => {
      if (alt.pos === targetPin.pos || alt.type !== 'io') return false;
      if (state.locked[alt.pos] || state.assignments[alt.pos]) return false;
      return pinSupportsSignal(alt, blocker.peripheral, blocker.signal) !== null;
    });

    if (altPins.length === 0) continue;

    // Pick lowest-scarcity free destination for the displaced signal
    altPins.sort(
      (a, b) =>
        computePinScarcityScore(a, chip, state, signalCounts, blocker.peripheral) -
        computePinScarcityScore(b, chip, state, signalCounts, blocker.peripheral),
    );
    const chosenAlt = altPins[0];
    const targetSig = pinSupportsSignal(targetPin, peripheral, signal)!;
    const altSig = pinSupportsSignal(chosenAlt, blocker.peripheral, blocker.signal)!;

    const score = computePinScarcityScore(chosenAlt, chip, state, signalCounts, blocker.peripheral);
    if (score < bestScore) {
      bestScore = score;
      bestFix = {
        label: `Move ${blocker.peripheral}_${blocker.signal} (${targetPin.name} -> ${chosenAlt.name}) to free ${peripheral}_${signal}`,
        targetPeripheral: peripheral,
        targetSignal: targetSig.signal,
        targetAf: targetSig.af,
        targetPos: targetPin.pos,
        displacedFromPos: targetPin.pos,
        displacedToPos: chosenAlt.pos,
        displacedPeripheral: blocker.peripheral,
        displacedSignal: altSig.signal,
        displacedAf: altSig.af,
        ...(Object.keys(muxMetadata(targetSig)).length > 0
          ? { targetMetadata: muxMetadata(targetSig) }
          : {}),
        ...(Object.keys(muxMetadata(altSig)).length > 0
          ? { displacedMetadata: muxMetadata(altSig) }
          : {}),
      };
    }
  }

  return bestFix;
}

export function applyOneHopFix(state: WorkspaceState, fix: OneHopFix): WorkspaceState {
  const next = cloneWorkspaceState(state);

  if (fix.remapMoves && fix.remapMoves.length > 0) {
    // Atomic group move: rebuild every relocation from the current assignments.
    const moves = fix.remapMoves.map((move) => ({
      move,
      source: next.assignments[move.fromPos],
    }));
    if (moves.some(({ source }) => !source)) return state;
    if (moves.some(({ move }) => next.locked[move.toPos])) return state;
    for (const { move, source } of moves) {
      if (!source) continue;
      delete next.assignments[move.fromPos];
      next.assignments[move.toPos] = {
        ...source,
        signal: move.signal,
        af: move.af,
        ...(move.funcLabel !== undefined ? { funcLabel: move.funcLabel } : {}),
        ...(move.remapId !== undefined ? { remapId: move.remapId } : {}),
        ...(move.resourceId !== undefined ? { resourceId: move.resourceId } : {}),
      };
      if (next.labels[move.fromPos]) {
        next.labels[move.toPos] = next.labels[move.fromPos];
        delete next.labels[move.fromPos];
      }
    }
    if (fix.remapPeripheral && fix.remapId !== undefined) {
      next.activeRemaps = {
        ...(next.activeRemaps ?? {}),
        [fix.remapPeripheral]: fix.remapId,
      };
    }
    return next;
  }

  // Move displaced assignment first
  const displacedLabel = next.labels[fix.displacedFromPos];
  delete next.assignments[fix.displacedFromPos];
  if (displacedLabel) {
    next.labels[fix.displacedToPos] = displacedLabel;
    delete next.labels[fix.displacedFromPos];
  }

  next.assignments[fix.displacedToPos] = {
    ...fix.displacedMetadata,
    peripheral: fix.displacedPeripheral,
    signal: fix.displacedSignal,
    af: fix.displacedAf,
  };

  // Place target assignment on newly freed pin
  next.assignments[fix.targetPos] = {
    ...fix.targetMetadata,
    peripheral: fix.targetPeripheral,
    signal: fix.targetSignal,
    af: fix.targetAf,
  };

  return next;
}

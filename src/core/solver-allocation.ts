/**
 * Scarcity-aware allocation and placement reallocation. Backtracking search
 * is generic and pure; all workspace writes operate on cloned state.
 */

import { cloneWorkspaceState } from './history';
import {
  buildPinGeometryMap,
  isMatrixCandidateLegal,
  matrixElectricalPenalty,
  orderPeripheralsByPlacement,
  placementAffinityForPin,
  type MatrixLegalityContext,
  type PlacementAffinityContext,
} from './placement';
import { getChipMuxModel, isFlexibleRoutingMux } from './types';
import type {
  ChipData,
  OneHopFix,
  PinAssignment,
  PinInfo,
  PinPlacementPreference,
  PinSignal,
  WorkspaceState,
} from './types';
import { getModesForPeripheral, resolveCanonicalSignal } from './solver-modes';
import {
  computePinScarcityScore,
  computeSignalPinCounts,
  pinSupportsSignal,
} from './solver-common';
import { findOneHopFixForSignal } from './solver-remap';

/** One scored option in a pure backtracking search. */
export interface BacktrackingOption<T> {
  key: string; // physical pin position, enforces one assignment per pin
  resource?: string; // optional exclusive hardware channel
  score: number;
  item: T;
}

/** One aligned result of a backtracking search. */
export interface BacktrackingPick<T> {
  signal: string;
  option: BacktrackingOption<T> | null;
}

/** Result of a pure backtracking search over signal groups. */
export interface BacktrackingSearchResult<T> {
  picks: Array<BacktrackingPick<T>>;
  assignedCount: number;
  score: number;
}

/**
 * Shared MRV-ordered backtracking search. Callers order groups by candidate
 * count and supply their own scores; node and branch caps, the partial
 * allocation fallback, and score tie-breaks are identical for every mux model.
 */
export function searchBacktracking<T>(
  groups: readonly { signal: string; options: readonly BacktrackingOption<T>[] }[],
  options: {
    maxNodes?: number;
    branchLimit?: number;
    legal?: (option: BacktrackingOption<T>) => boolean;
  } = {},
): BacktrackingSearchResult<T> {
  const maxNodes = options.maxNodes ?? 2500;
  const branchLimit = options.branchLimit ?? 8;
  const usedKeys = new Set<string>();
  const usedResources = new Set<string>();
  const currentPick: Array<BacktrackingPick<T>> = [];
  let bestCount = -1;
  let bestScore = Infinity;
  let bestPick: Array<BacktrackingPick<T>> = [];
  let nodesVisited = 0;

  function backtrack(idx: number, assignedCount: number, totalScore: number): void {
    if (nodesVisited >= maxNodes) return;
    nodesVisited++;

    const remaining = groups.length - idx;
    if (assignedCount + remaining < bestCount) return;

    if (idx === groups.length) {
      if (assignedCount > bestCount || (assignedCount === bestCount && totalScore < bestScore)) {
        bestCount = assignedCount;
        bestScore = totalScore;
        bestPick = currentPick.map((entry) => ({ ...entry }));
      }
      return;
    }

    const group = groups[idx];
    let triedAny = false;
    const limit = Math.min(group.options.length, branchLimit);
    for (let i = 0; i < limit; i++) {
      const opt = group.options[i];
      if (usedKeys.has(opt.key)) continue;
      if (opt.resource && usedResources.has(opt.resource)) continue;
      if (options.legal && !options.legal(opt)) continue;
      triedAny = true;
      usedKeys.add(opt.key);
      if (opt.resource) usedResources.add(opt.resource);
      currentPick.push({ signal: group.signal, option: opt });
      backtrack(idx + 1, assignedCount + 1, totalScore + opt.score);
      currentPick.pop();
      if (opt.resource) usedResources.delete(opt.resource);
      usedKeys.delete(opt.key);
    }

    if (!triedAny || assignedCount + remaining - 1 >= bestCount) {
      currentPick.push({ signal: group.signal, option: null });
      backtrack(idx + 1, assignedCount, totalScore);
      currentPick.pop();
    }
  }

  backtrack(0, 0, 0);
  return { picks: bestPick, assignedCount: bestCount, score: bestScore };
}

export interface AllocationResult {
  state: WorkspaceState;
  allocated: Array<{ pos: string; signal: string; af: number | null }>;
  unallocated: string[];
  suggestions: OneHopFix[];
}

export function allocatePeripheralMode(
  chip: ChipData,
  state: WorkspaceState,
  peripheralName: string,
  modeId: string,
): AllocationResult {
  const next = cloneWorkspaceState(state);
  const periphInfo = chip.peripherals[peripheralName];

  if (!periphInfo || modeId === 'disabled') {
    // Clear all unlocked pins currently assigned to this peripheral
    for (const [pos, asgn] of Object.entries(next.assignments)) {
      if (asgn.peripheral === peripheralName && !next.locked[pos]) {
        delete next.assignments[pos];
      }
    }
    delete next.peripheralModes[peripheralName];
    return { state: next, allocated: [], unallocated: [], suggestions: [] };
  }

  const modes = getModesForPeripheral(chip, peripheralName);
  const template = modes.find((m) => m.id === modeId);
  if (!template) {
    return { state: next, allocated: [], unallocated: [], suggestions: [] };
  }

  next.peripheralModes[peripheralName] = modeId;

  if (template.isChannelBased) {
    return { state: next, allocated: [], unallocated: [], suggestions: [] };
  }

  const requiredCanonical = template.required
    .map((req) => resolveCanonicalSignal(periphInfo, req))
    .filter((s): s is string => s !== null);

  const allowedCanonical = new Set<string>([
    ...requiredCanonical,
    ...(template.optional ?? [])
      .map((opt) => resolveCanonicalSignal(periphInfo, opt))
      .filter((s): s is string => s !== null),
  ]);

  // Clear unlocked pins of this peripheral whose signals are no longer part of the selected mode
  for (const [pos, asgn] of Object.entries(next.assignments)) {
    if (
      asgn.peripheral === peripheralName &&
      !next.locked[pos] &&
      !allowedCanonical.has(asgn.signal)
    ) {
      delete next.assignments[pos];
    }
  }

  // Determine which required signals are already assigned
  const alreadyAssignedSignals = new Set<string>();
  for (const asgn of Object.values(next.assignments)) {
    if (asgn.peripheral === peripheralName) {
      alreadyAssignedSignals.add(asgn.signal);
    }
  }

  const missingSignals = requiredCanonical.filter((sig) => !alreadyAssignedSignals.has(sig));
  if (missingSignals.length === 0) {
    return { state: next, allocated: [], unallocated: [], suggestions: [] };
  }

  const signalPinCounts = computeSignalPinCounts(chip);

  // Build scored free unlocked candidate list for each missing signal
  interface CandidateOption {
    pin: PinInfo;
    sig: PinSignal;
    score: number;
  }

  const candidatesBySignal: Array<{ signal: string; options: CandidateOption[] }> =
    missingSignals.map((signal) => {
      const options: CandidateOption[] = [];
      for (const pin of chip.pins) {
        if (pin.type !== 'io') continue;
        if (next.locked[pin.pos] || next.assignments[pin.pos]) continue;
        const match = pinSupportsSignal(pin, peripheralName, signal);
        if (!match) continue;
        options.push({
          pin,
          sig: match,
          score: computePinScarcityScore(pin, chip, next, signalPinCounts, peripheralName),
        });
      }
      options.sort((a, b) => a.score - b.score);
      return { signal, options };
    });

  // Order signals with fewest free options first (most constrained variable heuristic)
  candidatesBySignal.sort((a, b) => a.options.length - b.options.length);

  // Backtracking search maximizing assigned count, minimizing total scarcity score
  const search = searchBacktracking(
    candidatesBySignal.map((group) => ({
      signal: group.signal,
      options: group.options.map((opt) => ({
        key: opt.pin.pos,
        score: opt.score,
        item: opt,
      })),
    })),
  );

  const allocated: AllocationResult['allocated'] = [];
  const unallocated: string[] = [];

  for (const item of search.picks) {
    const option = item.option?.item;
    if (option) {
      next.assignments[option.pin.pos] = {
        ...option.sig,
        peripheral: peripheralName,
        signal: option.sig.signal,
        af: option.sig.af,
      };
      allocated.push({
        pos: option.pin.pos,
        signal: option.sig.signal,
        af: option.sig.af,
      });
    } else {
      unallocated.push(item.signal);
    }
  }

  const suggestions: OneHopFix[] = [];
  for (const missingSig of unallocated) {
    const fix = findOneHopFixForSignal(chip, next, peripheralName, missingSig);
    if (fix) suggestions.push(fix);
  }

  return { state: next, allocated, unallocated, suggestions };
}

export function togglePeripheralSignal(
  chip: ChipData,
  state: WorkspaceState,
  peripheralName: string,
  signal: string,
): { state: WorkspaceState; assignedPos: string | null; fix: OneHopFix | null } {
  const next = cloneWorkspaceState(state);

  // If already assigned on an unlocked pin, unassign it
  const existingEntry = Object.entries(next.assignments).find(
    ([, asgn]) => asgn.peripheral === peripheralName && asgn.signal === signal,
  );
  if (existingEntry) {
    const [pos] = existingEntry;
    if (!next.locked[pos]) {
      delete next.assignments[pos];
    }
    return { state: next, assignedPos: null, fix: null };
  }

  // Find lowest-scarcity free unlocked pin supporting (peripheralName, signal)
  const signalPinCounts = computeSignalPinCounts(chip);
  const candidates = chip.pins
    .filter((pin) => {
      if (pin.type !== 'io') return false;
      if (next.locked[pin.pos] || next.assignments[pin.pos]) return false;
      return pinSupportsSignal(pin, peripheralName, signal) !== null;
    })
    .sort(
      (a, b) =>
        computePinScarcityScore(a, chip, next, signalPinCounts, peripheralName) -
        computePinScarcityScore(b, chip, next, signalPinCounts, peripheralName),
    );

  if (candidates.length > 0) {
    const chosen = candidates[0];
    const match = pinSupportsSignal(chosen, peripheralName, signal)!;
    next.assignments[chosen.pos] = {
      ...match,
      peripheral: peripheralName,
      signal: match.signal,
      af: match.af,
    };
    const pInfo = chip.peripherals[peripheralName];
    if (pInfo && !next.peripheralModes[peripheralName]) {
      if (pInfo.kind === 'adc' || pInfo.kind === 'dac') {
        next.peripheralModes[peripheralName] = 'channels';
      } else if (pInfo.kind === 'other') {
        next.peripheralModes[peripheralName] = 'custom';
      }
    }
    return { state: next, assignedPos: chosen.pos, fix: null };
  }

  const fix = findOneHopFixForSignal(chip, next, peripheralName, signal);
  return { state: next, assignedPos: null, fix };
}

/**
 * Reallocate one peripheral after a placement change. Locked pins are never
 * removed or overwritten; their signals count as already satisfied. The
 * remaining signals are placed together by the bounded backtracking search
 * shared with mode and matrix allocation, so one signal can give up a pin that
 * a later signal needs.
 */
export function reallocatePeripheralPlacement(
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  preference?: PinPlacementPreference | null,
  signalNames?: readonly string[],
): WorkspaceState {
  const next = cloneWorkspaceState(state);
  const effectivePreference =
    preference === undefined ? state.placement?.[peripheral] : preference;
  const context: PlacementAffinityContext = {
    preference: effectivePreference,
    geometry: buildPinGeometryMap(chip),
  };
  const signalPinCounts = computeSignalPinCounts(chip);

  /** Assignment and custom label captured before an unlocked pin is released. */
  interface PriorPlacement {
    pos: string;
    assignment: PinAssignment;
    label: string | undefined;
  }

  const satisfied = new Set<string>();
  const signals = new Set<string>(signalNames ?? []);
  const priorBySignal = new Map<string, PriorPlacement>();
  for (const [pos, asgn] of Object.entries(state.assignments)) {
    if (asgn.peripheral !== peripheral) continue;
    if (next.locked[pos]) {
      satisfied.add(asgn.signal);
      continue;
    }
    signals.add(asgn.signal);
    if (!priorBySignal.has(asgn.signal)) {
      priorBySignal.set(asgn.signal, { pos, assignment: asgn, label: state.labels[pos] });
    }
    delete next.assignments[pos];
  }
  if (signals.size === 0) return next;

  interface PlacementCandidate {
    pin: PinInfo;
    sig: PinSignal;
  }

  // One group per unsatisfied signal. Only free, unlocked I/O pins supporting
  // the signal are options; locked pins stay fixed and are never candidates.
  // Scores reuse the existing scarcity plus affinity term without new penalties.
  const groups = [...signals]
    .filter((signal) => !satisfied.has(signal))
    .map((signal) => {
      const options: BacktrackingOption<PlacementCandidate>[] = [];
      for (const pin of chip.pins) {
        if (pin.type !== 'io') continue;
        if (next.locked[pin.pos] || next.assignments[pin.pos]) continue;
        const match = pinSupportsSignal(pin, peripheral, signal);
        if (!match) continue;
        options.push({
          key: pin.pos,
          score: computePinScarcityScore(
            pin,
            chip,
            next,
            signalPinCounts,
            peripheral,
            context,
          ),
          item: { pin, sig: match },
        });
      }
      options.sort(
        (a, b) => a.score - b.score || a.key.localeCompare(b.key, undefined, { numeric: true }),
      );
      return { signal, options };
    })
    .sort(
      (a, b) => a.options.length - b.options.length || a.signal.localeCompare(b.signal),
    );

  const search = searchBacktracking(groups);

  const finalPosBySignal = new Map<string, string>();
  for (const pick of search.picks) {
    const candidate = pick.option?.item;
    if (!candidate) continue;
    finalPosBySignal.set(pick.signal, candidate.pin.pos);
    next.assignments[candidate.pin.pos] = {
      ...candidate.sig,
      peripheral,
      signal: candidate.sig.signal,
      af: candidate.sig.af,
    };
  }
  // A signal with no pick keeps its prior position, assignment, and label.
  for (const [signal, prior] of priorBySignal) {
    if (finalPosBySignal.has(signal)) continue;
    finalPosBySignal.set(signal, prior.pos);
    next.assignments[prior.pos] = prior.assignment;
  }

  // Rebuild labels from the captured values so a moved label never leaves a
  // stale entry behind, including when two assignments exchange pins.
  if (priorBySignal.size > 0) {
    const releasedPos = new Set([...priorBySignal.values()].map((entry) => entry.pos));
    const labels: Record<string, string> = {};
    for (const [pos, label] of Object.entries(state.labels)) {
      if (!releasedPos.has(pos)) labels[pos] = label;
    }
    for (const [signal, prior] of priorBySignal) {
      if (prior.label === undefined) continue;
      labels[finalPosBySignal.get(signal) ?? prior.pos] = prior.label;
    }
    next.labels = labels;
  }

  return next;
}

/**
 * Matrix-aware live reallocation. Uses the shared backtracking search over
 * legality-filtered candidates, treats locked pins as satisfied signals, and
 * ranks survivors by electrical penalty then the unchanged geometry term.
 */
export function reallocateMatrixPlacement(
  chip: ChipData,
  state: WorkspaceState,
  peripheral: string,
  preference?: PinPlacementPreference | null,
  signalNames?: readonly string[],
): WorkspaceState {
  if (!isFlexibleRoutingMux(getChipMuxModel(chip))) {
    return reallocatePeripheralPlacement(chip, state, peripheral, preference, signalNames);
  }

  const next = cloneWorkspaceState(state);
  const effectivePreference = preference === undefined ? state.placement?.[peripheral] : preference;
  const affinityContext: PlacementAffinityContext = {
    preference: effectivePreference,
    geometry: buildPinGeometryMap(chip),
  };
  const signalPinCounts = computeSignalPinCounts(chip);

  const satisfied = new Set<string>();
  const signals = new Set<string>(signalNames ?? []);
  for (const [pos, asgn] of Object.entries(state.assignments)) {
    if (asgn.peripheral !== peripheral) continue;
    if (next.locked[pos]) {
      satisfied.add(asgn.signal);
      continue;
    }
    signals.add(asgn.signal);
    delete next.assignments[pos];
  }
  if (signals.size === 0) return next;

  const usedSignals = new Set<string>();
  const usedResources = new Set<string>();
  const usedPins = new Set<string>();
  for (const [pos, asgn] of Object.entries(next.assignments)) {
    usedPins.add(pos);
    if (asgn.resourceId) usedResources.add(asgn.resourceId);
    if (asgn.peripheral !== 'GPIO') usedSignals.add(`${asgn.peripheral}:${asgn.signal}`);
  }
  for (const signal of satisfied) usedSignals.add(`${peripheral}:${signal}`);

  interface MatrixCandidate {
    pin: PinInfo;
    sig: PinSignal;
  }

  const groups = [...signals]
    .filter((signal) => !satisfied.has(signal))
    .map((signal) => {
      const options: BacktrackingOption<MatrixCandidate>[] = [];
      for (const pin of chip.pins) {
        const legality: MatrixLegalityContext = {
          chip,
          state: next,
          peripheral,
          signal,
          usedSignals,
          usedPins,
          usedResources,
        };
        if (!isMatrixCandidateLegal(pin, legality)) continue;
        const match = pinSupportsSignal(pin, peripheral, signal);
        if (!match) continue;
        const penalty = matrixElectricalPenalty(pin, chip, next, peripheral, signal);
        const affinity = placementAffinityForPin(pin, chip, effectivePreference, affinityContext);
        const scarcity = computePinScarcityScore(
          pin,
          chip,
          next,
          signalPinCounts,
          peripheral,
          affinityContext,
        );
        const score = penalty + affinity + scarcity;
        options.push({
          key: pin.pos,
          resource: match.resourceId,
          score,
          item: { pin, sig: match },
        });
      }
      options.sort(
        (a, b) => a.score - b.score || a.key.localeCompare(b.key, undefined, { numeric: true }),
      );
      return { signal, options };
    })
    .sort(
      (a, b) =>
        a.options.length - b.options.length || a.signal.localeCompare(b.signal),
    );

  const search = searchBacktracking(groups);
  for (const pick of search.picks) {
    const candidate = pick.option?.item;
    if (!candidate) continue;
    next.assignments[candidate.pin.pos] = {
      ...candidate.sig,
      peripheral,
      signal: candidate.sig.signal,
      af: candidate.sig.af,
    };
  }

  return next;
}

/** Reallocate enabled peripherals in strict ring order (high priority first). */
export function reallocatePlacementOrdered(
  chip: ChipData,
  state: WorkspaceState,
  peripherals?: readonly string[],
): WorkspaceState {
  const names =
    peripherals ??
    Array.from(
      new Set([
        ...Object.keys(state.placement ?? {}),
        ...Object.values(state.assignments)
          .map((asgn) => asgn.peripheral)
          .filter((name) => name !== 'GPIO'),
      ]),
    );
  // Clear every unlocked assignment up front so a high-ring peripheral can
  // claim a pin currently held by a low-ring one.
  const signalsByPeripheral = new Map<string, Set<string>>();
  for (const [pos, asgn] of Object.entries(state.assignments)) {
    if (!names.includes(asgn.peripheral)) continue;
    const list = signalsByPeripheral.get(asgn.peripheral) ?? new Set<string>();
    if (state.locked[pos]) list.add(`locked:${asgn.signal}`);
    else list.add(asgn.signal);
    signalsByPeripheral.set(asgn.peripheral, list);
  }
  let next = cloneWorkspaceState(state);
  for (const [peripheral, signals] of signalsByPeripheral) {
    for (const [pos, asgn] of Object.entries(next.assignments)) {
      if (asgn.peripheral === peripheral && !next.locked[pos]) {
        delete next.assignments[pos];
      }
    }
    signalsByPeripheral.set(
      peripheral,
      new Set(Array.from(signals).filter((signal) => !signal.startsWith('locked:'))),
    );
  }
  for (const peripheral of orderPeripheralsByPlacement(names, state)) {
    next = reallocatePeripheralPlacement(
      chip,
      next,
      peripheral,
      state.placement?.[peripheral],
      Array.from(signalsByPeripheral.get(peripheral) ?? []),
    );
  }
  return next;
}

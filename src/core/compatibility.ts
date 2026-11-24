/**
 * Pure pinout compatibility scoring.
 *
 * The signature is derived from a workspace and its chip; candidates are full
 * `ChipData` shards. No Svelte, DOM, or network API is used here so ranking is
 * deterministically testable on the host. Each candidate is evaluated under its
 * own mux model (`af`, `remap-group`, or `funcsel-pio`).
 */

import { getModesForPeripheral } from './solver';
import {
  getChipMuxModel,
  getChipVendor,
  type ChipData,
  type MuxModel,
  type PinType,
  type VendorId,
  type WorkspaceState,
} from './types';

/** Maximum candidates shown by the finder and loaded from catalog shards. */
export const MAX_COMPATIBILITY_RESULTS = 20;
/** Fixed shard-load concurrency used by the finder. */
export const MAX_CONCURRENT_SHARD_LOADS = 4;

export interface SignaturePin {
  name: string;
  type: PinType;
  peripheral: string;
  signal: string;
  af: number | null;
  funcLabel?: string;
  remapId?: number;
  resourceId?: string;
}

export interface CompatibilitySignature {
  mcuId: string;
  vendor: VendorId;
  muxModel: MuxModel;
  flashKb: number | null;
  ramKb: number;
  pins: SignaturePin[];
  powerPins: Array<{ name: string; type: PinType }>;
  requiredSignals: Array<{ peripheral: string; signal: string }>;
}

export type CandidateMatch = 'exact' | 'functional' | 'incompatible';

export interface CandidateScore {
  mcuId: string;
  vendor: VendorId;
  muxModel: MuxModel;
  classification: CandidateMatch;
  exactPinMatches: number;
  functionalMatches: number;
  missingSignals: string[];
  flashDeltaKb: number;
  ramDeltaKb: number;
}

const CANDIDATE_RANK: Record<CandidateMatch, number> = {
  exact: 0,
  functional: 1,
  incompatible: 2,
};

function compareKeys(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * Derive the comparison signature. Labels, locks and cosmetic view state are
 * intentionally ignored; changing an active mode changes `requiredSignals`.
 */
export function deriveCompatibilitySignature(
  chip: ChipData,
  state: WorkspaceState,
): CompatibilitySignature {
  const pins: SignaturePin[] = [];
  for (const [pos, asgn] of Object.entries(state.assignments)) {
    const pin = chip.pins.find((candidate) => candidate.pos === pos);
    if (!pin) continue;
    pins.push({
      name: pin.name,
      type: pin.type,
      peripheral: asgn.peripheral,
      signal: asgn.signal,
      af: asgn.af,
      ...(asgn.funcLabel !== undefined ? { funcLabel: asgn.funcLabel } : {}),
      ...(asgn.remapId !== undefined ? { remapId: asgn.remapId } : {}),
      ...(asgn.resourceId !== undefined ? { resourceId: asgn.resourceId } : {}),
    });
  }
  pins.sort((a, b) => compareKeys(a.name, b.name) || compareKeys(a.signal, b.signal));

  const powerPins = chip.pins
    .filter((pin) => pin.type === 'power' || pin.type === 'reset' || pin.type === 'boot')
    .map((pin) => ({ name: pin.name, type: pin.type }))
    .sort((a, b) => compareKeys(a.name, b.name));

  const required: Array<{ peripheral: string; signal: string }> = [];
  for (const [peripheral, modeId] of Object.entries(state.peripheralModes)) {
    if (!modeId || modeId === 'disabled') continue;
    const template = getModesForPeripheral(chip, peripheral).find((mode) => mode.id === modeId);
    for (const signal of template?.required ?? []) required.push({ peripheral, signal });
  }
  required.sort((a, b) => compareKeys(a.peripheral, b.peripheral) || compareKeys(a.signal, b.signal));

  return {
    mcuId: chip.id,
    vendor: getChipVendor(chip),
    muxModel: getChipMuxModel(chip),
    flashKb: chip.flashKb,
    ramKb: chip.ramKb,
    pins,
    powerPins,
    requiredSignals: required,
  };
}

/** Deterministic equality over canonical signature arrays. */
export function signaturesEqual(a: CompatibilitySignature, b: CompatibilitySignature): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Whether a candidate can host a signal on a named pin. Direct pin signals are
 * checked first; CH32 remap groups are consulted as a second source of truth.
 */
export function candidateSupportsSignal(
  chip: ChipData,
  pinName: string,
  peripheral: string,
  signal: string,
): boolean {
  const pin = chip.pins.find((candidate) => candidate.name === pinName);
  if (!pin) return false;
  if (pin.signals.some((sig) => sig.peripheral === peripheral && sig.signal === signal)) {
    return true;
  }
  for (const remap of chip.peripherals[peripheral]?.remaps ?? []) {
    if (remap.signals[signal] === pinName) return true;
  }
  return false;
}

/** A shard without pin-level signal data cannot be scored meaningfully. */
export function isCandidateScorable(chip: ChipData): boolean {
  return chip.pins.length > 0 && chip.pins.some((pin) => pin.signals.length > 0);
}

/** Score one candidate; cross-vendor parts are evaluated under their own mux. */
export function scoreCandidate(
  signature: CompatibilitySignature,
  chip: ChipData,
): CandidateScore {
  let exactPinMatches = 0;
  let functionalMatches = 0;
  const missingSignals = new Set<string>();

  for (const item of signature.pins) {
    const samePin = chip.pins.find(
      (pin) => pin.name === item.name && pin.type === item.type,
    );
    if (samePin && candidateSupportsSignal(chip, item.name, item.peripheral, item.signal)) {
      exactPinMatches += 1;
      continue;
    }
    const anywhere = chip.pins.some((pin) =>
      candidateSupportsSignal(chip, pin.name, item.peripheral, item.signal),
    );
    if (anywhere) {
      functionalMatches += 1;
    } else {
      missingSignals.add(`${item.peripheral}:${item.signal}`);
    }
  }

  for (const required of signature.requiredSignals) {
    const supported = chip.pins.some((pin) =>
      candidateSupportsSignal(chip, pin.name, required.peripheral, required.signal),
    );
    if (!supported) missingSignals.add(`${required.peripheral}:${required.signal}`);
  }

  const classification: CandidateMatch =
    missingSignals.size > 0
      ? 'incompatible'
      : signature.pins.length > 0 && exactPinMatches === signature.pins.length
        ? 'exact'
        : 'functional';

  return {
    mcuId: chip.id,
    vendor: getChipVendor(chip),
    muxModel: getChipMuxModel(chip),
    classification,
    exactPinMatches,
    functionalMatches,
    missingSignals: Array.from(missingSignals).sort(compareKeys),
    flashDeltaKb: (chip.flashKb ?? 0) - (signature.flashKb ?? 0),
    ramDeltaKb: chip.ramKb - signature.ramKb,
  };
}

/** Exact matches first, then the smallest memory delta, then a stable ID sort. */
export function compareCandidateScores(a: CandidateScore, b: CandidateScore): number {
  const rank = CANDIDATE_RANK[a.classification] - CANDIDATE_RANK[b.classification];
  if (rank !== 0) return rank;
  const aDelta = Math.abs(a.flashDeltaKb) + Math.abs(a.ramDeltaKb);
  const bDelta = Math.abs(b.flashDeltaKb) + Math.abs(b.ramDeltaKb);
  if (aDelta !== bDelta) return aDelta - bDelta;
  return compareKeys(a.mcuId, b.mcuId);
}

/**
 * Run an async worker with bounded concurrency. A cancellation predicate stops
 * new work and discards late results; the caller checks its own generation
 * token before applying anything. Kept pure so the concurrency contract can be
 * tested with an instrumented worker on the host.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  isCancelled: () => boolean = () => false,
): Promise<R[]> {
  const results: R[] = [];
  if (items.length === 0) return results;
  const max = Math.max(1, Math.floor(limit));
  let next = 0;
  let active = 0;

  return new Promise<R[]>((resolve) => {
    const settle = (): void => {
      if (active === 0 && (next >= items.length || isCancelled())) resolve(results);
    };
    const pump = (): void => {
      while (!isCancelled() && active < max && next < items.length) {
        const item = items[next++];
        active += 1;
        Promise.resolve()
          .then(() => worker(item))
          .then(
            (value) => {
              if (!isCancelled()) results.push(value);
            },
            () => {
              // Per-item failures are reported by the caller's worker wrapper.
            },
          )
          .finally(() => {
            active -= 1;
            pump();
            settle();
          });
      }
      settle();
    };
    pump();
  });
}

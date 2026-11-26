/**
 * Pure pin and assignment helpers shared by every solver phase. Pin lookup,
 * debug and clock detection, mux metadata, signal counts, and scarcity scoring
 * live here so remapping, allocation, and diagnostics use one definition.
 */

import {
  placementAffinityForPin,
  type PlacementAffinityContext,
} from './placement';
import type {
  ChipData,
  PinAssignment,
  PinInfo,
  PinSignal,
  PinTag,
  WorkspaceState,
} from './types';
import { getChipMuxModel, isFlexibleRoutingMux } from './types';
import { SIGNAL_ALIASES } from './solver-modes';

export function createEmptyWorkspace(mcuId: string): WorkspaceState {
  return {
    mcuId,
    assignments: {},
    labels: {},
    locked: {},
    peripheralModes: {},
  };
}

/** Look up an emitted pin signal, including the existing signal aliases. */
function findPinSignal(pin: PinInfo, peripheral: string, signal: string): PinSignal | null {
  const exact = pin.signals.find(
    (s) => s.peripheral === peripheral && s.signal === signal,
  );
  if (exact) return exact;

  const aliases = SIGNAL_ALIASES[signal];
  if (aliases) {
    for (const alias of aliases) {
      const match = pin.signals.find(
        (s) => s.peripheral === peripheral && s.signal === alias,
      );
      if (match) return match;
    }
  }
  return null;
}

/**
 * Resolve whether a pin supports a requested role. Pins tagged `input-only`
 * reject output roles; allocation, remapping, one-hop fixes, and alternate
 * discovery all share this gate.
 */
export function pinSupportsSignal(
  pin: PinInfo,
  peripheral: string,
  signal: string,
): PinSignal | null {
  const match =
    peripheral === 'GPIO'
      ? pin.type === 'io'
        ? { peripheral: 'GPIO', signal, af: null }
        : null
      : findPinSignal(pin, peripheral, signal);
  if (!match) return null;

  if (pinHasTag(pin, 'input-only')) {
    const drives =
      peripheral === 'GPIO' ? signal === 'Output' : match.direction === 'output';
    if (drives) return null;
  }
  return match;
}

export function buildPinMap(chip: ChipData): Map<string, PinInfo> {
  const map = new Map<string, PinInfo>();
  for (const pin of chip.pins) {
    map.set(pin.pos, pin);
  }
  return map;
}

const DEBUG_PERIPHERALS = new Set(['SYS', 'DEBUG', 'SDI']);
const DEBUG_SIGNAL_RE = /SWDIO|SWCLK|SWD|JTMS|JTCK|SWIO/;

export function pinHasTag(pin: PinInfo, tag: PinTag): boolean {
  return Boolean(pin.tags?.includes(tag));
}

/** True when a signal is a debug-port role, independent of the vendor's pin naming. */
function isDebugSignalRole(signal: PinSignal): boolean {
  return DEBUG_PERIPHERALS.has(signal.peripheral) && DEBUG_SIGNAL_RE.test(signal.signal);
}

/**
 * Debug-pin detection driven by emitted tags first, then by signal roles.
 * Signal-role fallback covers STM32 shards that carry no tags; no hardcoded
 * STM32 pin names are used.
 */
export function isDebugPin(pin: PinInfo): PinTag | null {
  if (pinHasTag(pin, 'debug-swd')) return 'debug-swd';
  if (pinHasTag(pin, 'debug-sdi')) return 'debug-sdi';
  return pin.signals.some(isDebugSignalRole) ? 'debug-swd' : null;
}

export function isDebugAssignment(asgn: PinAssignment): boolean {
  return DEBUG_PERIPHERALS.has(asgn.peripheral) && DEBUG_SIGNAL_RE.test(asgn.signal);
}

/** High-speed external clock roles, derived from signal names rather than RCC mode strings. */
export function clockRoleForPin(pin: PinInfo): 'OSC_IN' | 'OSC_OUT' | null {
  for (const s of pin.signals) {
    if (s.signal === 'OSC_IN' || s.signal === 'OSC_OUT') return s.signal;
  }
  return null;
}

export function isClockAssignment(asgn: PinAssignment): boolean {
  return asgn.signal === 'OSC_IN' || asgn.signal === 'OSC_OUT';
}

/**
 * Build an assignment from a pin signal without dropping vendor mux metadata.
 * A matching signal's metadata wins; otherwise the source metadata is kept.
 */
export function assignmentFromSignal(source: PinAssignment, match: PinSignal): PinAssignment {
  return {
    ...source,
    signal: match.signal,
    af: match.af,
    ...(match.funcLabel !== undefined ? { funcLabel: match.funcLabel } : {}),
    ...(match.remapId !== undefined ? { remapId: match.remapId } : {}),
    ...(match.resourceId !== undefined ? { resourceId: match.resourceId } : {}),
  };
}

/** Optional mux metadata of a pin signal, used to enrich one-hop fixes. */
export function muxMetadata(signal: PinSignal): Partial<PinAssignment> {
  return {
    ...(signal.funcLabel !== undefined ? { funcLabel: signal.funcLabel } : {}),
    ...(signal.remapId !== undefined ? { remapId: signal.remapId } : {}),
    ...(signal.resourceId !== undefined ? { resourceId: signal.resourceId } : {}),
  };
}

/** Locate an emitted pin by its display name (bonded pins may list several names). */
export function findPinByName(chip: ChipData, name: string): PinInfo | undefined {
  const normalized = name.trim();
  return chip.pins.find(
    (pin) =>
      pin.name === normalized ||
      pin.name.split(/\s*\/\s*/).some((part) => part.trim() === normalized),
  );
}

/** GPIO number encoded in an RP pin name (e.g. "GPIO16" -> 16). */
export function gpioNumber(pin: PinInfo): number | null {
  const match = pin.name.match(/GPIO(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function computeSignalPinCounts(chip: ChipData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pin of chip.pins) {
    if (pin.type !== 'io') continue;
    const seen = new Set<string>();
    for (const sig of pin.signals) {
      const key = `${sig.peripheral}:${sig.signal}`;
      if (!seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** True when chip data marks any signal of a peripheral as timing-critical. */
function hasSpeedCriticalSignal(chip: ChipData, peripheral: string): boolean {
  return chip.pins.some((pin) =>
    pin.signals.some((sig) => sig.peripheral === peripheral && sig.speedCritical === true),
  );
}

/**
 * Scarcity score for one candidate pin. The optional placement context adds a
 * term that is exactly zero when no preference is enabled, so the default
 * allocator path keeps its original scores and assignments. Electrical penalty
 * terms apply to every flexible-routing mux (`gpio-matrix` and `psel`) and are
 * zero for vendors without the corresponding derived tags. Direct-route timing
 * remains specific to `gpio-matrix`.
 */
export function computePinScarcityScore(
  pin: PinInfo,
  chip: ChipData,
  state: WorkspaceState,
  signalPinCounts: Map<string, number>,
  targetPeripheral: string,
  affinity?: PlacementAffinityContext | null,
): number {
  let score = 0;

  // Strongly preserve debug pins unless allocating a debug peripheral
  if (
    !DEBUG_PERIPHERALS.has(targetPeripheral) &&
    isDebugPin(pin) !== null
  ) {
    score += 120;
  }

  // Strongly preserve clock pins unless allocating a clock peripheral
  if (targetPeripheral !== 'RCC' && targetPeripheral !== 'OSC' && clockRoleForPin(pin) !== null) {
    score += 90;
  }

  // Build set of currently allocated (peripheral, signal) pairs
  const allocated = new Set<string>();
  for (const asgn of Object.values(state.assignments)) {
    if (asgn.peripheral !== 'GPIO') {
      allocated.add(`${asgn.peripheral}:${asgn.signal}`);
    }
  }

  for (const sig of pin.signals) {
    if (sig.peripheral === targetPeripheral) continue;
    const key = `${sig.peripheral}:${sig.signal}`;
    if (allocated.has(key)) continue;

    const pInfo = chip.peripherals[sig.peripheral];
    const alternatives = signalPinCounts.get(key) ?? 1;

    // Preserve scarce USB DM/DP pins
    if (pInfo?.kind === 'usb' && (sig.signal.includes('DM') || sig.signal.includes('DP'))) {
      score += 65;
    } else if (alternatives === 1) {
      // Unique pin for an unallocated peripheral signal
      score += 18;
    } else if (alternatives === 2) {
      score += 8;
    } else {
      score += 2;
    }
  }

  // Minor tie-breaker favoring fewer total alternate functions
  score += pin.signals.length * 0.5;

  const preference = affinity ? affinity.preference : state.placement?.[targetPeripheral];
  score += placementAffinityForPin(pin, chip, preference, affinity ?? {});

  const muxModel = getChipMuxModel(chip);
  if (muxModel === 'gpio-matrix' && hasSpeedCriticalSignal(chip, targetPeripheral)) {
    // Speed-critical routes prefer the direct IO_MUX path over the matrix.
    const direct = pin.signals.some(
      (sig) => sig.peripheral === targetPeripheral && sig.directRoute === true,
    );
    score += direct ? -12 : 6;
  }
  if (isFlexibleRoutingMux(muxModel)) {
    // Penalties fire only for tags declared by the acquired source data.
    if (pinHasTag(pin, 'strapping')) score += 18;
    if (pinHasTag(pin, 'input-only')) score += 30;
    if (pinHasTag(pin, 'cap-restricted')) score += 12;
    if (pinHasTag(pin, 'flash') || pinHasTag(pin, 'psram')) score += 22;
  }
  return score;
}

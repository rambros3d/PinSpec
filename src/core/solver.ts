import { cloneWorkspaceState } from './history';
import {
  buildPinGeometryMap,
  orderPeripheralsByPlacement,
  placementAffinityForPin,
  type PlacementAffinityContext,
} from './placement';
import type {
  AlternatePinCandidate,
  ChipData,
  DiagnosticItem,
  DmaAnalysisEntry,
  MuxModel,
  OneHopFix,
  PeripheralInfo,
  PeripheralKind,
  PeripheralModeTemplate,
  PeripheralRemapOption,
  PeripheralStatus,
  PinAssignment,
  PinPlacementPreference,
  PinInfo,
  PinSignal,
  PinTag,
  PinVisualStatus,
  RemapMove,
  SolverReport,
  WorkspaceState,
} from './types';
import { formatMuxLabel, getChipMuxModel } from './types';

export const PERIPHERAL_MODE_TEMPLATES: Record<PeripheralKind, PeripheralModeTemplate[]> = {
  spi: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'full_duplex', label: 'Full-Duplex Master', required: ['SCK', 'MISO', 'MOSI'], optional: ['NSS'] },
    { id: 'half_duplex', label: 'Half-Duplex', required: ['SCK', 'MOSI'], optional: ['NSS'] },
    { id: 'rx_only', label: 'Receive Only', required: ['SCK', 'MISO'], optional: ['NSS'] },
  ],
  i2c: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'i2c', label: 'I2C', required: ['SCL', 'SDA'], optional: ['SMBA'] },
  ],
  usart: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'async', label: 'Asynchronous', required: ['TX', 'RX'] },
    { id: 'async_hw_flow', label: 'Async + HW Flow Control', required: ['TX', 'RX', 'CTS', 'RTS'] },
    { id: 'sync', label: 'Synchronous', required: ['TX', 'RX', 'CK'] },
    { id: 'half_duplex', label: 'Single-Wire Half-Duplex', required: ['TX'] },
  ],
  can: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'normal', label: 'Normal', required: ['RX', 'TX'] },
  ],
  usb: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'device_fs', label: 'Device (FS)', required: ['DM', 'DP'], optional: ['VBUS', 'ID', 'SOF'] },
  ],
  tim: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'pwm_1ch', label: 'PWM 1-Channel', required: ['CH1'] },
    { id: 'pwm_2ch', label: 'PWM 2-Channel', required: ['CH1', 'CH2'] },
    { id: 'pwm_3ch', label: 'PWM 3-Channel', required: ['CH1', 'CH2', 'CH3'] },
    { id: 'pwm_4ch', label: 'PWM 4-Channel', required: ['CH1', 'CH2', 'CH3', 'CH4'] },
    {
      id: 'pwm_3phase_comp',
      label: '3-Phase Complementary PWM',
      required: ['CH1', 'CH1N', 'CH2', 'CH2N', 'CH3', 'CH3N'],
      optional: ['BKIN', 'BKIN2'],
    },
    { id: 'encoder', label: 'Encoder Interface', required: ['CH1', 'CH2'] },
  ],
  adc: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'channels', label: 'Individual Channels', required: [], isChannelBased: true },
  ],
  dac: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'channels', label: 'Individual Channels', required: [], isChannelBased: true },
  ],
  sys: [
    { id: 'disabled', label: 'Disabled', required: [] },
    { id: 'swd', label: 'Serial Wire Debug (SWD)', required: ['SWDIO', 'SWCLK'] },
    { id: 'jtag', label: 'JTAG (5-Pin)', required: ['JTMS', 'JTCK', 'JTDI', 'JTDO', 'NJTRST'] },
  ],
  // Forward-looking kinds scaffolded for multi-vendor data (RP PWM slices /
  // PIO). No current chip emits them, but the map must stay exhaustive so
  // PeripheralKind remains a closed, type-safe set.
  pwm: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'channels', label: 'Individual Channels', required: [], isChannelBased: true },
  ],
  pio: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'custom', label: 'Manual Signals', required: [], isChannelBased: true },
  ],
  other: [
    { id: 'disabled', label: 'Disabled', required: [], isChannelBased: true },
    { id: 'custom', label: 'Manual Signals', required: [], isChannelBased: true },
  ],
};

const RCC_MODES: PeripheralModeTemplate[] = [
  { id: 'disabled', label: 'Internal RC (HSI)', required: [] },
  { id: 'hse', label: 'High Speed Clock (HSE)', required: ['OSC_IN', 'OSC_OUT'] },
  { id: 'lse', label: 'Low Speed Clock (LSE)', required: ['OSC32_IN', 'OSC32_OUT'] },
  { id: 'hse_lse', label: 'HSE + LSE', required: ['OSC_IN', 'OSC_OUT', 'OSC32_IN', 'OSC32_OUT'] },
];

const SIGNAL_ALIASES: Record<string, string[]> = {
  SWDIO: ['SWDIO', 'JTMS-SWDIO', 'JTMS'],
  SWCLK: ['SWCLK', 'JTCK-SWCLK', 'JTCK'],
  JTMS: ['JTMS', 'JTMS-SWDIO'],
  JTCK: ['JTCK', 'JTCK-SWCLK'],
  JTDO: ['JTDO', 'JTDO-SWO'],
  DM: ['DM', 'FS_DM', 'HS_DM', 'USB_DM'],
  DP: ['DP', 'FS_DP', 'HS_DP', 'USB_DP'],
  VBUS: ['VBUS', 'FS_VBUS', 'HS_VBUS'],
  ID: ['ID', 'FS_ID', 'HS_ID'],
  SOF: ['SOF', 'FS_SOF', 'HS_SOF'],
  RTS: ['RTS', 'DE', 'RTS_DE'],
};

export function createEmptyWorkspace(mcuId: string): WorkspaceState {
  return {
    mcuId,
    assignments: {},
    labels: {},
    locked: {},
    peripheralModes: {},
  };
}

export function getModesForPeripheral(
  chip: ChipData,
  peripheralName: string,
): PeripheralModeTemplate[] {
  const info = chip.peripherals[peripheralName];
  if (!info) return PERIPHERAL_MODE_TEMPLATES.other;

  if (peripheralName === 'RCC') {
    return RCC_MODES.filter((mode) => {
      if (mode.id === 'disabled') return true;
      return mode.required.every((sig) => resolveCanonicalSignal(info, sig) !== null);
    });
  }

  const baseTemplates = PERIPHERAL_MODE_TEMPLATES[info.kind] ?? PERIPHERAL_MODE_TEMPLATES.other;
  if (info.kind === 'adc' || info.kind === 'dac' || info.kind === 'other') {
    return baseTemplates;
  }

  return baseTemplates.filter((mode) => {
    if (mode.id === 'disabled') return true;
    return mode.required.every((req) => resolveCanonicalSignal(info, req) !== null);
  });
}

export function resolveCanonicalSignal(
  info: PeripheralInfo,
  requestedSignal: string,
): string | null {
  if (info.signals.includes(requestedSignal)) {
    return requestedSignal;
  }
  const aliases = SIGNAL_ALIASES[requestedSignal];
  if (aliases) {
    for (const alias of aliases) {
      if (info.signals.includes(alias)) return alias;
    }
  }
  // Check suffix match (e.g. "FS_DM" for "DM")
  const suffixMatch = info.signals.find((s) => s.endsWith(`_${requestedSignal}`));
  if (suffixMatch) return suffixMatch;
  return null;
}

export function pinSupportsSignal(
  pin: PinInfo,
  peripheral: string,
  signal: string,
): PinSignal | null {
  if (peripheral === 'GPIO') {
    return pin.type === 'io' ? { peripheral: 'GPIO', signal, af: null } : null;
  }
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

function buildPinMap(chip: ChipData): Map<string, PinInfo> {
  const map = new Map<string, PinInfo>();
  for (const pin of chip.pins) {
    map.set(pin.pos, pin);
  }
  return map;
}

const DEBUG_PERIPHERALS = new Set(['SYS', 'DEBUG', 'SDI']);
const DEBUG_SIGNAL_RE = /SWDIO|SWCLK|SWD|JTMS|JTCK|SWIO/;

function pinHasTag(pin: PinInfo, tag: PinTag): boolean {
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
function isDebugPin(pin: PinInfo): PinTag | null {
  if (pinHasTag(pin, 'debug-swd')) return 'debug-swd';
  if (pinHasTag(pin, 'debug-sdi')) return 'debug-sdi';
  return pin.signals.some(isDebugSignalRole) ? 'debug-swd' : null;
}

function isDebugAssignment(asgn: PinAssignment): boolean {
  return DEBUG_PERIPHERALS.has(asgn.peripheral) && DEBUG_SIGNAL_RE.test(asgn.signal);
}

/** High-speed external clock roles, derived from signal names rather than RCC mode strings. */
function clockRoleForPin(pin: PinInfo): 'OSC_IN' | 'OSC_OUT' | null {
  for (const s of pin.signals) {
    if (s.signal === 'OSC_IN' || s.signal === 'OSC_OUT') return s.signal;
  }
  return null;
}

function isClockAssignment(asgn: PinAssignment): boolean {
  return asgn.signal === 'OSC_IN' || asgn.signal === 'OSC_OUT';
}

/**
 * Build an assignment from a pin signal without dropping vendor mux metadata.
 * A matching signal's metadata wins; otherwise the source metadata is kept.
 */
function assignmentFromSignal(source: PinAssignment, match: PinSignal): PinAssignment {
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
function muxMetadata(signal: PinSignal): Partial<PinAssignment> {
  return {
    ...(signal.funcLabel !== undefined ? { funcLabel: signal.funcLabel } : {}),
    ...(signal.remapId !== undefined ? { remapId: signal.remapId } : {}),
    ...(signal.resourceId !== undefined ? { resourceId: signal.resourceId } : {}),
  };
}

/** Locate an emitted pin by its display name (bonded pins may list several names). */
function findPinByName(chip: ChipData, name: string): PinInfo | undefined {
  const normalized = name.trim();
  return chip.pins.find(
    (pin) =>
      pin.name === normalized ||
      pin.name.split(/\s*\/\s*/).some((part) => part.trim() === normalized),
  );
}

/** GPIO number encoded in an RP pin name (e.g. "GPIO16" -> 16). */
function gpioNumber(pin: PinInfo): number | null {
  const match = pin.name.match(/GPIO(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function computeSignalPinCounts(chip: ChipData): Map<string, number> {
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

/**
 * Scarcity score for one candidate pin. The optional placement context adds a
 * term that is exactly zero when no preference is enabled, so the default
 * allocator path keeps its original scores and assignments.
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
  return score;
}

export function findAlternatePins(
  chip: ChipData,
  state: WorkspaceState,
  pos: string,
): AlternatePinCandidate[] {
  const current = state.assignments[pos];
  if (!current || current.peripheral === 'GPIO') return [];

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

  return candidates.sort((a, b) => {
    const rank = { free: 0, occupied: 1, locked: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.pinName.localeCompare(b.pinName, undefined, { numeric: true });
  });
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

function findRemapOption(
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
          score: computePinScarcityScore(pin, chip, next, signalCountsOrMap(signalPinCounts), peripheralName),
        });
      }
      options.sort((a, b) => a.score - b.score);
      return { signal, options };
    });

  // Order signals with fewest free options first (most constrained variable heuristic)
  candidatesBySignal.sort((a, b) => a.options.length - b.options.length);

  // Backtracking search maximizing assigned count, minimizing total scarcity score
  const usedPins = new Set<string>();
  const currentPick: Array<{ signal: string; option: CandidateOption | null }> = [];
  let bestCount = -1;
  let bestScore = Infinity;
  let bestPick: Array<{ signal: string; option: CandidateOption | null }> = [];
  let nodesVisited = 0;
  const MAX_NODES = 2500;

  function backtrack(idx: number, assignedCount: number, totalScore: number): void {
    if (nodesVisited >= MAX_NODES) return;
    nodesVisited++;

    const remaining = candidatesBySignal.length - idx;
    if (assignedCount + remaining < bestCount) return;

    if (idx === candidatesBySignal.length) {
      if (
        assignedCount > bestCount ||
        (assignedCount === bestCount && totalScore < bestScore)
      ) {
        bestCount = assignedCount;
        bestScore = totalScore;
        bestPick = currentPick.map((entry) => ({ ...entry }));
      }
      return;
    }

    const { signal, options } = candidatesBySignal[idx];
    let triedAny = false;
    // Limit branching factor to top 8 best-scored pins for speed on high-pin-count BGAs
    const limit = Math.min(options.length, 8);
    for (let i = 0; i < limit; i++) {
      const opt = options[i];
      if (usedPins.has(opt.pin.pos)) continue;
      triedAny = true;
      usedPins.add(opt.pin.pos);
      currentPick.push({ signal, option: opt });
      backtrack(idx + 1, assignedCount + 1, totalScore + opt.score);
      currentPick.pop();
      usedPins.delete(opt.pin.pos);
    }

    // Allow skipping this signal if no option worked (partial allocation)
    if (!triedAny || assignedCount + remaining - 1 >= bestCount) {
      currentPick.push({ signal, option: null });
      backtrack(idx + 1, assignedCount, totalScore);
      currentPick.pop();
    }
  }

  backtrack(0, 0, 0);

  const allocated: AllocationResult['allocated'] = [];
  const unallocated: string[] = [];

  for (const item of bestPick) {
    if (item.option) {
      next.assignments[item.option.pin.pos] = {
        ...item.option.sig,
        peripheral: peripheralName,
        signal: item.option.sig.signal,
        af: item.option.sig.af,
      };
      allocated.push({
        pos: item.option.pin.pos,
        signal: item.option.sig.signal,
        af: item.option.sig.af,
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

function signalCountsOrMap(m: Map<string, number>): Map<string, number> {
  return m;
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
 * removed or overwritten; their signals count as already satisfied.
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

  const signalOrder = [...signals].sort((a, b) => {
    const countA = chip.pins.filter(
      (p) => p.type === 'io' && pinSupportsSignal(p, peripheral, a) !== null,
    ).length;
    const countB = chip.pins.filter(
      (p) => p.type === 'io' && pinSupportsSignal(p, peripheral, b) !== null,
    ).length;
    return countA - countB || a.localeCompare(b);
  });

  for (const signal of signalOrder) {
    if (satisfied.has(signal)) continue;
    const candidates = chip.pins.filter(
      (pin) =>
        pin.type === 'io' &&
        !next.locked[pin.pos] &&
        !next.assignments[pin.pos] &&
        pinSupportsSignal(pin, peripheral, signal) !== null,
    );
    candidates.sort(
      (a, b) =>
        computePinScarcityScore(a, chip, next, signalPinCounts, peripheral, context) -
          computePinScarcityScore(b, chip, next, signalPinCounts, peripheral, context) ||
        a.pos.localeCompare(b.pos, undefined, { numeric: true }),
    );
    const chosen = candidates[0];
    if (!chosen) continue;
    const match = pinSupportsSignal(chosen, peripheral, signal)!;
    next.assignments[chosen.pos] = {
      ...match,
      peripheral,
      signal: match.signal,
      af: match.af,
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

function analyzeDma(
  chip: ChipData,
  state: WorkspaceState,
): { entries: DmaAnalysisEntry[]; diagnostics: DiagnosticItem[] } {
  const activePeripherals = new Set<string>();
  for (const asgn of Object.values(state.assignments)) {
    if (asgn.peripheral !== 'GPIO') {
      activePeripherals.add(asgn.peripheral);
    }
  }
  for (const [periph, mode] of Object.entries(state.peripheralModes)) {
    if (mode && mode !== 'disabled') {
      activePeripherals.add(periph);
    }
  }

  interface ActiveDmaReq {
    key: string;
    peripheral: string;
    signal: string;
    channels: string[];
    isMuxed: boolean;
  }

  const activeReqs: ActiveDmaReq[] = [];
  for (const periph of Array.from(activePeripherals).sort()) {
    const info = chip.peripherals[periph];
    if (!info?.dma || info.dma.length === 0) continue;

    for (const d of info.dma) {
      if (!d.channels || d.channels.length === 0) continue;
      // Treat DMAMUX / GPDMA / BDMA wide pools (>= 6 channels or explicitly containing MUX/GPDMA) as muxed
      const isMuxed =
        d.channels.length >= 6 ||
        d.channels.some((c) => c.includes('DMAMUX') || c.includes('GPDMA') || c.includes('LPDMA'));
      activeReqs.push({
        key: `${periph}_${d.signal}`,
        peripheral: periph,
        signal: d.signal,
        channels: d.channels,
        isMuxed,
      });
    }
  }

  // Build channel -> list of fixed (non-muxed) requests using that channel
  const channelOwners = new Map<string, ActiveDmaReq[]>();
  for (const req of activeReqs) {
    if (req.isMuxed) continue;
    for (const ch of req.channels) {
      const list = channelOwners.get(ch) ?? [];
      list.push(req);
      channelOwners.set(ch, list);
    }
  }

  const entries: DmaAnalysisEntry[] = [];
  const diagnostics: DiagnosticItem[] = [];
  const reportedContentionPairs = new Set<string>();

  for (const req of activeReqs) {
    if (req.isMuxed) {
      entries.push({
        peripheral: req.peripheral,
        signal: req.signal,
        channels: req.channels,
        isMuxed: true,
        contendingWith: [],
        status: 'ok',
      });
      continue;
    }

    const contendingSet = new Set<string>();
    let hasUncontestedChannel = false;

    for (const ch of req.channels) {
      const owners = (channelOwners.get(ch) ?? []).filter(
        (o) => o.peripheral !== req.peripheral,
      );
      if (owners.length === 0) {
        hasUncontestedChannel = true;
      } else {
        for (const o of owners) {
          contendingSet.add(o.key);
        }
      }
    }

    const contendingWith = Array.from(contendingSet).sort();
    let status: DmaAnalysisEntry['status'] = 'ok';
    if (contendingWith.length > 0 && !hasUncontestedChannel) {
      status = 'contention';
      const pairKey = [req.key, ...contendingWith].sort().join('|');
      if (!reportedContentionPairs.has(pairKey)) {
        reportedContentionPairs.add(pairKey);
        diagnostics.push({
          id: `dma:${pairKey}`,
          severity: 'warning',
          code: 'DMA_CONTENTION',
          peripheral: req.peripheral,
          pins: Object.entries(state.assignments)
            .filter(([, a]) => a.peripheral === req.peripheral)
            .map(([pos]) => pos),
          message: `DMA contention: ${req.key} shares fixed channel (${req.channels.join(', ')}) with ${contendingWith.join(', ')} with no uncontested alternative.`,
        });
      }
    } else if (contendingWith.length > 0) {
      status = 'shared';
    }

    entries.push({
      peripheral: req.peripheral,
      signal: req.signal,
      channels: req.channels,
      isMuxed: false,
      contendingWith,
      status,
    });
  }

  return { entries, diagnostics };
}

/** Group active assignments by shared hardware resource (RP PWM slices, EXTI, etc.). */
function analyzeResourceConflicts(
  state: WorkspaceState,
  pinMap: Map<string, PinInfo>,
): DiagnosticItem[] {
  const byResource = new Map<string, string[]>();
  for (const [pos, asgn] of Object.entries(state.assignments)) {
    const resourceId = asgn.resourceId?.trim();
    if (!resourceId) continue;
    const positions = byResource.get(resourceId) ?? [];
    positions.push(pos);
    byResource.set(resourceId, positions);
  }

  const diagnostics: DiagnosticItem[] = [];
  for (const [resourceId, positions] of byResource) {
    const unique = Array.from(new Set(positions)).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (unique.length < 2) continue;
    const names = unique.map((pos) => `${pinMap.get(pos)?.name ?? pos} (${pos})`).join(', ');
    diagnostics.push({
      id: `resource:${resourceId}`,
      severity: 'error',
      code: 'RESOURCE_CONFLICT',
      pins: unique,
      peripheral: state.assignments[unique[0]]?.peripheral,
      message: `Shared hardware resource ${resourceId} is activated by multiple pins: ${names}.`,
    });
  }

  return diagnostics;
}

/**
 * Derive the hardware EXTI line id from a GPIO pin name. ST and WCH parts name
 * GPIO pads `P<bank><index>` (PA0, PB0, PC0 -> EXTI0); the numeric suffix is
 * the EXTI line index. Returns null when no GPIO index is present, so pins
 * without one never enter EXTI conflict detection. Bonded-name forms such as
 * `PA0 [PB0]` use the first listed pad; multi-pad EXTI multiplexing is not
 * encoded in the generated catalog and is out of scope for this rule.
 */
export function deriveExtiLineId(pinName: string): string | null {
  const match = /\bP[A-Z](\d+)\b/i.exec(pinName);
  return match ? `EXTI${Number.parseInt(match[1], 10)}` : null;
}

/** Evaluation-only assignments with EXTI line ids attached to GPIO/EXTI pins. */
interface ExtiAwareAssignments {
  state: WorkspaceState;
  derivedPositions: Set<string>;
}

/**
 * Build a local assignment view that carries derived EXTI line ids. Only
 * STM32/CH32-style mux models are covered; RP parts use FUNCSEL and have no
 * GPIO-index EXTI line. Generated shards and persisted workspace state are
 * never mutated, so share links and project files stay unchanged.
 */
function withDerivedExtiLines(
  chip: ChipData,
  state: WorkspaceState,
  pinMap: Map<string, PinInfo>,
): ExtiAwareAssignments {
  const next = cloneWorkspaceState(state);
  const derivedPositions = new Set<string>();
  if (getChipMuxModel(chip) === 'funcsel-pio') return { state: next, derivedPositions };

  for (const [pos, asgn] of Object.entries(state.assignments)) {
    if (asgn.peripheral !== 'GPIO' || asgn.signal !== 'EXTI' || asgn.resourceId) continue;
    const pin = pinMap.get(pos);
    if (!pin || pin.type !== 'io') continue;
    const line = deriveExtiLineId(pin.name);
    if (!line) continue;
    next.assignments[pos] = { ...asgn, resourceId: line };
    derivedPositions.add(pos);
  }

  return { state: next, derivedPositions };
}

/**
 * Detect shared EXTI lines by running the shared-resource detector over only
 * the derived assignments and relabelling its diagnostics for EXTI. Both
 * participating pins are listed so the standard conflict-marking path
 * highlights them; non-EXTI resource diagnostics are untouched.
 */
function analyzeExtiConflicts(
  derived: ExtiAwareAssignments,
  pinMap: Map<string, PinInfo>,
): DiagnosticItem[] {
  if (derived.derivedPositions.size === 0) return [];

  const extiState = cloneWorkspaceState(derived.state);
  extiState.assignments = {};
  for (const pos of derived.derivedPositions) {
    extiState.assignments[pos] = derived.state.assignments[pos];
  }

  return analyzeResourceConflicts(extiState, pinMap).map((diagnostic) => {
    const line = diagnostic.id.slice('resource:'.length);
    const names = diagnostic.pins
      .map((pos) => `${pinMap.get(pos)?.name ?? pos} (${pos})`)
      .join(', ');
    return {
      ...diagnostic,
      id: `exti:${line}`,
      code: 'EXTI_LINE_CONFLICT' as const,
      message: `EXTI line ${line} is assigned to multiple GPIO pins: ${names}.`,
    };
  });
}

/** Validate RP PIO state-machine reservations and gpioBaseOptions windows. */
function analyzePio(
  chip: ChipData,
  state: WorkspaceState,
  pinMap: Map<string, PinInfo>,
): DiagnosticItem[] {
  const pio = chip.pio;
  const bindings = state.pioAssignments;
  if (!pio || !bindings) return [];

  const diagnostics: DiagnosticItem[] = [];
  const reservations = new Map<string, string[]>();
  const windows = pio.gpioBaseOptions.map((base) => `${base}-${base + 31}`).join(', ');

  for (const pos of Object.keys(bindings).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )) {
    const binding = bindings[pos];
    const pin = pinMap.get(pos);
    if (!pin) continue;

    const number = gpioNumber(pin);
    if (number !== null && !pio.gpioBaseOptions.some((base) => number >= base && number < base + 32)) {
      diagnostics.push({
        id: `pio:gpiobase:${pos}`,
        severity: 'error',
        code: 'PIO_GPIOBASE_CONFLICT',
        pins: [pos],
        peripheral: binding.instance,
        message: `PIO pin ${pin.name} (${pos}) lies outside every valid GPIOBASE window (${windows}).`,
      });
    }

    if (!pio.instances.includes(binding.instance)) {
      diagnostics.push({
        id: `pio:instance:${pos}`,
        severity: 'error',
        code: 'RESOURCE_CONFLICT',
        pins: [pos],
        peripheral: binding.instance,
        message: `PIO instance ${binding.instance} on pin ${pin.name} (${pos}) is not available on ${chip.id}.`,
      });
      continue;
    }

    if (binding.sm === undefined) continue;
    const resourceId = `${binding.instance}:SM${binding.sm}`;
    if (binding.sm < 0 || binding.sm >= pio.stateMachinesPerInstance) {
      diagnostics.push({
        id: `pio:sm:${pos}`,
        severity: 'error',
        code: 'RESOURCE_CONFLICT',
        pins: [pos],
        peripheral: binding.instance,
        message: `PIO state machine ${resourceId} on pin ${pin.name} (${pos}) is out of range for ${binding.instance}.`,
      });
      continue;
    }
    const owners = reservations.get(resourceId) ?? [];
    owners.push(pos);
    reservations.set(resourceId, owners);
  }

  for (const [resourceId, positions] of reservations) {
    const unique = Array.from(new Set(positions)).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (unique.length < 2) continue;
    const names = unique.map((pos) => `${pinMap.get(pos)?.name ?? pos} (${pos})`).join(', ');
    diagnostics.push({
      id: `pio:reserved:${resourceId}`,
      severity: 'error',
      code: 'RESOURCE_CONFLICT',
      pins: unique,
      peripheral: resourceId.split(':')[0],
      message: `PIO state machine ${resourceId} is reserved by multiple pins: ${names}.`,
    });
  }

  return diagnostics;
}

/** Diagnose active remap slots that no longer match the emitted remap tables. */
function analyzeActiveRemaps(
  chip: ChipData,
  state: WorkspaceState,
  pinMap: Map<string, PinInfo>,
): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  for (const [peripheral, remapId] of Object.entries(state.activeRemaps ?? {})) {
    const option = findRemapOption(chip, peripheral, remapId);
    if (!option) continue;
    for (const [signal, pinName] of Object.entries(option.signals)) {
      const expected = findPinByName(chip, pinName);
      if (!expected) continue;
      const actualPos = Object.entries(state.assignments).find(
        ([, a]) => a.peripheral === peripheral && a.signal === signal,
      )?.[0];
      if (!actualPos || actualPos === expected.pos) continue;
      const locked = Boolean(state.locked[expected.pos] || state.locked[actualPos]);
      const occupant = state.assignments[expected.pos];
      diagnostics.push({
        id: `remap:active:${peripheral}:${signal}`,
        severity: 'error',
        code: locked ? 'REMAP_LOCKED' : 'REMAP_MISMATCH',
        pins: [actualPos, expected.pos],
        peripheral,
        message: locked
          ? `${peripheral} remap ${option.name} is blocked by locked pin ${pinMap.get(actualPos)?.name ?? actualPos} (${actualPos}).`
          : `${peripheral} remap ${option.name} expects ${signal} on ${expected.name} (${expected.pos}), but it is on ${pinMap.get(actualPos)?.name ?? actualPos} (${actualPos})${occupant ? `; target is occupied by ${occupant.peripheral}_${occupant.signal}` : ''}.`,
      });
    }
  }
  return diagnostics;
}

export function evaluateWorkspace(chip: ChipData, state: WorkspaceState): SolverReport {
  const pinMap = buildPinMap(chip);
  const diagnostics: DiagnosticItem[] = [];
  const pinStatus: Record<string, PinVisualStatus> = {};
  const peripheralStatus: Record<string, PeripheralStatus> = {};

  // Initialize pin visual states
  for (const pin of chip.pins) {
    if (pin.type === 'power' || pin.type === 'reset' || pin.type === 'boot') {
      pinStatus[pin.pos] = 'power';
    } else {
      pinStatus[pin.pos] = 'unused';
    }
  }

  // Initialize peripheral statuses
  for (const pName of Object.keys(chip.peripherals)) {
    peripheralStatus[pName] = 'none';
  }

  // 1. Validate individual assignments and track (peripheral, signal) usage
  const signalUsage = new Map<string, string[]>(); // "SPI1:SCK" -> [pos1, pos2]
  const activePeripherals = new Set<string>();

  for (const [pos, asgn] of Object.entries(state.assignments)) {
    const pin = pinMap.get(pos);
    if (!pin) continue;

    if (asgn.peripheral === 'GPIO') {
      if (pin.type !== 'io') {
        pinStatus[pos] = 'conflict';
        diagnostics.push({
          id: `invalid:${pos}`,
          severity: 'error',
          code: 'INVALID_PIN_SIGNAL',
          pins: [pos],
          message: `Pin ${pin.name} (${pos}) is not a general-purpose I/O pin.`,
        });
      } else {
        pinStatus[pos] = 'assigned';
      }
    } else {
      activePeripherals.add(asgn.peripheral);
      const valid = pinSupportsSignal(pin, asgn.peripheral, asgn.signal);
      if (!valid) {
        pinStatus[pos] = 'conflict';
        peripheralStatus[asgn.peripheral] = 'error';
        diagnostics.push({
          id: `invalid:${pos}:${asgn.peripheral}:${asgn.signal}`,
          severity: 'error',
          code: 'INVALID_PIN_SIGNAL',
          pins: [pos],
          peripheral: asgn.peripheral,
          message: `${pin.name} (Pin ${pos}) does not support ${asgn.peripheral}_${asgn.signal}.`,
        });
      } else {
        pinStatus[pos] = 'assigned';
      }

      const key = `${asgn.peripheral}:${asgn.signal}`;
      const list = signalUsage.get(key) ?? [];
      list.push(pos);
      signalUsage.set(key, list);
    }

    // 2. Tag- and role-driven vendor diagnostics
    const debugTag = isDebugPin(pin);
    if (debugTag && !isDebugAssignment(asgn)) {
      const tagDriven = pinHasTag(pin, 'debug-swd') || pinHasTag(pin, 'debug-sdi');
      const oneWire = debugTag === 'debug-sdi';
      diagnostics.push({
        id: `swd:${pos}`,
        severity: 'warning',
        code: tagDriven ? 'DEBUG_PIN_REPURPOSED' : 'SWD_REPURPOSED',
        pins: [pos],
        peripheral: asgn.peripheral,
        message: oneWire
          ? `${pin.name} (Pin ${pos}) is assigned to ${asgn.peripheral}_${asgn.signal}, which disables one-wire debugging unless intended.`
          : `${pin.name} (Pin ${pos}) is assigned to ${asgn.peripheral}_${asgn.signal}, which disables SWD debugging unless intended.`,
      });
    }
    if (pinHasTag(pin, 'bonded')) {
      const bondedNames = pin.bondedNames?.join(' / ');
      diagnostics.push({
        id: `bonded:${pos}`,
        severity: 'info',
        code: 'BONDED_PIN_NOTE',
        pins: [pos],
        peripheral: asgn.peripheral,
        message: `${pin.name} (Pin ${pos}) bonds multiple pads${bondedNames ? ` (${bondedNames})` : ''}; only one internal peripheral can be used at a time.`,
      });
    }
    if (getChipMuxModel(chip) === 'funcsel-pio') {
      const hintRoles: Array<[PinTag, string]> = [
        ['hstx', 'HSTX'],
        ['qspi', 'QSPI'],
        ['usb', 'USB'],
        ['adc', 'ADC'],
        ['5v-tolerant', '5V-tolerant'],
      ];
      for (const [tag, role] of hintRoles) {
        if (!pinHasTag(pin, tag)) continue;
        diagnostics.push({
          id: `pio:hint:${pos}:${tag}`,
          severity: 'info',
          code: 'RP_HARDWARE_HINT',
          pins: [pos],
          peripheral: asgn.peripheral,
          message: `${pin.name} (Pin ${pos}) is a ${role}-capable pin on ${chip.id}; check the RP datasheet before using it for ${formatMuxLabel(asgn, 'funcsel-pio')}.`,
        });
      }
    }
  }

  // 3. Duplicate (peripheral, signal) error check
  for (const [key, positions] of signalUsage.entries()) {
    if (positions.length > 1) {
      const [peripheral, signal] = key.split(':');
      const pinNames = positions
        .map((p) => `${pinMap.get(p)?.name ?? p} (${p})`)
        .join(', ');
      diagnostics.push({
        id: `dup:${key}`,
        severity: 'error',
        code: 'DUPLICATE_SIGNAL',
        pins: positions,
        peripheral,
        message: `Duplicate signal conflict: ${peripheral}_${signal} is assigned to multiple pins (${pinNames}).`,
      });
      for (const p of positions) {
        pinStatus[p] = 'conflict';
      }
      peripheralStatus[peripheral] = 'error';
    }
  }

  // 4. Clock-pin overlap warning, derived from signal roles rather than RCC-only modes
  const hseModeActive =
    state.peripheralModes.RCC === 'hse' || state.peripheralModes.RCC === 'hse_lse';
  const clockPins = chip.pins
    .map((pin) => ({ pin, role: clockRoleForPin(pin) }))
    .filter((entry): entry is { pin: PinInfo; role: 'OSC_IN' | 'OSC_OUT' } => entry.role !== null);
  const clockAssignmentActive = clockPins.some(({ pin, role }) => {
    const asgn = state.assignments[pin.pos];
    return Boolean(asgn && isClockAssignment(asgn) && asgn.signal === role);
  });
  if (hseModeActive || clockAssignmentActive) {
    for (const { pin, role } of clockPins) {
      const asgn = state.assignments[pin.pos];
      if (asgn && !isClockAssignment(asgn)) {
        diagnostics.push({
          id: `hse:${pin.pos}`,
          severity: 'warning',
          code: 'HSE_CONFLICT',
          pins: [pin.pos],
          peripheral: 'RCC',
          message: `HSE crystal pin ${pin.name} (${role}) is occupied by ${asgn.peripheral}_${asgn.signal}.`,
        });
      }
    }
  }

  // 5. Peripheral mode completeness check
  const allPeripheralsToCheck = new Set<string>([
    ...activePeripherals,
    ...Object.keys(state.peripheralModes),
  ]);

  for (const periphName of allPeripheralsToCheck) {
    const info = chip.peripherals[periphName];
    if (!info) continue;

    const assignedPositions = Object.entries(state.assignments)
      .filter(([, a]) => a.peripheral === periphName)
      .map(([pos]) => pos);

    const assignedSignals = new Set<string>(
      assignedPositions.map((pos) => state.assignments[pos].signal),
    );

    const modeId = state.peripheralModes[periphName];
    const modeTemplate = modeId
      ? getModesForPeripheral(chip, periphName).find((m) => m.id === modeId)
      : undefined;

    if (modeTemplate && !modeTemplate.isChannelBased && modeTemplate.required.length > 0) {
      const requiredCanonical = modeTemplate.required
        .map((req) => resolveCanonicalSignal(info, req))
        .filter((s): s is string => s !== null);

      const missingSignals = requiredCanonical.filter((sig) => !assignedSignals.has(sig));

      if (missingSignals.length > 0) {
        if (peripheralStatus[periphName] !== 'error') {
          peripheralStatus[periphName] = 'partial';
        }
        for (const pos of assignedPositions) {
          if (pinStatus[pos] !== 'conflict') {
            pinStatus[pos] = 'partial';
          }
        }
        const firstFix = findOneHopFixForSignal(chip, state, periphName, missingSignals[0]);
        diagnostics.push({
          id: `incomplete:${periphName}`,
          severity: 'warning',
          code: 'INCOMPLETE_MODE',
          peripheral: periphName,
          pins: assignedPositions,
          missingSignals,
          fix: firstFix ?? undefined,
          message: `${periphName} (${modeTemplate.label}) is missing required signal${missingSignals.length > 1 ? 's' : ''}: ${missingSignals.join(', ')}.`,
        });
      } else if (peripheralStatus[periphName] !== 'error') {
        peripheralStatus[periphName] = 'active';
      }
    } else if (assignedPositions.length > 0 && peripheralStatus[periphName] !== 'error') {
      peripheralStatus[periphName] = 'active';
    }
  }

  // 6. DMA Contention Analysis
  const dmaResult = analyzeDma(chip, state);
  diagnostics.push(...dmaResult.diagnostics);

  // 7. Vendor-aware mux analysis. EXTI lines are derived into a local clone
  // before shared-resource analysis runs; the generic pass keeps its original
  // inputs and diagnostics, while the EXTI pass consumes the derived ids.
  const remapDiagnostics = analyzeActiveRemaps(chip, state, pinMap);
  const derivedExti = withDerivedExtiLines(chip, state, pinMap);
  const resourceDiagnostics = analyzeResourceConflicts(state, pinMap);
  const extiDiagnostics = analyzeExtiConflicts(derivedExti, pinMap);
  const pioDiagnostics = analyzePio(chip, state, pinMap);
  diagnostics.push(
    ...remapDiagnostics,
    ...resourceDiagnostics,
    ...extiDiagnostics,
    ...pioDiagnostics,
  );
  for (const d of [...resourceDiagnostics, ...extiDiagnostics, ...pioDiagnostics]) {
    for (const pos of d.pins) {
      pinStatus[pos] = 'conflict';
      if (d.peripheral && peripheralStatus[d.peripheral] !== undefined) {
        peripheralStatus[d.peripheral] = 'error';
      }
    }
  }

  // Sort diagnostics: errors first, then warnings, then info
  const severityOrder = { error: 0, warning: 1, info: 2 };
  diagnostics.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errorCount++;
    else if (d.severity === 'warning') warningCount++;
    else infoCount++;
  }

  return {
    diagnostics,
    pinStatus,
    peripheralStatus,
    dmaAnalysis: dmaResult.entries,
    errorCount,
    warningCount,
    infoCount,
  };
}

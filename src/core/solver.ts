import { cloneWorkspaceState } from './history';
import type {
  AlternatePinCandidate,
  ChipData,
  DiagnosticItem,
  DmaAnalysisEntry,
  OneHopFix,
  PeripheralInfo,
  PeripheralKind,
  PeripheralModeTemplate,
  PeripheralStatus,
  PinAssignment,
  PinInfo,
  PinSignal,
  PinVisualStatus,
  SolverReport,
  WorkspaceState,
} from './types';

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

function isSwdPin(pin: PinInfo): boolean {
  const baseName = pin.name.split(/[\s/\-[\]()]/)[0];
  if (baseName === 'PA13' || baseName === 'PA14') return true;
  return pin.signals.some(
    (s) =>
      (s.peripheral === 'SYS' || s.peripheral === 'DEBUG') &&
      (s.signal.includes('SWDIO') || s.signal.includes('SWCLK')),
  );
}

function isSwdAssignment(asgn: PinAssignment): boolean {
  if (asgn.peripheral !== 'SYS' && asgn.peripheral !== 'DEBUG') return false;
  return (
    asgn.signal.includes('SWDIO') ||
    asgn.signal.includes('SWCLK') ||
    asgn.signal.includes('JTMS') ||
    asgn.signal.includes('JTCK')
  );
}

function isHsePin(pin: PinInfo): 'OSC_IN' | 'OSC_OUT' | null {
  for (const s of pin.signals) {
    if (s.peripheral === 'RCC' && (s.signal === 'OSC_IN' || s.signal === 'OSC_OUT')) {
      return s.signal;
    }
  }
  return null;
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

function computePinScarcityScore(
  pin: PinInfo,
  chip: ChipData,
  state: WorkspaceState,
  signalPinCounts: Map<string, number>,
  targetPeripheral: string,
): number {
  let score = 0;

  // Strongly preserve SWD pins unless allocating SYS/DEBUG
  if (targetPeripheral !== 'SYS' && targetPeripheral !== 'DEBUG' && isSwdPin(pin)) {
    score += 120;
  }

  // Strongly preserve HSE pins unless allocating RCC
  if (targetPeripheral !== 'RCC' && isHsePin(pin) !== null) {
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
  next.assignments[toPos] = {
    peripheral: source.peripheral,
    signal: match.signal,
    af: match.af,
  };

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
      };
    }
  }

  return bestFix;
}

export function applyOneHopFix(state: WorkspaceState, fix: OneHopFix): WorkspaceState {
  const next = cloneWorkspaceState(state);

  // Move displaced assignment first
  const displacedLabel = next.labels[fix.displacedFromPos];
  delete next.assignments[fix.displacedFromPos];
  if (displacedLabel) {
    next.labels[fix.displacedToPos] = displacedLabel;
    delete next.labels[fix.displacedFromPos];
  }

  next.assignments[fix.displacedToPos] = {
    peripheral: fix.displacedPeripheral,
    signal: fix.displacedSignal,
    af: fix.displacedAf,
  };

  // Place target assignment on newly freed pin
  next.assignments[fix.targetPos] = {
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

    // 2. SWD repurposing warning
    if (isSwdPin(pin) && !isSwdAssignment(asgn)) {
      diagnostics.push({
        id: `swd:${pos}`,
        severity: 'warning',
        code: 'SWD_REPURPOSED',
        pins: [pos],
        peripheral: asgn.peripheral,
        message: `${pin.name} (Pin ${pos}) is assigned to ${asgn.peripheral}_${asgn.signal}, which disables SWD debugging unless intended.`,
      });
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

  // 4. HSE overlap warning
  const hseModeActive =
    state.peripheralModes.RCC === 'hse' || state.peripheralModes.RCC === 'hse_lse';
  const oscInAssigned = Array.from(signalUsage.keys()).some((k) => k === 'RCC:OSC_IN');
  const oscOutAssigned = Array.from(signalUsage.keys()).some((k) => k === 'RCC:OSC_OUT');
  if (hseModeActive || oscInAssigned || oscOutAssigned) {
    for (const pin of chip.pins) {
      const oscRole = isHsePin(pin);
      if (!oscRole) continue;
      const asgn = state.assignments[pin.pos];
      if (asgn && !(asgn.peripheral === 'RCC' && asgn.signal === oscRole)) {
        diagnostics.push({
          id: `hse:${pin.pos}`,
          severity: 'warning',
          code: 'HSE_CONFLICT',
          pins: [pin.pos],
          peripheral: 'RCC',
          message: `HSE crystal pin ${pin.name} (${oscRole}) is occupied by ${asgn.peripheral}_${asgn.signal}.`,
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

  // Sort diagnostics: errors first, then warnings, then info
  const severityOrder = { error: 0, warning: 1, info: 2 };
  diagnostics.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  let errorCount = 0;
  let warningCount = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errorCount++;
    else if (d.severity === 'warning') warningCount++;
  }

  return {
    diagnostics,
    pinStatus,
    peripheralStatus,
    dmaAnalysis: dmaResult.entries,
    errorCount,
    warningCount,
  };
}

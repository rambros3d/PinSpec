/**
 * Read-only workspace evaluation: DMA, resource, EXTI, PIO, remap, and matrix
 * analysis plus the public `evaluateWorkspace` report and matrix validator.
 */

import { cloneWorkspaceState } from './history';
import { formatMuxLabel, getChipMuxModel, isFlexibleRoutingMux } from './types';
import type {
  ChipData,
  DiagnosticItem,
  DmaAnalysisEntry,
  PeripheralStatus,
  PinInfo,
  PinTag,
  PinVisualStatus,
  SolverReport,
  WorkspaceState,
} from './types';
import { getModesForPeripheral, resolveCanonicalSignal } from './solver-modes';
import {
  buildPinMap,
  clockRoleForPin,
  computeSignalPinCounts,
  findPinByName,
  gpioNumber,
  isClockAssignment,
  isDebugAssignment,
  isDebugPin,
  pinHasTag,
  pinSupportsSignal,
} from './solver-common';
import { findOneHopFixForSignal, findRemapOption } from './solver-remap';

/**
 * Read-only post-allocation validation for matrix plans. Reports duplicate
 * signals, resource collisions, and the ESP32 diagnostics supplied by the
 * schema without changing assignments or workspace state.
 */
export function validateMatrixPlan(chip: ChipData, state: WorkspaceState): DiagnosticItem[] {
  if (!isFlexibleRoutingMux(getChipMuxModel(chip))) return [];
  const reported = new Set<DiagnosticItem['code']>([
    'DUPLICATE_SIGNAL',
    'RESOURCE_CONFLICT',
    'STRAPPING_REPURPOSED',
    'INPUT_ONLY_OUTPUT',
    'ADC2_WIFI_CONFLICT',
    'MATRIX_ROUTE_LIMIT',
  ]);
  return evaluateWorkspace(chip, state).diagnostics.filter((d) => reported.has(d.code));
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

/**
 * Electrical diagnostics for flexible-routing vendors. Every trigger is
 * derived from chip data (tags, signal direction, peripheral names, declared
 * capacity). Electrical checks apply to both `gpio-matrix` and `psel`; Wi-Fi
 * and route-capacity checks remain specific to `gpio-matrix`.
 */
function analyzeMatrix(
  chip: ChipData,
  state: WorkspaceState,
  pinMap: Map<string, PinInfo>,
): DiagnosticItem[] {
  const muxModel = getChipMuxModel(chip);
  if (!isFlexibleRoutingMux(muxModel)) return [];
  const diagnostics: DiagnosticItem[] = [];
  const wifiEnabled = muxModel === 'gpio-matrix' && Object.entries(chip.peripherals).some(([name]) => {
    if (!/WIFI/i.test(name)) return false;
    const mode = state.peripheralModes[name];
    if (mode !== undefined) return mode !== 'disabled';
    return Object.values(state.assignments).some((asgn) => asgn.peripheral === name);
  });
  const outputDrivers = new Map<string, string[]>();

  for (const [pos, asgn] of Object.entries(state.assignments)) {
    const pin = pinMap.get(pos);
    if (!pin) continue;
    const match = pinSupportsSignal(pin, asgn.peripheral, asgn.signal);
    const drives =
      asgn.peripheral === 'GPIO' ? asgn.signal === 'Output' : match?.direction === 'output';

    if (drives && pinHasTag(pin, 'strapping')) {
      diagnostics.push({
        id: `strapping:${pos}`,
        severity: 'warning',
        code: 'STRAPPING_REPURPOSED',
        pins: [pos],
        peripheral: asgn.peripheral,
        message: `Strapping pin ${pin.name} (Pin ${pos}) is driven by ${asgn.peripheral}_${asgn.signal}; boot-time configuration may change.`,
      });
    }
    if (drives && pinHasTag(pin, 'input-only')) {
      diagnostics.push({
        id: `input-only:${pos}`,
        severity: 'error',
        code: 'INPUT_ONLY_OUTPUT',
        pins: [pos],
        peripheral: asgn.peripheral,
        message: `${pin.name} (Pin ${pos}) is input-only and cannot drive ${asgn.peripheral}_${asgn.signal}.`,
      });
    }
    if (wifiEnabled && (asgn.peripheral === 'ADC2' || /^ADC2/.test(asgn.signal))) {
      diagnostics.push({
        id: `adc2-wifi:${pos}`,
        severity: 'warning',
        code: 'ADC2_WIFI_CONFLICT',
        pins: [pos],
        peripheral: asgn.peripheral,
        message: `ADC2 channel ${pin.name} (Pin ${pos}) is unavailable while Wi-Fi is enabled.`,
      });
    }
    if (drives && asgn.peripheral !== 'GPIO') {
      const drivers = outputDrivers.get(pos) ?? [];
      drivers.push(`${asgn.peripheral}_${asgn.signal}`);
      outputDrivers.set(pos, drivers);
    }
  }

  for (const [pos, drivers] of outputDrivers) {
    if (drivers.length < 2) continue;
    diagnostics.push({
      id: `gpio-output-driver:${pos}`,
      severity: 'error',
      code: 'DUPLICATE_SIGNAL',
      pins: [pos],
      message: `GPIO output ${pinMap.get(pos)?.name ?? pos} (Pin ${pos}) has multiple drivers: ${drivers.join(', ')}.`,
    });
  }

  const capacity = muxModel === 'gpio-matrix' ? chip.matrixRouteCapacity : undefined;
  if (capacity !== undefined) {
    const routePins = Object.entries(state.assignments)
      .filter(([, asgn]) => asgn.peripheral !== 'GPIO')
      .map(([pos]) => pos);
    if (routePins.length > capacity) {
      diagnostics.push({
        id: 'matrix-route-limit',
        severity: 'warning',
        code: 'MATRIX_ROUTE_LIMIT',
        pins: routePins,
        message: `${routePins.length} GPIO-matrix routes exceed the declared capacity of ${capacity}.`,
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
  const isMatrix = getChipMuxModel(chip) === 'gpio-matrix';
  // Matrix peripheral outputs may fan out; inputs and every other vendor keep
  // the single-source rule.
  const matrixOutputSignals = new Set<string>();

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
      if (isMatrix && valid?.direction === 'output') matrixOutputSignals.add(key);
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
    if (positions.length > 1 && !matrixOutputSignals.has(key)) {
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
  const matrixDiagnostics = analyzeMatrix(chip, state, pinMap);
  diagnostics.push(
    ...remapDiagnostics,
    ...resourceDiagnostics,
    ...extiDiagnostics,
    ...pioDiagnostics,
    ...matrixDiagnostics,
  );
  for (const d of [
    ...resourceDiagnostics,
    ...extiDiagnostics,
    ...pioDiagnostics,
    ...matrixDiagnostics,
  ]) {
    for (const pos of d.pins) {
      if (d.severity !== 'error') continue;
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

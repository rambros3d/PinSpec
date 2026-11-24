/**
 * Pure importer for STM32CubeMX / CubeIDE `.ioc` project files.
 *
 * The format is flat `key=value` text with escaped spaces in pin names and no
 * package coordinates, so assignments are joined to physical positions by pin
 * name against a loaded chip shard. No DOM or Svelte APIs are used here.
 *
 * Upstream vocabulary and pin naming follow the official ST board
 * configurations in `STMicroelectronics/STM32_open_pin_data/boards/*.ioc`
 * (BSD-3-Clause).
 */
import type {
  CatalogIndexEntry,
  ChipData,
  PinAssignment,
  PinInfo,
  PinSignal,
  WorkspaceState,
} from '../types';

/** One usable pin declaration extracted from an `.ioc` file or board preset. */
export interface IocPinEntry {
  /** Normalized GPIO name, for example `PH0` or `PC14`. */
  pinName: string;
  /** Raw ST signal name, for example `GPIO_EXTI13` or `USART2_TX`. */
  signal?: string;
  /** Raw ST mode label, for example `Asynchronous`. */
  mode?: string;
  /** GPIO user label from `GPIO_Label`. */
  label?: string;
  /** Whether the pin was locked in CubeMX. */
  locked: boolean;
}

/** Parsed representation of an `.ioc` file before MCU resolution. */
export interface IocRawRecord {
  /** `Mcu.Name`, which may contain parenthesized flash-size variants. */
  mcuName: string;
  /** `Mcu.UserName`, normally more specific than `Mcu.Name`. */
  userName: string;
  /** `PCC.PartNumber`, the most specific part identifier when present. */
  partNumber: string;
  /** `Mcu.Package`, for example `LQFP64`. */
  packageName: string;
  /** `Mcu.PinsNb` when declared, otherwise zero. */
  pinsNb: number;
  /** `Mcu.IPn` when declared, otherwise zero. */
  ipCount: number;
  /** Names from `Mcu.IP0`, `Mcu.IP1`, ... in numeric order. */
  ipNames: string[];
  /** `board` from the file header, for Nucleo / Discovery / Eval boards. */
  board?: string;
  /** Physical pin declarations; virtual `VP_` entries are excluded. */
  pins: IocPinEntry[];
  /** `SH.GPXTI<line>.<index>` entries keyed by EXTI line. */
  extiSignals: Record<string, string[]>;
}

export type IocParseResult =
  | { ok: true; record: IocRawRecord }
  | { ok: false; error: string };

/** Normalized peripheral and signal pair produced by the ST vocabulary map. */
export interface MappedIocSignal {
  peripheral: string;
  signal: string;
  /** Shared-resource key such as `EXTI13`, when derivable from the ST name. */
  resourceId?: string;
}

/** Result of mapping one ST signal name; `mapped` is null for virtual signals. */
export interface IocSignalMapping {
  mapped: MappedIocSignal | null;
  /** Set when a pin-level signal could not be mapped to the core vocabulary. */
  warning?: string;
}

/** Data needed to join parsed pin names to a concrete chip shard. */
export interface IocImportContext {
  chip: ChipData;
  /** Resolved commercial MCU ID from the catalog. */
  mcuId: string;
}

export type IocImportResult =
  | { ok: true; state: WorkspaceState; warnings: string[] }
  | { ok: false; error: string };

/** Highest-level result of preparing a dropped `.ioc` file for import. */
export type IocImportPreparation =
  | { kind: 'ready'; record: IocRawRecord; mcuId: string }
  | { kind: 'ambiguous'; record: IocRawRecord; candidates: string[] }
  | { kind: 'error'; error: string };

/** Part-ID resolution outcome relative to the catalog index. */
export interface IocPartResolution {
  requested: string;
  candidates: string[];
}

const PIN_FIELDS = new Set(['Signal', 'Mode', 'GPIO_Label', 'Locked']);

/** Cube virtual-signal placeholders that do not describe a physical function. */
const IGNORED_SIGNAL_RE = /_VS_/;

/** Exact ST names whose normalized pair differs from a simple prefix split. */
const DIRECT_SIGNAL_MAP: Record<string, MappedIocSignal> = {
  GPIO_Output: { peripheral: 'GPIO', signal: 'Output' },
  GPIO_Input: { peripheral: 'GPIO', signal: 'Input' },
  GPIO_Analog: { peripheral: 'GPIO', signal: 'Analog' },
  'SYS_JTMS-SWDIO': { peripheral: 'SYS', signal: 'SWDIO' },
  'DEBUG_JTMS-SWDIO': { peripheral: 'SYS', signal: 'SWDIO' },
  DEBUG_SWDIO: { peripheral: 'SYS', signal: 'SWDIO' },
  'SYS_JTCK-SWCLK': { peripheral: 'SYS', signal: 'SWCLK' },
  'DEBUG_JTCK-SWCLK': { peripheral: 'SYS', signal: 'SWCLK' },
  DEBUG_SWCLK: { peripheral: 'SYS', signal: 'SWCLK' },
  'SYS_JTDO-SWO': { peripheral: 'SYS', signal: 'SWO' },
  'SYS_JTDO-TRACESWO': { peripheral: 'SYS', signal: 'SWO' },
  'DEBUG_JTDO-SWO': { peripheral: 'SYS', signal: 'SWO' },
  SYS_JTRST: { peripheral: 'SYS', signal: 'NJTRST' },
  DEBUG_JTRST: { peripheral: 'SYS', signal: 'NJTRST' },
  DEBUG_NJTRST: { peripheral: 'SYS', signal: 'NJTRST' },
  RCC_OSC_IN: { peripheral: 'RCC', signal: 'OSC_IN' },
  RCC_OSC_OUT: { peripheral: 'RCC', signal: 'OSC_OUT' },
  RCC_OSC32_IN: { peripheral: 'RCC', signal: 'OSC32_IN' },
  RCC_OSC32_OUT: { peripheral: 'RCC', signal: 'OSC32_OUT' },
};

/** Peripheral names containing underscores in ST signal names. */
const MULTI_TOKEN_PERIPHERALS = ['USB_OTG_HS', 'USB_OTG_FS', 'OTG_HS', 'OTG_FS'];

/** Local aliases used when joining a mapped signal to a shard signal entry. */
const SIGNAL_ALIASES: Record<string, string[]> = {
  SWDIO: ['SWDIO', 'JTMS-SWDIO', 'JTMS'],
  SWCLK: ['SWCLK', 'JTCK-SWCLK', 'JTCK'],
  SWO: ['SWO', 'JTDO-SWO', 'JTDO'],
  NJTRST: ['NJTRST', 'JTRST'],
  DM: ['DM', 'FS_DM', 'USB_DM'],
  DP: ['DP', 'FS_DP', 'USB_DP'],
};

const PERIPHERAL_ALIASES: Record<string, string[]> = {
  USB: ['USB', 'USB_OTG_FS', 'USB_OTG_HS'],
  USB_OTG_FS: ['USB_OTG_FS', 'USB'],
  USB_OTG_HS: ['USB_OTG_HS', 'USB'],
};

interface IocModeRule {
  kind: 'usart' | 'sys' | 'rcc' | 'spi' | 'i2c' | 'can' | 'usb';
  mode: string;
}

/** Cube mode labels mapped to PinCraft declarative mode IDs. */
const MODE_RULES: Record<string, IocModeRule> = {
  asynchronous: { kind: 'usart', mode: 'async' },
  synchronous: { kind: 'usart', mode: 'sync' },
  'hardware flow control': { kind: 'usart', mode: 'async_hw_flow' },
  'serial-wire': { kind: 'sys', mode: 'swd' },
  serial_wire: { kind: 'sys', mode: 'swd' },
  trace_asynchronous_sw: { kind: 'sys', mode: 'swd' },
  jtag: { kind: 'sys', mode: 'jtag' },
  'lse-external-oscillator': { kind: 'rcc', mode: 'lse' },
  'hse-external-clock-source': { kind: 'rcc', mode: 'hse' },
  'hse-external-oscillator': { kind: 'rcc', mode: 'hse' },
  'full-duplex-master': { kind: 'spi', mode: 'full_duplex' },
  'full-duplex-slave': { kind: 'spi', mode: 'full_duplex' },
  i2c: { kind: 'i2c', mode: 'i2c' },
  normal: { kind: 'can', mode: 'normal' },
  'device (fs)': { kind: 'usb', mode: 'device_fs' },
  device_only: { kind: 'usb', mode: 'device_fs' },
};

/** Remove backslash escaping used by Cube for spaces, colons and backslashes. */
function unescapeIoc(raw: string): string {
  return raw.replace(/\\(.)/g, '$1').trim();
}

/**
 * Normalize a `.ioc` pin name to the GPIO name used by chip shards.
 * Decorations such as `PH0\ -\ OSC_IN` and `PC14-OSC32_IN` reduce to `PH0`
 * and `PC14`; non-GPIO names are uppercased verbatim.
 */
export function normalizeIocPinName(rawName: string): string {
  const clean = unescapeIoc(rawName);
  const gpio = clean.match(/\bP[A-K][0-9]{1,2}\b/i);
  return gpio ? gpio[0].toUpperCase() : clean.toUpperCase();
}

/** Parse flat `.ioc` text into a raw record, ignoring comments and unknown keys. */
export function parseIoc(text: string): IocParseResult {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'The .ioc file is empty.' };
  }

  let mcuName = '';
  let userName = '';
  let partNumber = '';
  let packageName = '';
  let pinsNb = 0;
  let ipCount = 0;
  let board: string | undefined;
  const ips = new Map<number, string>();
  const extiSignals: Record<string, string[]> = {};
  const pins = new Map<string, IocPinEntry>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;

    const key = unescapeIoc(line.slice(0, eq));
    const value = unescapeIoc(line.slice(eq + 1));

    if (key === 'Mcu.Name') {
      mcuName = value;
    } else if (key === 'Mcu.UserName') {
      userName = value;
    } else if (key === 'PCC.PartNumber') {
      partNumber = value;
    } else if (key === 'Mcu.Package') {
      packageName = value;
    } else if (key === 'Mcu.PinsNb') {
      pinsNb = Number.parseInt(value, 10) || 0;
    } else if (key === 'Mcu.IPn') {
      ipCount = Number.parseInt(value, 10) || 0;
    } else if (key === 'board') {
      board = value || undefined;
    } else if (/^Mcu\.IP\d+$/.test(key)) {
      ips.set(Number.parseInt(key.slice(6), 10), value);
    } else if (/^SH\.GPXTI\d+\.\d+$/.test(key)) {
      const lineMatch = key.match(/^SH\.GPXTI(\d+)\./);
      if (lineMatch && value) {
        const lineNo = lineMatch[1];
        (extiSignals[lineNo] ??= []).push(value);
      }
    } else {
      const dot = key.lastIndexOf('.');
      if (dot < 1) continue;
      const rawPin = key.slice(0, dot);
      const field = key.slice(dot + 1);
      if (!PIN_FIELDS.has(field) || rawPin.toUpperCase().startsWith('VP_')) continue;

      const pinName = normalizeIocPinName(rawPin);
      const entry = pins.get(rawPin) ?? { pinName, locked: false };
      if (field === 'Signal') entry.signal = value || undefined;
      else if (field === 'Mode') entry.mode = value || undefined;
      else if (field === 'GPIO_Label') entry.label = value || undefined;
      else if (field === 'Locked') entry.locked = value.toUpperCase() === 'TRUE';
      pins.set(rawPin, entry);
    }
  }

  if (!mcuName && !userName && !partNumber) {
    return { ok: false, error: 'The .ioc file has no MCU part identifier (Mcu.Name).' };
  }

  const ipNames = Array.from(ips.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);

  return {
    ok: true,
    record: {
      mcuName,
      userName,
      partNumber,
      packageName,
      pinsNb,
      ipCount,
      ipNames,
      board,
      pins: Array.from(pins.values()),
      extiSignals,
    },
  };
}

/** Map an ST signal name to the normalized peripheral/signal pair. */
export function mapIocSignal(rawSignal: string): IocSignalMapping {
  const signal = rawSignal.trim();
  if (!signal || IGNORED_SIGNAL_RE.test(signal)) return { mapped: null };

  const direct = DIRECT_SIGNAL_MAP[signal];
  if (direct) return { mapped: { ...direct } };

  const exti = signal.match(/^(?:GPIO_EXTI|GPXTI)(\d+)(?:_\d+)?$/);
  if (exti) {
    return {
      mapped: { peripheral: 'GPIO', signal: 'EXTI', resourceId: `EXTI${exti[1]}` },
    };
  }

  let peripheral = '';
  let name = '';
  for (const candidate of MULTI_TOKEN_PERIPHERALS) {
    if (signal.startsWith(`${candidate}_`)) {
      peripheral = candidate;
      name = signal.slice(candidate.length + 1);
      break;
    }
  }
  if (!peripheral) {
    const split = splitPeripheralSignal(signal);
    if (split) {
      peripheral = split.peripheral;
      name = split.signal;
    }
  }
  if (!peripheral || !name) {
    return { mapped: null, warning: `Unmapped .ioc signal "${signal}" was skipped.` };
  }
  return { mapped: { peripheral, signal: name } };
}

function splitPeripheralSignal(signal: string): { peripheral: string; signal: string } | null {
  const idx = signal.indexOf('_');
  if (idx < 1) return null;
  return { peripheral: signal.slice(0, idx), signal: signal.slice(idx + 1) };
}

function peripheralRole(peripheral: string): IocModeRule['kind'] | null {
  const name = peripheral.toUpperCase();
  if (name === 'SYS') return 'sys';
  if (name === 'RCC') return 'rcc';
  if (/^(USART|UART|LPUART)\d/.test(name)) return 'usart';
  if (/^SPI\d/.test(name)) return 'spi';
  if (/^I2C\d/.test(name)) return 'i2c';
  if (/^(CAN|FDCAN)\d?$/.test(name)) return 'can';
  if (/^USB/.test(name)) return 'usb';
  return null;
}

/** Map a Cube mode label onto a peripheral mode ID when the kind matches. */
export function mapIocMode(
  mapped: MappedIocSignal,
  rawMode: string,
): { peripheral: string; mode: string } | null {
  const rule = MODE_RULES[rawMode.trim().toLowerCase()];
  if (!rule || peripheralRole(mapped.peripheral) !== rule.kind) return null;
  return { peripheral: mapped.peripheral, mode: rule.mode };
}

/** Expand parenthesized ST flash-size variants using the adapter's literal rule. */
export function expandPartId(partId: string): string[] {
  const raw = partId.trim();
  const match = raw.match(/\(([^()]+)\)/);
  if (!match) return [raw];
  const options = match[1]
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean);
  const results: string[] = [];
  for (const option of options) {
    results.push(...expandPartId(raw.replace(match[0], option)));
  }
  return Array.from(new Set(results));
}

/** Canonicalize a trailing temperature wildcard (`x`) to grade `6`. */
export function canonicalizeIocPartId(partId: string): string {
  return partId.trim().replace(/([A-Z])x([A-Z0-9]*)$/, '$16$2');
}

/** Resolve a part ID to concrete, catalog-covered MCU IDs. */
export function resolvePartIdCandidates(
  partId: string,
  index: CatalogIndexEntry[],
): string[] {
  const known = new Set(index.map((entry) => entry.id.toUpperCase()));
  const resolved = new Set<string>();
  for (const expanded of expandPartId(partId)) {
    const canonical = canonicalizeIocPartId(expanded).toUpperCase();
    if (known.has(canonical)) resolved.add(canonical);
  }
  return Array.from(resolved).sort();
}

/**
 * Resolve an `.ioc` record against the catalog, preferring the most specific
 * part identifier available in the file.
 */
export function resolveIocPartId(
  record: IocRawRecord,
  index: CatalogIndexEntry[],
): IocPartResolution {
  const sources = [record.partNumber, record.userName, record.mcuName].filter(Boolean);
  const requested = sources[0] ?? record.mcuName;
  for (const source of sources) {
    const candidates = resolvePartIdCandidates(source, index);
    if (candidates.length > 0) return { requested: source, candidates };
  }
  return { requested, candidates: [] };
}

function aliasesFor(value: string, table: Record<string, string[]>): string[] {
  return table[value] ?? [value];
}

function findShardSignal(pin: PinInfo, mapped: MappedIocSignal): PinSignal | undefined {
  const peripheralAliases = aliasesFor(mapped.peripheral, PERIPHERAL_ALIASES);
  const signalAliases = aliasesFor(mapped.signal, SIGNAL_ALIASES);
  return pin.signals.find(
    (s) =>
      peripheralAliases.includes(s.peripheral.toUpperCase()) &&
      signalAliases.includes(s.signal.toUpperCase()),
  );
}

/**
 * Assemble a version-2 workspace from parsed pin declarations and a loaded
 * chip shard. Pin names are the only join key because `.ioc` has no positions.
 */
export function buildWorkspaceFromPins(
  pins: IocPinEntry[],
  ctx: IocImportContext,
): IocImportResult {
  if (!ctx.chip || !ctx.mcuId.trim()) {
    return { ok: false, error: 'A resolved MCU and its chip data are required for import.' };
  }

  const byName = new Map<string, PinInfo>();
  for (const pin of ctx.chip.pins) {
    const name = normalizeIocPinName(pin.name);
    if (!byName.has(name)) byName.set(name, pin);
  }

  const state: WorkspaceState = {
    mcuId: ctx.mcuId,
    assignments: {},
    labels: {},
    locked: {},
    peripheralModes: {},
  };
  const warnings: string[] = [];

  for (const entry of pins) {
    const name = normalizeIocPinName(entry.pinName);
    if (name.startsWith('VP_')) continue;
    const pin = byName.get(name);
    if (!pin) {
      warnings.push(`Pin ${name} is not present on ${ctx.mcuId}; its assignment was skipped.`);
      continue;
    }

    if (entry.signal) {
      const mapping = mapIocSignal(entry.signal);
      if (mapping.warning) warnings.push(mapping.warning);
      if (mapping.mapped && state.assignments[pin.pos]) {
        warnings.push(`Multiple pin declarations map to position ${pin.pos}; kept the first.`);
      } else if (mapping.mapped) {
        const match = findShardSignal(pin, mapping.mapped);
        const assignment: PinAssignment = {
          peripheral: mapping.mapped.peripheral,
          signal: mapping.mapped.signal,
          af: match?.af ?? null,
        };
        if (match?.funcLabel) assignment.funcLabel = match.funcLabel;
        const resourceId = mapping.mapped.resourceId ?? match?.resourceId;
        if (resourceId) assignment.resourceId = resourceId;
        state.assignments[pin.pos] = assignment;

        if (entry.mode) {
          const mode = mapIocMode(mapping.mapped, entry.mode);
          if (mode) {
            const existing = state.peripheralModes[mode.peripheral];
            if (
              mode.peripheral === 'RCC' &&
              ((existing === 'hse' && mode.mode === 'lse') ||
                (existing === 'lse' && mode.mode === 'hse'))
            ) {
              state.peripheralModes.RCC = 'hse_lse';
            } else {
              state.peripheralModes[mode.peripheral] = mode.mode;
            }
          }
        }
      }
    }

    if (entry.label?.trim()) state.labels[pin.pos] = entry.label.trim();
    if (entry.locked) state.locked[pin.pos] = true;
  }

  return { ok: true, state, warnings };
}

/**
 * Parse and resolve a dropped `.ioc` file. Ambiguous part IDs are returned for
 * explicit user confirmation rather than selecting a candidate silently.
 */
export function prepareIocImport(
  text: string,
  index: CatalogIndexEntry[],
): IocImportPreparation {
  const parsed = parseIoc(text);
  if (!parsed.ok) return { kind: 'error', error: parsed.error };

  const resolution = resolveIocPartId(parsed.record, index);
  if (resolution.candidates.length === 0) {
    return {
      kind: 'error',
      error: `No catalog part matches the .ioc MCU identifier "${resolution.requested}".`,
    };
  }
  if (resolution.candidates.length > 1) {
    return { kind: 'ambiguous', record: parsed.record, candidates: resolution.candidates };
  }
  return { kind: 'ready', record: parsed.record, mcuId: resolution.candidates[0] };
}

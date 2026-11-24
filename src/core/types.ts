/**
 * Current PinCraft state schema version for project files and share links.
 * There is deliberately no version-1 import path: the multi-vendor schema
 * replaces it outright, and any other version is rejected by both codecs.
 */
export const PINCRAFT_STATE_VERSION = 2;

export type VendorId = 'stm32' | 'ch32' | 'rp';

export type MuxModel =
  | 'af' // Independent per-pin alternate functions (most STM32)
  | 'remap-group' // Coupled peripheral AFIO remap slots (CH32)
  | 'funcsel-pio'; // Per-pin FUNCSEL + shared PWM slices + flexible PIO (RP2040/RP235x)

export type PinTag =
  | 'debug-swd' // SWDIO / SWCLK
  | 'debug-sdi' // WCH 1-wire SWIO (e.g., PD1 on CH32V00x)
  | 'usb' // USB D+/D- or USB-C PD CC1/CC2
  | 'adc' // Analog input capable
  | 'hstx' // RP235x high-speed TX pins (GPIO12-19)
  | 'qspi' // Dedicated flash QSPI pins
  | 'bonded' // Multiple internal GPIO pads bonded to one physical pin (e.g., CH32V003 SOP8)
  | '5v-tolerant'
  | 'boot';

export type PinType = 'io' | 'power' | 'reset' | 'boot' | 'nc' | 'mono';

export type PeripheralKind =
  | 'spi'
  | 'i2c'
  | 'usart'
  | 'tim'
  | 'pwm'
  | 'pio'
  | 'adc'
  | 'dac'
  | 'can'
  | 'usb'
  | 'sys'
  | 'other';

export interface PinSignal {
  peripheral: string;
  signal: string;
  af: number | null; // AF index (STM32) or FUNCSEL index (RP)
  funcLabel?: string; // Display override: e.g., "F1", "RM2", "AF7"
  remapId?: number; // Remap group index (0 = default, 1..N = remaps)
  resourceId?: string; // Shared hardware conflict key (e.g., "PWM0A", "EXTI0")
}

export interface PeripheralRemapOption {
  id: number; // 0, 1, 2, 3...
  name: string; // e.g., "Default (RM0)", "Partial Remap 1 (RM1)", "Full Remap (RM3)"
  registerNote?: string; // e.g., "AFIO_PCFR1.USART1_RM = 0b01"
  signals: Record<string, string>; // signal -> pinName (e.g., { TX: "PB6", RX: "PB7" })
}

export interface PinInfo {
  pos: string;
  name: string;
  type: PinType;
  signals: PinSignal[];
  bondedNames?: string[];
  tags?: PinTag[];
  note?: string;
}

export interface PackageInfo {
  name: string;
  kind: 'perimeter' | 'grid';
  pinCount: number;
  sides?: [number, number, number, number]; // [left, bottom, right, top]
  rows?: string[];
  cols?: number[];
  hasExposedPad?: boolean;
}

export interface PeripheralDma {
  signal: string;
  channels: string[];
}

export interface PeripheralInfo {
  kind: PeripheralKind;
  signals: string[];
  dma?: PeripheralDma[];
  remaps?: PeripheralRemapOption[];
}

export interface ChipPioConfig {
  instances: string[];
  stateMachinesPerInstance: number;
  gpioBaseOptions: number[];
}

export interface ChipData {
  id: string;
  vendor?: VendorId;
  muxModel?: MuxModel;
  family: string;
  core: string;
  flashKb: number;
  ramKb: number;
  package: PackageInfo;
  pins: PinInfo[];
  peripherals: Record<string, PeripheralInfo>;
  pio?: ChipPioConfig;
}

/** One upstream repository contributing data to a vendor. */
export interface CatalogVendorRepository {
  id: string;
  url?: string;
  commit: string;
  license: string;
}

/** Per-vendor provenance written to `meta.json.sources`. */
export interface CatalogVendorSource {
  commit?: string;
  openPinDataCommit?: string;
  version?: string;
  license?: string;
  chipCount: number;
  /** Match and coverage percentages for this vendor, both in the range 0-100. */
  ratios?: { match: number; coverage: number };
  repositories?: CatalogVendorRepository[];
}

/** Stable identifiers of the seven upstream sources recorded by the gate. */
export type CatalogSourceId =
  | 'st-open-pin-data'
  | 'stm32-data-generated'
  | 'ch32-device-data'
  | 'kicad'
  | 'pico-sdk'
  | 'zephyr'
  | 'raspberry-pi-docs';

/** The seven upstream source identifiers in deterministic order. */
export const CATALOG_SOURCE_IDS: readonly CatalogSourceId[] = [
  'st-open-pin-data',
  'stm32-data-generated',
  'ch32-device-data',
  'kicad',
  'pico-sdk',
  'zephyr',
  'raspberry-pi-docs',
];

/** One upstream source record keyed by a stable `CatalogSourceId`. */
export interface CatalogSourceRecord {
  /** Short git SHA or SHA-256 content hash of the fetched files. */
  sha: string;
  url: string;
  license: string;
}

/**
 * `meta.json.sources` holds both per-vendor summaries (legacy consumers) and
 * the seven canonical source records keyed by `CatalogSourceId`. The key sets
 * are disjoint, so both views coexist without ambiguity.
 */
export type CatalogMetaSources = Partial<Record<VendorId, CatalogVendorSource>> &
  Partial<Record<CatalogSourceId, CatalogSourceRecord>>;

export interface CatalogMeta {
  generatedAt: string;
  stm32DataCommit: string;
  openPinDataCommit: string;
  chipCount: number;
  matchRate?: number;
  families: string[];
  /** Vendors actually emitted in this build plus the seven source records. */
  sources?: CatalogMetaSources;
}

export interface CatalogPeripheralCounts {
  spi: number;
  i2c: number;
  usart: number;
  can: number;
  usb: number;
  tim: number;
  adc: number;
}

export interface CatalogIndexEntry {
  id: string;
  vendor?: VendorId;
  family: string;
  core: string;
  package: string;
  pinCount: number;
  flashKb: number;
  ramKb: number;
  peripherals: CatalogPeripheralCounts;
}

export interface PinAssignment {
  peripheral: string; // e.g. "SPI1" or "GPIO" or "PIO0"
  signal: string; // e.g. "SCK" or "Output" | "Input" | "Analog" | "EXTI"
  af: number | null;
  funcLabel?: string;
  remapId?: number;
  resourceId?: string;
}

export interface PioPinAssignment {
  instance: string; // e.g. "PIO0", "PIO1", "PIO2"
  sm?: number; // 0..3
  role?: string; // e.g. "TX", "CLK", "D0"
}

export interface WorkspaceState {
  mcuId: string;
  assignments: Record<string, PinAssignment>; // keyed by physical pin pos
  labels: Record<string, string>; // custom net names keyed by pos
  locked: Record<string, boolean>; // locked flags keyed by pos
  peripheralModes: Record<string, string>; // e.g. { SPI1: "full_duplex" }
  activeRemaps?: Record<string, number>; // peripheral -> selected remap ID
  pioAssignments?: Record<string, PioPinAssignment>; // physical pin pos -> PIO binding
}

export type PinVisualStatus = 'unused' | 'power' | 'assigned' | 'partial' | 'conflict';

export type PeripheralStatus = 'none' | 'partial' | 'active' | 'error';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** One signal relocation inside a coupled remap-group move. */
export interface RemapMove {
  signal: string;
  fromPos: string;
  toPos: string;
  af: number | null;
  funcLabel?: string;
  remapId?: number;
  resourceId?: string;
}

export interface OneHopFix {
  label: string;
  targetPeripheral: string;
  targetSignal: string;
  targetAf: number | null;
  targetPos: string;
  displacedFromPos: string;
  displacedToPos: string;
  displacedPeripheral: string;
  displacedSignal: string;
  displacedAf: number | null;
  /** Mux metadata of the target assignment, preserved by applyOneHopFix. */
  targetMetadata?: Partial<PinAssignment>;
  /** Mux metadata of the displaced assignment, preserved by applyOneHopFix. */
  displacedMetadata?: Partial<PinAssignment>;
  /** Set when the fix describes an atomic CH32-style remap-group move. */
  remapPeripheral?: string;
  remapId?: number;
  remapMoves?: RemapMove[];
}

export interface DiagnosticItem {
  id: string;
  severity: DiagnosticSeverity;
  code:
    | 'DUPLICATE_SIGNAL'
    | 'INVALID_PIN_SIGNAL'
    | 'SWD_REPURPOSED'
    | 'DEBUG_PIN_REPURPOSED'
    | 'HSE_CONFLICT'
    | 'INCOMPLETE_MODE'
    | 'DMA_CONTENTION'
    | 'RESOURCE_CONFLICT'
    | 'REMAP_MISMATCH'
    | 'REMAP_LOCKED'
    | 'PIO_GPIOBASE_CONFLICT'
    | 'BONDED_PIN_NOTE'
    | 'RP_HARDWARE_HINT';
  message: string;
  pins: string[];
  peripheral?: string;
  missingSignals?: string[];
  fix?: OneHopFix;
}

export interface AlternatePinCandidate {
  pos: string;
  pinName: string;
  af: number | null;
  funcLabel?: string;
  remapId?: number;
  resourceId?: string;
  status: 'free' | 'occupied' | 'locked';
  occupant?: PinAssignment;
}

export interface PeripheralModeTemplate {
  id: string;
  label: string;
  required: string[];
  optional?: string[];
  isChannelBased?: boolean;
}

export interface DmaAnalysisEntry {
  peripheral: string;
  signal: string;
  channels: string[];
  isMuxed: boolean;
  contendingWith: string[];
  status: 'ok' | 'shared' | 'contention';
}

export interface SolverReport {
  diagnostics: DiagnosticItem[];
  pinStatus: Record<string, PinVisualStatus>;
  peripheralStatus: Record<string, PeripheralStatus>;
  dmaAnalysis: DmaAnalysisEntry[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export const GPIO_MODES = ['Input', 'Output', 'Analog', 'EXTI'] as const;
export type GpioMode = (typeof GPIO_MODES)[number];

export function getChipVendor(chip: Pick<ChipData, 'vendor'>): VendorId {
  return chip.vendor ?? 'stm32';
}

export function getChipMuxModel(chip: Pick<ChipData, 'muxModel' | 'vendor'>): MuxModel {
  if (chip.muxModel) return chip.muxModel;
  const vendor = chip.vendor ?? 'stm32';
  if (vendor === 'ch32') return 'remap-group';
  if (vendor === 'rp') return 'funcsel-pio';
  return 'af';
}

export function formatMuxLabel(
  sig: Pick<PinSignal, 'af' | 'funcLabel' | 'remapId' | 'peripheral' | 'signal'>,
  muxModel?: MuxModel,
): string {
  if (sig.funcLabel) return sig.funcLabel;
  if (sig.peripheral === 'GPIO') return sig.signal;
  if (muxModel === 'funcsel-pio') {
    if (sig.af !== null) return `F${sig.af}`;
    return 'PIO';
  }
  if (muxModel === 'remap-group') {
    if (sig.remapId !== undefined) return `RM${sig.remapId}`;
    return 'AFIO';
  }
  return sig.af !== null ? `AF${sig.af}` : 'AFIO';
}

/**
 * Current PinCraft state schema version for project files and share links.
 * There is deliberately no version-1 import path: the multi-vendor schema
 * replaces it outright, and any other version is rejected by both codecs.
 */
export const PINCRAFT_STATE_VERSION = 2;

export type VendorId = 'stm32' | 'ch32' | 'rp' | 'esp32';

export type MuxModel =
  | 'af' // Independent per-pin alternate functions (most STM32)
  | 'remap-group' // Coupled peripheral AFIO remap slots (CH32)
  | 'funcsel-pio' // Per-pin FUNCSEL + shared PWM slices + flexible PIO (RP2040/RP235x)
  | 'gpio-matrix'; // ESP32 GPIO matrix: output fan-out, single-source inputs

export type PinTag =
  | 'debug-swd' // SWDIO / SWCLK
  | 'debug-sdi' // WCH 1-wire SWIO (e.g., PD1 on CH32V00x)
  | 'usb' // USB D+/D- or USB-C PD CC1/CC2
  | 'adc' // Analog input capable
  | 'hstx' // RP235x high-speed TX pins (GPIO12-19)
  | 'qspi' // Dedicated flash QSPI pins
  | 'bonded' // Multiple internal GPIO pads bonded to one physical pin (e.g., CH32V003 SOP8)
  | '5v-tolerant'
  | 'boot'
  | 'strapping' // Latched at reset; repurposing changes boot or startup behavior
  | 'input-only' // GPIO input pad with no output driver
  | 'adc-only' // Analog-only pad with no digital input path
  | 'rtc' // RTC-domain pad
  | 'lp' // Low-power pad retained in light or deep sleep
  | 'jtag' // JTAG tap pin
  | 'flash' // Reserved by the external flash interface
  | 'psram' // Reserved by external PSRAM
  | 'cap-restricted'; // Load capacitance restricts high-speed use

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
  /** Matrix route direction; absent means the conservative single-source rule. */
  direction?: 'input' | 'output';
  /** True when the signal reaches the pad through the direct IO_MUX path. */
  directRoute?: boolean;
  /** True when timing requires the direct IO_MUX path over a matrix route. */
  speedCritical?: boolean;
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
  /** Null for bare dies with no module flash capacity; never a guessed number. */
  flashKb: number | null;
  ramKb: number;
  package: PackageInfo;
  pins: PinInfo[];
  peripherals: Record<string, PeripheralInfo>;
  pio?: ChipPioConfig;
  /** Declared GPIO-matrix route capacity; absent means no limit is enforced. */
  matrixRouteCapacity?: number;
}

/** One upstream repository contributing data to a vendor. */
export interface CatalogVendorRepository {
  id: string;
  url?: string;
  commit: string;
  license: string;
}

/** An in-checkout upstream file consumed outside a source's manifest surface. */
export interface CatalogEvidenceFile {
  /** Upstream-relative path of the consumed file. */
  path: string;
  /** SHA-256 of the exact file bytes, lowercase hex. */
  sha256: string;
  rows: number;
  url: string;
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
  /** Additional declared upstream files consumed by this vendor's adapter. */
  evidenceFiles?: CatalogEvidenceFile[];
}

/** Stable identifiers of the eleven upstream sources recorded by the gate. */
export type CatalogSourceId =
  | 'st-open-pin-data'
  | 'stm32-data-generated'
  | 'ch32-device-data'
  | 'kicad'
  | 'pico-sdk'
  | 'zephyr'
  | 'raspberry-pi-docs'
  | 'esp-gpio-tool'
  | 'esp-hal-metadata'
  | 'espressif-kicad'
  | 'esp-idf';

/** The eleven upstream source identifiers in deterministic order. */
export const CATALOG_SOURCE_IDS: readonly CatalogSourceId[] = [
  'st-open-pin-data',
  'stm32-data-generated',
  'ch32-device-data',
  'kicad',
  'pico-sdk',
  'zephyr',
  'raspberry-pi-docs',
  'esp-gpio-tool',
  'esp-hal-metadata',
  'espressif-kicad',
  'esp-idf',
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
 * the eleven canonical source records keyed by `CatalogSourceId`. The key sets
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
  /** Vendors actually emitted in this build plus the eleven source records. */
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
  /** Mirrors the shard value; null only for bare dies without module flash. */
  flashKb: number | null;
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

/** Fixed output level values matching embedded-HAL naming. */
export const GPIO_OUTPUT_LEVELS = ['High', 'Low'] as const;
export type GpioOutputLevel = (typeof GPIO_OUTPUT_LEVELS)[number];

/** Fixed output drive modes matching embedded-HAL naming. */
export const GPIO_DRIVES = ['PushPull', 'OpenDrain'] as const;
export type GpioDrive = (typeof GPIO_DRIVES)[number];

/** Fixed pull-resistor settings matching embedded-HAL naming. */
export const GPIO_PULLS = ['None', 'Up', 'Down'] as const;
export type GpioPull = (typeof GPIO_PULLS)[number];

/** Fixed output speed settings matching embedded-HAL naming. */
export const GPIO_SPEEDS = ['Low', 'Medium', 'High', 'VeryHigh'] as const;
export type GpioSpeed = (typeof GPIO_SPEEDS)[number];

/**
 * Electrical settings for one configured GPIO. Kept as an optional map keyed
 * by physical position so workspaces that never edit these settings keep their
 * existing behavior and exports.
 */
export interface GpioConfig {
  outputLevel: GpioOutputLevel;
  drive: GpioDrive;
  pull: GpioPull;
  speed: GpioSpeed;
}

/** Validate an untrusted persisted value against the four fixed value sets. */
export function parseGpioConfig(value: unknown): GpioConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (!GPIO_OUTPUT_LEVELS.includes(rec.outputLevel as GpioOutputLevel)) return null;
  if (!GPIO_DRIVES.includes(rec.drive as GpioDrive)) return null;
  if (!GPIO_PULLS.includes(rec.pull as GpioPull)) return null;
  if (!GPIO_SPEEDS.includes(rec.speed as GpioSpeed)) return null;
  return {
    outputLevel: rec.outputLevel as GpioOutputLevel,
    drive: rec.drive as GpioDrive,
    pull: rec.pull as GpioPull,
    speed: rec.speed as GpioSpeed,
  };
}

/** Tabs available in the portrait workspace dock. */
export const DOCK_TABS = [
  'peripherals',
  'pins',
  'diagnostics',
  'dma',
  'pio',
  'audit',
] as const;
export type DockTab = (typeof DOCK_TABS)[number];

/**
 * Normalize an untrusted persisted dock tab. The portrait dock falls back to
 * Peripherals, so absent or unknown values never select a different pane.
 */
export function normalizeDockTab(value: unknown): DockTab {
  return typeof value === 'string' && (DOCK_TABS as readonly string[]).includes(value)
    ? (value as DockTab)
    : 'peripherals';
}

/** Tabs hosted by the right-hand summary drawer in both orientations. */
export const SUMMARY_TABS = [
  'pins',
  'diagnostics',
  'dma',
  'pio',
  'gpio',
  'audit',
] as const;
export type SummaryTab = (typeof SUMMARY_TABS)[number];

/** Normalize an untrusted persisted summary tab to its documented default. */
export function normalizeSummaryTab(value: unknown): SummaryTab {
  return typeof value === 'string' && (SUMMARY_TABS as readonly string[]).includes(value)
    ? (value as SummaryTab)
    : 'pins';
}

/**
 * Package view rotation in clockwise degrees. Four quarter turns are
 * selectable; absent or unrecognized values normalize to 0.
 */
export type PackageRotation = 0 | 90 | 180 | 270;

/**
 * Normalize an untrusted persisted rotation to the four-value clockwise domain.
 * The legacy counter-clockwise value -90 maps to 270 so earlier persisted and
 * shared states keep their visual orientation.
 */
export function normalizePackageRotation(value: unknown): PackageRotation {
  if (value === -90) return 270;
  return value === 0 || value === 90 || value === 180 || value === 270 ? value : 0;
}

/** Priority rings for the optional pin-placement overlay, high priority first. */
export const PLACEMENT_RINGS = ['high', 'medium', 'low'] as const;
export type PlacementRing = (typeof PLACEMENT_RINGS)[number];

/** Display labels for the three placement priority rings. */
export const PLACEMENT_RING_LABELS: Record<PlacementRing, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Fast inter-ring ordering; lower ranks are allocated first. */
export const PLACEMENT_RING_RANK: Record<PlacementRing, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Spatial ring names used by earlier version-2 payloads. Decode paths map these
 * onto the priority names above so existing links and project files stay valid.
 */
export const LEGACY_PLACEMENT_RINGS = ['inner', 'middle', 'outer'] as const;
export type LegacyPlacementRing = (typeof LEGACY_PLACEMENT_RINGS)[number];

/**
 * Opt-in placement preference for one peripheral. Storage is additive and
 * optional so workspaces without placement keep the original allocator path.
 */
export interface PinPlacementPreference {
  angle: number; // degrees from the package centre, 0 <= angle < 360
  ring: PlacementRing;
  enabled: boolean;
}

export interface WorkspaceState {
  mcuId: string;
  assignments: Record<string, PinAssignment>; // keyed by physical pin pos
  labels: Record<string, string>; // custom net names keyed by pos
  locked: Record<string, boolean>; // locked flags keyed by pos
  peripheralModes: Record<string, string>; // e.g. { SPI1: "full_duplex" }
  activeRemaps?: Record<string, number>; // peripheral -> selected remap ID
  pioAssignments?: Record<string, PioPinAssignment>; // physical pin pos -> PIO binding
  gpioConfig?: Record<string, GpioConfig>; // physical pin pos -> electrical settings
  placement?: Record<string, PinPlacementPreference>; // peripheral -> placement preference
  placementOverlayVisible?: boolean; // canvas overlay toggle, persisted with the state
  /** Additive view rotation; absent means the default 0-degree orientation. */
  packageRotation?: PackageRotation;
  /**
   * Display-only placement overlay rotation in degrees. Scoring geometry and
   * stored preference angles remain in package coordinates.
   */
  placementOverlayRotation?: number;
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
    | 'EXTI_LINE_CONFLICT'
    | 'REMAP_MISMATCH'
    | 'REMAP_LOCKED'
    | 'PIO_GPIOBASE_CONFLICT'
    | 'BONDED_PIN_NOTE'
    | 'RP_HARDWARE_HINT'
    | 'STRAPPING_REPURPOSED'
    | 'INPUT_ONLY_OUTPUT'
    | 'ADC2_WIFI_CONFLICT'
    | 'MATRIX_ROUTE_LIMIT';
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
  if (vendor === 'esp32') return 'gpio-matrix';
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
  if (muxModel === 'gpio-matrix') return sig.signal;
  return sig.af !== null ? `AF${sig.af}` : 'AFIO';
}

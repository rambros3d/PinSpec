/**
 * Pure, DOM-free presentation helpers shared by multi-vendor UI components.
 * Mux labels come from `formatMuxLabel` in `types.ts`; these helpers only
 * cover vendor badges, RP GPIOBASE windows and remap summaries.
 */

import type {
  CatalogIndexEntry,
  CatalogMeta,
  PeripheralKind,
  PeripheralStatus,
  PinTag,
  VendorId,
} from './types';

/** Stable identifiers of the peripheral categories shown in the workspace tree. */
export type PeripheralCategoryId =
  | 'system'
  | 'analog'
  | 'timers'
  | 'programmable'
  | 'connectivity'
  | 'other';

/** One browsable category and the peripheral kinds it contains. */
export interface PeripheralCategory {
  id: PeripheralCategoryId;
  label: string;
  kinds: PeripheralKind[];
}

/**
 * Shared category table for the tree and the detail header. `kinds: ['pwm', 'pio']`
 * is the RP/CH32 programmable bucket; `other` is the collapsed catch-all.
 */
export const PERIPHERAL_CATEGORIES: readonly PeripheralCategory[] = [
  { id: 'system', label: 'System Core', kinds: ['sys'] },
  { id: 'analog', label: 'Analog', kinds: ['adc', 'dac'] },
  { id: 'timers', label: 'Timers', kinds: ['tim'] },
  { id: 'programmable', label: 'Programmable I/O', kinds: ['pwm', 'pio'] },
  { id: 'connectivity', label: 'Connectivity', kinds: ['spi', 'i2c', 'usart', 'can', 'usb'] },
  { id: 'other', label: 'Others', kinds: ['other'] },
];

/** Resolve the category that owns a peripheral kind. */
export function peripheralCategoryForKind(kind: PeripheralKind): PeripheralCategory {
  return PERIPHERAL_CATEGORIES.find((category) => category.kinds.includes(kind)) ?? PERIPHERAL_CATEGORIES[5];
}

/** Configured and unconfigured peripheral name lists, each sorted for display. */
export interface PeripheralPartition {
  configured: string[];
  unconfigured: string[];
}

function comparePeripheralNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * Partition peripheral names using solver status and selected modes.
 * A peripheral is configured when it has a status other than `none` or a mode
 * other than `disabled`; absent values and blank modes are unconfigured.
 */
export function partitionPeripherals(
  peripheralStatus: Record<string, PeripheralStatus>,
  peripheralModes: Record<string, string>,
): PeripheralPartition {
  const configured: string[] = [];
  const unconfigured: string[] = [];
  const names = new Set([...Object.keys(peripheralStatus), ...Object.keys(peripheralModes)]);
  for (const name of names) {
    const status = peripheralStatus[name];
    const mode = peripheralModes[name];
    const hasStatus = status !== undefined && status !== 'none';
    const hasMode = typeof mode === 'string' && mode.trim().length > 0 && mode !== 'disabled';
    (hasStatus || hasMode ? configured : unconfigured).push(name);
  }
  configured.sort(comparePeripheralNames);
  unconfigured.sort(comparePeripheralNames);
  return { configured, unconfigured };
}

/** Order names configured-first while preserving alphabetical order in each group. */
export function orderPeripheralNames(names: string[], partition: PeripheralPartition): string[] {
  const configured = new Set(partition.configured);
  return [...names].sort((a, b) => {
    const rankA = configured.has(a) ? 0 : 1;
    const rankB = configured.has(b) ? 0 : 1;
    return rankA - rankB || comparePeripheralNames(a, b);
  });
}

/** Human-readable, monochrome pill text for every supported pin tag. */
export const PIN_TAG_LABELS: Record<PinTag, string> = {
  'debug-sdi': 'SWIO',
  'debug-swd': 'SWD',
  nfc: 'NFC',
  usb: 'USB',
  adc: 'ADC',
  hstx: 'HSTX',
  qspi: 'QSPI',
  bonded: 'BONDED',
  '5v-tolerant': '5V',
  boot: 'BOOT',
  strapping: 'STRAP',
  'input-only': 'INPUT',
  'adc-only': 'ADC ONLY',
  rtc: 'RTC',
  lp: 'LP',
  jtag: 'JTAG',
  flash: 'FLASH',
  psram: 'PSRAM',
  'cap-restricted': 'CAP',
};

/** Stable display order for tag pills. */
export const PIN_TAG_ORDER: PinTag[] = [
  'debug-sdi',
  'debug-swd',
  'nfc',
  'hstx',
  'qspi',
  'usb',
  'adc',
  'bonded',
  '5v-tolerant',
  'boot',
  'strapping',
  'input-only',
  'adc-only',
  'rtc',
  'lp',
  'jtag',
  'flash',
  'psram',
  'cap-restricted',
];

/** Sort and de-duplicate tags for consistent rendering across views. */
export function orderedPinTags(tags: PinTag[] | undefined): PinTag[] {
  if (!tags?.length) return [];
  const unique = new Set(tags);
  return PIN_TAG_ORDER.filter((tag) => unique.has(tag));
}

/** Format one RP GPIOBASE window as an inclusive GPIO range. */
export function formatGpioWindow(base: number): string {
  return `GPIO${base}-${base + 31}`;
}

/** Parse the GPIO number from a generated RP pad name such as "GPIO16". */
export function gpioNumberFromPinName(name: string): number | null {
  const match = name.match(/^GPIO(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

/** True when a GPIO number falls inside at least one valid GPIOBASE window. */
export function isGpioInWindows(gpio: number, bases: number[]): boolean {
  return bases.some((base) => gpio >= base && gpio < base + 32);
}

/** Compact `SIGNAL:PAD` summary for one remap option. */
export function summarizeRemapSignals(signals: Record<string, string>, maxItems = 5): string {
  const items = Object.entries(signals).map(([signal, pin]) => `${signal}:${pin}`);
  const shown = items.slice(0, maxItems).join(', ');
  return items.length > maxItems ? `${shown} +${items.length - maxItems}` : shown;
}

export interface VendorTab {
  id: VendorId | 'all';
  label: string;
  count: number;
}

/**
 * Build vendor tabs with per-vendor counts from `meta.json.sources`, falling
 * back to the compact index, and the total from the index itself.
 */
export function buildVendorTabs(meta: CatalogMeta | null, index: CatalogIndexEntry[]): VendorTab[] {
  const vendors: VendorId[] = ['stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic'];
  const allLabel = 'All';
  return [
    { id: 'all', label: allLabel, count: index.length },
    ...vendors.map((vendor) => ({
      id: vendor,
      label: vendor.toUpperCase(),
      count:
        meta?.sources?.[vendor]?.chipCount ??
        index.filter((entry) => (entry.vendor ?? 'stm32') === vendor).length,
    })),
  ];
}

/** Distinct, sorted family names present in the generated index. */
export function catalogFamilies(entries: CatalogIndexEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.family))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

/** Distinct package families (LQFP, QFN, SOP, TSSOP, BGA, ...) in the index. */
export function catalogPackageKinds(entries: CatalogIndexEntry[]): string[] {
  const kinds = new Set<string>();
  for (const entry of entries) {
    const name = entry.package.toUpperCase();
    const match = name.match(/^[A-Z]+/);
    if (match) kinds.add(match[0]);
  }
  return Array.from(kinds).sort();
}

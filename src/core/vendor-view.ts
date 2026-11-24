/**
 * Pure, DOM-free presentation helpers shared by multi-vendor UI components.
 * Mux labels come from `formatMuxLabel` in `types.ts`; these helpers only
 * cover vendor badges, RP GPIOBASE windows and remap summaries.
 */

import type { CatalogIndexEntry, CatalogMeta, PinTag, VendorId } from './types';

/** Curated hero chips, one per vendor, each loaded from generated data. */
export const HERO_CHIPS: Array<{ vendor: VendorId; id: string; label: string }> = [
  { vendor: 'stm32', id: 'STM32G431CBU6', label: 'STM32G431' },
  { vendor: 'ch32', id: 'CH32V203C8T6', label: 'CH32V203' },
  { vendor: 'rp', id: 'RP2350B', label: 'RP2350B' },
];

/** Human-readable, monochrome pill text for every supported pin tag. */
export const PIN_TAG_LABELS: Record<PinTag, string> = {
  'debug-sdi': 'SWIO',
  'debug-swd': 'SWD',
  usb: 'USB',
  adc: 'ADC',
  hstx: 'HSTX',
  qspi: 'QSPI',
  bonded: 'BONDED',
  '5v-tolerant': '5V',
  boot: 'BOOT',
};

/** Stable display order for tag pills. */
export const PIN_TAG_ORDER: PinTag[] = [
  'debug-sdi',
  'debug-swd',
  'hstx',
  'qspi',
  'usb',
  'adc',
  'bonded',
  '5v-tolerant',
  'boot',
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
 * Build vendor tabs with live counts from `meta.json.sources` and a fallback
 * count from the compact index when a vendor is missing from metadata.
 */
export function buildVendorTabs(meta: CatalogMeta | null, index: CatalogIndexEntry[]): VendorTab[] {
  const vendors: VendorId[] = ['stm32', 'ch32', 'rp'];
  const allLabel = 'All';
  return [
    { id: 'all', label: allLabel, count: meta?.chipCount ?? index.length },
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

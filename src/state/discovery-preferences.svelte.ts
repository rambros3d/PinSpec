/**
 * Browser-local preferences for catalog and quick-search discovery filters.
 *
 * Query, vendor, family and package filters are presentation state: they stay
 * in localStorage under a dedicated key and never enter share URLs, version-2
 * project files, recent-session state, or undo history. The two groups are
 * independent, so a quick-search filter does not change the catalog route.
 */

import type { VendorId } from '../core/types';

export const DISCOVERY_PREFERENCES_STORAGE_KEY = 'pincraft:discovery_preferences_v1';

const VENDOR_IDS: readonly VendorId[] = [
  'stm32',
  'ch32',
  'rp',
  'esp32',
  'microchip',
  'nordic',
];

export interface DiscoveryFilterSnapshot {
  query: string;
  vendor: VendorId | 'all';
  family: string;
  package: string;
}

export function defaultDiscoveryFilter(): DiscoveryFilterSnapshot {
  return { query: '', vendor: 'all', family: '', package: '' };
}

/** Unrecognized or non-string values fall back to the documented default. */
export function normalizeDiscoveryVendor(value: unknown): VendorId | 'all' {
  return typeof value === 'string' &&
    (value === 'all' || (VENDOR_IDS as readonly string[]).includes(value))
    ? (value as VendorId | 'all')
    : 'all';
}

/** Non-string values fall back to an empty filter. */
export function normalizeDiscoveryText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeDiscoveryFilter(value: unknown): DiscoveryFilterSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultDiscoveryFilter();
  }
  const record = value as Record<string, unknown>;
  return {
    query: normalizeDiscoveryText(record.query),
    vendor: normalizeDiscoveryVendor(record.vendor),
    family: normalizeDiscoveryText(record.family),
    package: normalizeDiscoveryText(record.package),
  };
}

interface StoredDiscoveryPreferences {
  catalog?: unknown;
  quickSearch?: unknown;
}

/** Read the namespaced record, tolerating missing or unavailable storage. */
function readStoredPreferences(): StoredDiscoveryPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage?.getItem(DISCOVERY_PREFERENCES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredDiscoveryPreferences;
  } catch {
    return {};
  }
}

/** One independent filter group. Each setter normalizes before persisting. */
class DiscoveryFilterGroup {
  private filter = $state<DiscoveryFilterSnapshot>(defaultDiscoveryFilter());

  constructor(
    private readonly persist: () => void,
    stored: unknown,
  ) {
    this.filter = normalizeDiscoveryFilter(stored);
  }

  get query(): string {
    return this.filter.query;
  }

  set query(value: string) {
    const next = normalizeDiscoveryText(value);
    if (this.filter.query === next) return;
    this.filter.query = next;
    this.persist();
  }

  get vendor(): VendorId | 'all' {
    return this.filter.vendor;
  }

  set vendor(value: VendorId | 'all') {
    const next = normalizeDiscoveryVendor(value);
    if (this.filter.vendor === next) return;
    this.filter.vendor = next;
    this.persist();
  }

  get family(): string {
    return this.filter.family;
  }

  set family(value: string) {
    const next = normalizeDiscoveryText(value);
    if (this.filter.family === next) return;
    this.filter.family = next;
    this.persist();
  }

  get package(): string {
    return this.filter.package;
  }

  set package(value: string) {
    const next = normalizeDiscoveryText(value);
    if (this.filter.package === next) return;
    this.filter.package = next;
    this.persist();
  }

  /** Restore all four fields to their defaults in one persisted write. */
  reset(): void {
    this.filter = defaultDiscoveryFilter();
    this.persist();
  }

  /** Return a plain snapshot for the localStorage record. */
  snapshot(): DiscoveryFilterSnapshot {
    return { ...this.filter };
  }
}

/** Runes-backed store restored from localStorage on construction. */
export class DiscoveryPreferencesStore {
  readonly catalog: DiscoveryFilterGroup;
  readonly quickSearch: DiscoveryFilterGroup;

  constructor() {
    const stored = readStoredPreferences();
    const persist = (): void => this.persist();
    this.catalog = new DiscoveryFilterGroup(persist, stored.catalog);
    this.quickSearch = new DiscoveryFilterGroup(persist, stored.quickSearch);
  }

  /** Write both groups; storage failures never affect discovery UI. */
  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(
        DISCOVERY_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          catalog: this.catalog.snapshot(),
          quickSearch: this.quickSearch.snapshot(),
        }),
      );
    } catch {
      // Storage may be disabled or full; in-memory filters still apply.
    }
  }
}

/** Single shared instance used by the catalog route and quick-search bar. */
export const discoveryPreferences = new DiscoveryPreferencesStore();

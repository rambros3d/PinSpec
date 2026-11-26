/**
 * Browser-local preferences for catalog and quick-search discovery filters.
 *
 * Query, vendor, family and package filters are presentation state: they stay
 * in localStorage under a dedicated key and never enter share URLs, version-2
 * project files, recent-session state, or undo history. The two groups are
 * independent, so a quick-search filter does not change the catalog route.
 */

import type { VendorId } from '../core/types';
import { createPersistedPreference } from './persisted-preference.svelte';

export const DISCOVERY_PREFERENCES_STORAGE_KEY = 'pinspec:discovery_preferences_v1';

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

/** One independent filter group. Each setter normalizes before persisting. */
class DiscoveryFilterGroup {
  private readonly filterPreference: ReturnType<typeof createPersistedPreference<DiscoveryFilterSnapshot>>;

  constructor(groupField: string) {
    this.filterPreference = createPersistedPreference<DiscoveryFilterSnapshot>(
      DISCOVERY_PREFERENCES_STORAGE_KEY,
      defaultDiscoveryFilter(),
      normalizeDiscoveryFilter,
      groupField,
    );
  }

  get query(): string {
    return this.filterPreference.value.query;
  }

  set query(value: string) {
    const next = normalizeDiscoveryText(value);
    if (this.query === next) return;
    this.filterPreference.set({ ...this.filterPreference.value, query: next });
  }

  get vendor(): VendorId | 'all' {
    return this.filterPreference.value.vendor;
  }

  set vendor(value: VendorId | 'all') {
    const next = normalizeDiscoveryVendor(value);
    if (this.vendor === next) return;
    this.filterPreference.set({ ...this.filterPreference.value, vendor: next });
  }

  get family(): string {
    return this.filterPreference.value.family;
  }

  set family(value: string) {
    const next = normalizeDiscoveryText(value);
    if (this.family === next) return;
    this.filterPreference.set({ ...this.filterPreference.value, family: next });
  }

  get package(): string {
    return this.filterPreference.value.package;
  }

  set package(value: string) {
    const next = normalizeDiscoveryText(value);
    if (this.package === next) return;
    this.filterPreference.set({ ...this.filterPreference.value, package: next });
  }

  /** Restore all four fields to their defaults in one persisted write. */
  reset(): void {
    this.filterPreference.set(defaultDiscoveryFilter());
  }

  /** Return a plain snapshot for the localStorage record. */
  snapshot(): DiscoveryFilterSnapshot {
    return { ...this.filterPreference.value };
  }
}

/** Runes-backed store restored from localStorage on construction. */
export class DiscoveryPreferencesStore {
  readonly catalog: DiscoveryFilterGroup;
  readonly quickSearch: DiscoveryFilterGroup;

  constructor() {
    this.catalog = new DiscoveryFilterGroup('catalog');
    this.quickSearch = new DiscoveryFilterGroup('quickSearch');
  }
}

/** Single shared instance used by the catalog route and quick-search bar. */
export const discoveryPreferences = new DiscoveryPreferencesStore();

import { afterEach, describe, expect, it, vi } from 'vitest';

function installStorage(): Map<string, string> {
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  return storage;
}

/** A fresh module instance with fresh stores avoids cross-test singleton state. */
async function freshDiscoveryPreferences() {
  vi.resetModules();
  return import('../src/state/discovery-preferences.svelte.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('localStorage-only discovery preferences', () => {
  it('uses documented defaults for absent values', async () => {
    installStorage();
    const module = await freshDiscoveryPreferences();
    expect(module.DISCOVERY_PREFERENCES_STORAGE_KEY).toBe('pincraft:discovery_preferences_v1');
    const preferences = new module.DiscoveryPreferencesStore();
    for (const group of [preferences.catalog, preferences.quickSearch]) {
      expect(group.query).toBe('');
      expect(group.vendor).toBe('all');
      expect(group.family).toBe('');
      expect(group.package).toBe('');
    }
    expect(module.defaultDiscoveryFilter()).toEqual({
      query: '',
      vendor: 'all',
      family: '',
      package: '',
    });
  });

  it('normalizes malformed values and keeps the two groups independent', async () => {
    const storage = installStorage();
    storage.set(
      'pincraft:discovery_preferences_v1',
      JSON.stringify({
        catalog: { query: 42, vendor: 'unknown', family: null, package: ['QFN'] },
        quickSearch: { query: 'RP2040', vendor: 'rp', family: 'RP2350', package: 'QFN' },
      }),
    );
    const { DiscoveryPreferencesStore } = await freshDiscoveryPreferences();
    const preferences = new DiscoveryPreferencesStore();
    expect(preferences.catalog.query).toBe('');
    expect(preferences.catalog.vendor).toBe('all');
    expect(preferences.catalog.family).toBe('');
    expect(preferences.catalog.package).toBe('');
    expect(preferences.quickSearch.query).toBe('RP2040');
    expect(preferences.quickSearch.vendor).toBe('rp');

    preferences.catalog.query = 'STM32G431';
    preferences.catalog.vendor = 'stm32';
    preferences.catalog.family = 'G4';
    preferences.catalog.package = 'LQFP';
    const saved = JSON.parse(
      storage.get('pincraft:discovery_preferences_v1') ?? '{}',
    ) as Record<string, Record<string, unknown>>;
    expect(Object.keys(saved).sort()).toEqual(['catalog', 'quickSearch']);
    expect(saved.catalog).toEqual({
      query: 'STM32G431',
      vendor: 'stm32',
      family: 'G4',
      package: 'LQFP',
    });
    expect(saved.quickSearch.query).toBe('RP2040');
  });

  it('restores both groups after a simulated reload and resets only one group', async () => {
    const storage = installStorage();
    const first = await freshDiscoveryPreferences();
    const preferences = new first.DiscoveryPreferencesStore();
    preferences.catalog.query = 'CH32';
    preferences.quickSearch.package = 'SOP';

    vi.resetModules();
    const second = await import('../src/state/discovery-preferences.svelte.ts');
    const reloaded = new second.DiscoveryPreferencesStore();
    expect(reloaded.catalog.query).toBe('CH32');
    expect(reloaded.quickSearch.package).toBe('SOP');
    reloaded.catalog.reset();
    expect(reloaded.catalog.query).toBe('');
    expect(reloaded.quickSearch.package).toBe('SOP');
    const saved = JSON.parse(
      storage.get('pincraft:discovery_preferences_v1') ?? '{}',
    ) as Record<string, Record<string, unknown>>;
    expect(saved.catalog).toEqual({ query: '', vendor: 'all', family: '', package: '' });
  });

  it('accepts only known vendor identifiers', async () => {
    installStorage();
    const module = await freshDiscoveryPreferences();
    for (const vendor of ['stm32', 'ch32', 'rp', 'esp32', 'microchip', 'nordic'] as const) {
      expect(module.normalizeDiscoveryVendor(vendor)).toBe(vendor);
    }
    expect(module.normalizeDiscoveryVendor('all')).toBe('all');
    for (const value of [undefined, null, 7, {}, 'unknown', 'ALL']) {
      expect(module.normalizeDiscoveryVendor(value)).toBe('all');
    }
    expect(module.normalizeDiscoveryText(undefined)).toBe('');
    expect(module.normalizeDiscoveryText('G4')).toBe('G4');
  });

  it('keeps filters in memory when localStorage is unavailable', async () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('storage disabled');
      },
    });
    const { DiscoveryPreferencesStore } = await freshDiscoveryPreferences();
    const preferences = new DiscoveryPreferencesStore();
    expect(() => {
      preferences.catalog.query = 'STM32';
      preferences.catalog.vendor = 'stm32';
      preferences.quickSearch.family = 'RP2350';
    }).not.toThrow();
    expect(preferences.catalog.vendor).toBe('stm32');
    expect(preferences.quickSearch.family).toBe('RP2350');
    expect(() => preferences.catalog.reset()).not.toThrow();
    expect(preferences.catalog.vendor).toBe('all');
  });

  it('never writes discovery filters into share links or project files', async () => {
    installStorage();
    const { DiscoveryPreferencesStore } = await freshDiscoveryPreferences();
    const preferences = new DiscoveryPreferencesStore();
    preferences.catalog.query = 'STM32G431';
    preferences.catalog.vendor = 'stm32';
    preferences.catalog.family = 'G4';
    preferences.catalog.package = 'LQFP';
    preferences.quickSearch.query = 'RP2040';

    const { encodeWorkspaceState, decodeWorkspaceState } = await import(
      '../src/core/url-state'
    );
    const { exportPinoutJson } = await import('../src/core/exporters/json');
    const { createEmptyWorkspace } = await import('../src/core/solver');
    const state = createEmptyWorkspace('STM32G431CBU6');
    const encoded = encodeWorkspaceState(state);
    expect(decodeWorkspaceState(encoded).ok).toBe(true);
    const project = exportPinoutJson(state);
    for (const field of ['query', 'vendorFilter', 'familyFilter', 'packageFilter', 'discovery']) {
      expect(encoded).not.toContain(field);
      expect(project).not.toContain(field);
      expect(Object.keys(state)).not.toContain(field);
    }
  });
});

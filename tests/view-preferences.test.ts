import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIEW_PREFERENCES_STORAGE_KEY } from '../src/state/workspace-preferences.svelte';

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

/** A fresh module instance with a fresh store avoids cross-test singleton state. */
async function freshPreferences() {
  vi.resetModules();
  return import('../src/state/workspace-preferences.svelte.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('localStorage-only view preferences', () => {
  it('uses documented defaults for absent values', async () => {
    installStorage();
    const { WorkspacePreferencesStore } = await freshPreferences();
    const preferences = new WorkspacePreferencesStore();
    expect(preferences.selectedPeripheral).toBeNull();
    expect(preferences.filterText).toBe('');
    expect(preferences.summaryTab).toBe('pins');
    expect(preferences.dockTab).toBe('peripherals');
    expect(preferences.isCategoryOpen('system')).toBe(true);
    expect(preferences.isCategoryOpen('other')).toBe(false);
  });

  it('restores values from a fresh instance after a simulated reload', async () => {
    const storage = installStorage();
    const { WorkspacePreferencesStore } = await freshPreferences();
    const first = new WorkspacePreferencesStore();
    first.selectedPeripheral = 'SPI1';
    first.filterText = 'SPI';
    first.setCategoryOpen('analog', true);
    first.setCategoryOpen('system', false);
    first.summaryTab = 'configuration';
    first.dockTab = 'configuration';

    const raw = storage.get(VIEW_PREFERENCES_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual([
      'dockTab',
      'filterText',
      'openCategories',
      'selectedPeripheral',
      'summaryTab',
    ]);

    const second = new WorkspacePreferencesStore();
    expect(second.selectedPeripheral).toBe('SPI1');
    expect(second.filterText).toBe('SPI');
    expect(second.isCategoryOpen('analog')).toBe(true);
    expect(second.isCategoryOpen('system')).toBe(false);
    expect(second.isCategoryOpen('other')).toBe(false);
    expect(second.summaryTab).toBe('configuration');
    expect(second.dockTab).toBe('configuration');
  });

  it('falls back to defaults for unknown stored values', async () => {
    const storage = installStorage();
    storage.set(
      VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        selectedPeripheral: 42,
        filterText: null,
        openCategories: { other: 'yes', timers: false },
        summaryTab: 'missing',
        dockTab: 'unknown',
      }),
    );
    const { WorkspacePreferencesStore } = await freshPreferences();
    const preferences = new WorkspacePreferencesStore();
    expect(preferences.selectedPeripheral).toBeNull();
    expect(preferences.filterText).toBe('');
    expect(preferences.isCategoryOpen('other')).toBe(false);
    expect(preferences.isCategoryOpen('timers')).toBe(false);
    expect(preferences.summaryTab).toBe('pins');
    expect(preferences.dockTab).toBe('peripherals');
  });

  it('accepts all dock tabs and remains usable when storage is unavailable', async () => {
    installStorage();
    const { WorkspacePreferencesStore, VIEW_PREFERENCES_STORAGE_KEY: key } = await freshPreferences();
    const preferences = new WorkspacePreferencesStore();
    for (const tab of ['peripherals', 'pins', 'configuration', 'diagnostics', 'dma', 'pio', 'audit'] as const) {
      preferences.dockTab = tab;
      expect(preferences.dockTab).toBe(tab);
    }
    expect(JSON.parse(window.localStorage.getItem(key) ?? '{}').dockTab).toBe('audit');

    vi.stubGlobal('window', {});
    const { WorkspacePreferencesStore: OfflineStore } = await freshPreferences();
    const offline = new OfflineStore();
    expect(offline.dockTab).toBe('peripherals');
    expect(() => {
      offline.selectedPeripheral = 'SPI1';
      offline.filterText = 'SPI';
      offline.dockTab = 'configuration';
    }).not.toThrow();
    expect(offline.selectedPeripheral).toBe('SPI1');
    expect(offline.dockTab).toBe('configuration');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHELL_PREFERENCES_STORAGE_KEY } from '../src/state/shell-preferences.svelte';
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
    expect(preferences.placementOverlayVisible).toBe(false);
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
    first.placementOverlayVisible = true;
    first.summaryTab = 'placement';
    first.dockTab = 'placement';

    const raw = storage.get(VIEW_PREFERENCES_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual([
      'dockTab',
      'filterText',
      'openCategories',
      'placementOverlayVisible',
      'selectedPeripheral',
      'summaryTab',
    ]);

    const second = new WorkspacePreferencesStore();
    expect(second.selectedPeripheral).toBe('SPI1');
    expect(second.filterText).toBe('SPI');
    expect(second.isCategoryOpen('analog')).toBe(true);
    expect(second.isCategoryOpen('system')).toBe(false);
    expect(second.isCategoryOpen('other')).toBe(false);
    expect(second.placementOverlayVisible).toBe(true);
    expect(second.summaryTab).toBe('placement');
    expect(second.dockTab).toBe('placement');
  });

  it('falls back to defaults for unknown stored values', async () => {
    const storage = installStorage();
    storage.set(
      VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        selectedPeripheral: 42,
        filterText: null,
        openCategories: { other: 'yes', timers: false },
        placementOverlayVisible: 'yes',
        summaryTab: 'missing',
        dockTab: 'unknown',
        sidebarSection: 'place',
      }),
    );
    const { WorkspacePreferencesStore } = await freshPreferences();
    const preferences = new WorkspacePreferencesStore();
    expect(preferences.selectedPeripheral).toBeNull();
    expect(preferences.filterText).toBe('');
    expect(preferences.placementOverlayVisible).toBe(false);
    expect(preferences.isCategoryOpen('other')).toBe(false);
    expect(preferences.isCategoryOpen('timers')).toBe(false);
    expect(preferences.summaryTab).toBe('pins');
    expect(preferences.dockTab).toBe('peripherals');
  });

  it('keeps shareable project names in recent sessions and out of shell preferences', async () => {
    installStorage();
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');
    catalogStore.primeChip({
      id: 'STM32G431CBU6',
      family: 'STM32G4',
      muxModel: 'af',
      core: 'Cortex-M4',
      flashKb: 128,
      ramKb: 32,
      package: { name: 'UFQFPN48', kind: 'perimeter', pinCount: 2, sides: [1, 0, 1, 0] },
      pins: [],
      peripherals: {},
    });
    await workspaceStore.openMcu('STM32G431CBU6');
    workspaceStore.renameProject('  Saved Name  ');

    const recent = JSON.parse(
      window.localStorage.getItem('pincraft:recent_sessions_v1') ?? '[]',
    ) as Array<{ state: { projectName?: string } }>;
    expect(recent[0].state.projectName).toBe('saved-name');

    const { ShellPreferencesStore } = await import('../src/state/shell-preferences.svelte.ts');
    const shell = new ShellPreferencesStore();
    shell.sidebarExpanded = true;
    const storedShell = window.localStorage.getItem(SHELL_PREFERENCES_STORAGE_KEY) ?? '{}';
    expect(storedShell).not.toContain('projectName');
    expect(storedShell).not.toContain('saved-name');
    expect(window.localStorage.getItem(VIEW_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it('accepts all drawer and dock tabs and remains usable when storage is unavailable', async () => {
    installStorage();
    const { WorkspacePreferencesStore, VIEW_PREFERENCES_STORAGE_KEY: key } = await freshPreferences();
    const preferences = new WorkspacePreferencesStore();
    for (const tab of ['peripherals', 'pins', 'diagnostics', 'dma', 'pio', 'placement', 'audit'] as const) {
      preferences.dockTab = tab;
      expect(preferences.dockTab).toBe(tab);
    }
    for (const tab of ['pins', 'diagnostics', 'dma', 'pio', 'gpio', 'placement', 'audit'] as const) {
      preferences.summaryTab = tab;
      expect(preferences.summaryTab).toBe(tab);
    }
    expect(JSON.parse(window.localStorage.getItem(key) ?? '{}').dockTab).toBe('audit');

    vi.stubGlobal('window', {});
    const { WorkspacePreferencesStore: OfflineStore } = await freshPreferences();
    const offline = new OfflineStore();
    expect(offline.dockTab).toBe('peripherals');
    expect(offline.placementOverlayVisible).toBe(false);
    expect(() => {
      offline.selectedPeripheral = 'SPI1';
      offline.filterText = 'SPI';
      offline.dockTab = 'dma';
      offline.placementOverlayVisible = true;
    }).not.toThrow();
    expect(offline.selectedPeripheral).toBe('SPI1');
    expect(offline.dockTab).toBe('dma');
    expect(offline.placementOverlayVisible).toBe(true);
  });
});

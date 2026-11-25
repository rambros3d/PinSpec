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

/** A fresh module instance with a fresh store avoids cross-test singleton state. */
async function freshShellPreferences() {
  vi.resetModules();
  return import('../src/state/shell-preferences.svelte.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('localStorage-only shell preferences', () => {
  it('uses a collapsed sidebar when no value is stored', async () => {
    installStorage();
    const { ShellPreferencesStore, SHELL_PREFERENCES_STORAGE_KEY } = await freshShellPreferences();
    expect(SHELL_PREFERENCES_STORAGE_KEY).toBe('pincraft:shell_preferences_v1');
    const preferences = new ShellPreferencesStore();
    expect(preferences.sidebarExpanded).toBe(false);
  });

  it('restores the sidebar state after reload and writes one namespaced field', async () => {
    const storage = installStorage();
    const first = await freshShellPreferences();
    const preferences = new first.ShellPreferencesStore();
    preferences.sidebarExpanded = true;
    expect(JSON.parse(storage.get('pincraft:shell_preferences_v1') ?? '{}')).toEqual({
      sidebarExpanded: true,
    });

    vi.resetModules();
    const second = await import('../src/state/shell-preferences.svelte.ts');
    const reloaded = new second.ShellPreferencesStore();
    expect(reloaded.sidebarExpanded).toBe(true);
  });

  it('normalizes unknown sidebar values to collapsed', async () => {
    const storage = installStorage();
    storage.set('pincraft:shell_preferences_v1', JSON.stringify({ sidebarExpanded: 'yes' }));
    const { ShellPreferencesStore } = await freshShellPreferences();
    const preferences = new ShellPreferencesStore();
    expect(preferences.sidebarExpanded).toBe(false);
  });

  it('keeps values in memory when localStorage is unavailable', async () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('storage disabled');
      },
    });
    const { ShellPreferencesStore } = await freshShellPreferences();
    const preferences = new ShellPreferencesStore();
    expect(preferences.sidebarExpanded).toBe(false);
    expect(() => {
      preferences.sidebarExpanded = true;
    }).not.toThrow();
    expect(preferences.sidebarExpanded).toBe(true);
  });

  it('never writes shell fields to share links or project files', async () => {
    installStorage();
    const { ShellPreferencesStore } = await freshShellPreferences();
    const preferences = new ShellPreferencesStore();
    preferences.sidebarExpanded = true;
    const { encodeWorkspaceState, decodeWorkspaceState } = await import('../src/core/url-state');
    const { exportPinoutJson } = await import('../src/core/exporters/json');
    const { createEmptyWorkspace } = await import('../src/core/solver');
    const state = createEmptyWorkspace('STM32G431CBU6');
    const encoded = encodeWorkspaceState(state);
    expect(encoded).not.toContain('sidebar');
    expect(decodeWorkspaceState(encoded).ok).toBe(true);
    const project = exportPinoutJson(state);
    expect(project).not.toContain('sidebarExpanded');
    expect(Object.keys(state)).not.toContain('sidebarExpanded');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The sidebar expansion preference is retired with the sidebar. This suite keeps
 * coverage on the replacement contract: no shell key is written and no shell
 * field enters share URLs, project files, or recent sessions.
 */
describe('retired shell preference contract', () => {
  it('removes the sidebar store and its storage key from the application', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/state/shell-preferences.svelte.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/components/shell/GlobalSidebar.svelte'))).toBe(false);
    for (const rel of [
      'README.md',
      'AGENTS.md',
      'src/app.css',
      'src/components/shell/AppShell.svelte',
      'src/components/shell/GlobalNavBar.svelte',
      'src/components/shell/WorkspaceTopBar.svelte',
    ]) {
      expect(read(rel), rel).not.toContain('pinspec:shell_preferences_v1');
      expect(read(rel), rel).not.toContain('sidebarExpanded');
    }
    for (const removed of ['.shell-panel', '.shell-rail', '.shell-backdrop']) {
      expect(read('src/app.css'), removed).not.toContain(removed);
    }
  });

  it('writes no shell field while discovery filters still persist locally', async () => {
    const storage = installStorage();
    vi.resetModules();
    const { discoveryPreferences } = await import('../src/state/discovery-preferences.svelte.ts');
    discoveryPreferences.catalog.query = 'RP2040';
    const keys = [...storage.keys()];
    expect(keys).not.toContain('pinspec:shell_preferences_v1');
    expect(keys).toContain('pinspec:discovery_preferences_v1');
  });

  it('never writes shell fields to share links or project files', async () => {
    installStorage();
    const { encodeWorkspaceState } = await import('../src/core/url-state');
    const { exportPinoutJson } = await import('../src/core/exporters/json');
    const { createEmptyWorkspace } = await import('../src/core/solver');
    const state = createEmptyWorkspace('STM32G431CBU6');
    const encoded = encodeWorkspaceState(state);
    expect(encoded).not.toContain('sidebar');
    expect(encoded).not.toContain('navigation');
    const { decodeWorkspaceState } = await import('../src/core/url-state');
    expect(decodeWorkspaceState(encoded).ok).toBe(true);
    const project = exportPinoutJson(state);
    expect(project).not.toContain('sidebarExpanded');
    expect(Object.keys(state)).not.toContain('sidebarExpanded');
  });

  it('retires overlay visibility from localStorage view preferences', async () => {
    installStorage();
    vi.resetModules();
    const { WorkspacePreferencesStore, VIEW_PREFERENCES_STORAGE_KEY } = await import(
      '../src/state/workspace-preferences.svelte.ts'
    );
    const preferences = new WorkspacePreferencesStore();
    preferences.dockTab = 'placement';
    const raw = window.localStorage.getItem(VIEW_PREFERENCES_STORAGE_KEY) ?? '{}';
    expect(raw).not.toContain('placementOverlayVisible');
    expect(raw).toContain('dockTab');
    expect(read('src/state/workspace-preferences.svelte.ts')).not.toContain(
      'placementOverlayVisible',
    );
  });

  it('keeps recent sessions free of navigation fields', async () => {
    installStorage();
    vi.resetModules();
    const { workspaceStore } = await import('../src/state/workspace.svelte.ts');
    const { catalogStore } = await import('../src/state/catalog.svelte.ts');
    const { stubCatalogChips } = await import('./helpers/catalog-stub');
    stubCatalogChips(catalogStore, {
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
    const recent = JSON.parse(
      window.localStorage.getItem('pinspec:recent_sessions_v1') ?? '[]',
    ) as Array<Record<string, unknown>>;
    expect(recent).toHaveLength(1);
    expect(JSON.stringify(recent)).not.toContain('sidebarExpanded');
    expect(JSON.stringify(recent)).not.toContain('navigation');
    expect(window.localStorage.getItem('pinspec:shell_preferences_v1')).toBeNull();
  });
});

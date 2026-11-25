import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MODE_LABELS,
  THEME_MODES,
  THEME_STORAGE_KEY,
  type ThemeId,
} from '../src/state/theme.svelte';
import { createEmptyWorkspace } from '../src/core/solver';
import { exportPinoutJson, parsePinoutJson } from '../src/core/exporters/json';
import { decodeWorkspaceState, encodeWorkspaceState } from '../src/core/url-state';

const ROOT = process.cwd();

interface StorageHarness {
  saved?: string | null;
  prefersDark?: boolean | null;
  throwOnStorage?: boolean;
}

function installWindow(options: StorageHarness = {}): {
  storage: Map<string, string>;
  matchMedia: ReturnType<typeof vi.fn> | null;
} {
  const storage = new Map<string, string>();
  if (options.saved) storage.set(THEME_STORAGE_KEY, options.saved);
  const localStorage = {
    getItem: (key: string): string | null => {
      if (options.throwOnStorage) throw new Error('Storage blocked');
      return storage.get(key) ?? null;
    },
    setItem: (key: string, value: string): void => {
      if (options.throwOnStorage) throw new Error('Storage blocked');
      storage.set(key, value);
    },
  };
  const matchMedia =
    options.prefersDark === undefined || options.prefersDark === null
      ? null
      : vi.fn((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)' ? options.prefersDark : false,
        }));
  const browser: Record<string, unknown> = { localStorage };
  if (matchMedia) browser.matchMedia = matchMedia;
  vi.stubGlobal('window', browser);
  return { storage, matchMedia };
}

function installDocument(): Record<string, string> {
  const dataset: Record<string, string> = {};
  vi.stubGlobal('document', { documentElement: { dataset } });
  return dataset;
}

/** A fresh module instance avoids cross-test singleton state. */
async function freshTheme() {
  vi.resetModules();
  return import('../src/state/theme.svelte.ts');
}

function source(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function inlineBootstrap(): string {
  const html = source('index.html');
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  if (!script) throw new Error('No inline bootstrap script in index.html');
  expect(html.indexOf('<script type="module"')).toBeGreaterThan(html.indexOf('<script>'));
  return script[1];
}

function runBootstrap(saved: string | null, prefersDark: boolean | null): string {
  const dataset: Record<string, string> = {};
  const storage = new Map<string, string>();
  if (saved) storage.set(THEME_STORAGE_KEY, saved);
  const browser: Record<string, unknown> = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  };
  if (prefersDark !== null && prefersDark !== undefined) {
    browser.matchMedia = (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    });
  }
  vm.runInNewContext(inlineBootstrap(), {
    window: browser,
    localStorage: browser.localStorage,
    document: { documentElement: { dataset } },
  });
  return dataset.theme;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme mode state', () => {
  it('uses the light baseline when nothing is saved and no preference exists', async () => {
    installWindow();
    const { ThemeStore } = await freshTheme();
    const store = new ThemeStore();
    expect(store.mode).toBe('system');
    expect(store.theme).toBe('fantasy');
    expect(store.label).toBe('System');
    expect(store.label).toBe(MODE_LABELS.system);
  });

  it('resolves system mode from the color scheme read at load', async () => {
    installWindow({ prefersDark: true });
    const { ThemeStore } = await freshTheme();
    const dark = new ThemeStore();
    expect(dark.mode).toBe('system');
    expect(dark.theme).toBe('halloween');

    installWindow({ prefersDark: false });
    const { ThemeStore: LightStore } = await freshTheme();
    expect(new LightStore().theme).toBe('fantasy');
  });

  it('cycles system, light, dark, system and persists each step', async () => {
    const { storage } = installWindow();
    const dataset = installDocument();
    const { ThemeStore } = await freshTheme();
    const store = new ThemeStore();
    const modes: string[] = [];
    const themes: ThemeId[] = [];
    const persisted: Array<string | null> = [];
    for (let step = 0; step < 4; step += 1) {
      store.cycle();
      modes.push(store.mode);
      themes.push(store.theme);
      persisted.push(storage.get(THEME_STORAGE_KEY) ?? null);
      expect(dataset.theme).toBe(store.theme);
    }
    expect(modes).toEqual(['light', 'dark', 'system', 'light']);
    expect(themes).toEqual(['fantasy', 'halloween', 'fantasy', 'fantasy']);
    expect(persisted).toEqual(['light', 'dark', 'system', 'light']);
    expect(THEME_MODES).toEqual(['system', 'light', 'dark']);
  });

  it('maps dark mode to halloween even when the load-time preference is light', async () => {
    installWindow({ prefersDark: false });
    const { ThemeStore } = await freshTheme();
    const store = new ThemeStore();
    store.set('dark');
    expect(store.theme).toBe('halloween');
    store.set('light');
    expect(store.theme).toBe('fantasy');
  });

  it('resets every saved theme id and unknown value to system mode', async () => {
    for (const saved of ['lofi', 'forest', 'caramellatte', 'halloween', 'unknown', '']) {
      const { storage } = installWindow({ saved, prefersDark: false });
      const { ThemeStore } = await freshTheme();
      const store = new ThemeStore();
      expect(store.mode, saved).toBe('system');
      expect(store.theme, saved).toBe('fantasy');
      expect(storage.get(THEME_STORAGE_KEY) ?? null, saved).toBe(saved || null);
    }
    const state = source('src/state/theme.svelte.ts');
    for (const legacy of ['lofi', 'forest', 'caramellatte']) {
      expect(state).not.toContain(legacy);
    }
  });

  it('restores a saved mode after a simulated reload', async () => {
    const { storage } = installWindow({ prefersDark: false });
    const first = new (await freshTheme()).ThemeStore();
    first.set('dark');
    expect(storage.get(THEME_STORAGE_KEY)).toBe('dark');

    const second = new (await freshTheme()).ThemeStore();
    expect(second.mode).toBe('dark');
    expect(second.theme).toBe('halloween');
  });

  it('samples the color scheme once without registering a listener', async () => {
    const { matchMedia } = installWindow({ prefersDark: true });
    const { ThemeStore } = await freshTheme();
    const callsAtLoad = matchMedia?.mock.calls.length ?? 0;
    const store = new ThemeStore();
    expect(matchMedia).toHaveBeenCalledTimes(callsAtLoad + 1);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    const result = matchMedia?.mock.results[callsAtLoad]?.value as object;
    expect(result).not.toHaveProperty('addEventListener');
    expect(result).not.toHaveProperty('addListener');
    store.cycle();
    expect(matchMedia).toHaveBeenCalledTimes(callsAtLoad + 1);

    for (const file of ['src/state/theme.svelte.ts', 'index.html']) {
      expect(source(file)).not.toMatch(/addEventListener\s*\(\s*['"]change|addListener\s*\(/);
    }
  });

  it('remains usable when localStorage access throws', async () => {
    installWindow({ throwOnStorage: true });
    const { ThemeStore } = await freshTheme();
    expect(() => {
      new ThemeStore();
    }).not.toThrow();
    const storeInstance = new ThemeStore();
    expect(storeInstance.theme).toBe('fantasy');
    expect(() => {
      storeInstance.cycle();
      storeInstance.set('dark');
    }).not.toThrow();
    expect(storeInstance.mode).toBe('dark');
    expect(storeInstance.theme).toBe('halloween');
  });
});

describe('no-FOUC bootstrap parity', () => {
  const cases: Array<{ name: string; saved: string | null; prefersDark: boolean | null; theme: ThemeId }> = [
    { name: 'cold light', saved: null, prefersDark: false, theme: 'fantasy' },
    { name: 'cold dark', saved: null, prefersDark: true, theme: 'halloween' },
    { name: 'stored light', saved: 'light', prefersDark: true, theme: 'fantasy' },
    { name: 'stored dark', saved: 'dark', prefersDark: false, theme: 'halloween' },
    { name: 'stored system light', saved: 'system', prefersDark: false, theme: 'fantasy' },
    { name: 'stored system dark', saved: 'system', prefersDark: true, theme: 'halloween' },
    { name: 'absent preference', saved: null, prefersDark: null, theme: 'fantasy' },
    { name: 'legacy id', saved: 'forest', prefersDark: false, theme: 'fantasy' },
    { name: 'legacy id with dark preference', saved: 'lofi', prefersDark: true, theme: 'halloween' },
    { name: 'unknown value', saved: 'unrecognized', prefersDark: false, theme: 'fantasy' },
  ];

  it('declares fantasy as the initial data-theme', () => {
    expect(source('index.html')).toContain('<html lang="en" data-theme="fantasy">');
  });

  for (const testCase of cases) {
    it(`agrees with the store for ${testCase.name}`, async () => {
      const bootstrapped = runBootstrap(testCase.saved, testCase.prefersDark);
      expect(bootstrapped, testCase.name).toBe(testCase.theme);

      installWindow({ saved: testCase.saved, prefersDark: testCase.prefersDark });
      const { ThemeStore } = await freshTheme();
      expect(new ThemeStore().theme, testCase.name).toBe(bootstrapped);
    });
  }
});

describe('theme control and persistence boundaries', () => {
  it('renders one cycling button with mode icons and labels', () => {
    const picker = source('src/components/ThemePicker.svelte');
    for (const icon of ['Monitor', 'Sun', 'Moon']) {
      expect(picker).toContain(icon);
    }
    for (const slug of ['monitor', 'sun', 'moon']) {
      expect(picker, slug).toContain(`@solar-icons/svelte/bold-duotone/${slug}`);
    }
    expect(picker).not.toContain('lucide-svelte');
    const state = source('src/state/theme.svelte.ts');
    for (const label of ['System', 'Light', 'Dark']) {
      expect(state).toContain(`'${label}'`);
    }
    expect(picker).toContain('MODE_LABELS[themeStore.mode]');
    expect(picker).toContain('themeStore.cycle()');
    expect(picker).toContain('title={`Appearance: ${label}`}');
    expect(picker).toContain('aria-label={`Appearance: ${label}`}');
    expect(picker).not.toMatch(/dropdown|menu|aria-expanded|\bCheck\b/);
    expect(source('src/pages/LandingPage.svelte')).not.toContain('<ThemePicker');
    expect(source('src/components/shell/GlobalTopBar.svelte')).toContain(
      '<ThemePicker compact={true} />',
    );
  });

  it('keeps theme state out of share URLs and project files', () => {
    installWindow({ saved: 'dark' });
    const state = {
      ...createEmptyWorkspace('STM32G431CBU6'),
      labels: { '15': 'SCK_LABEL' },
    };
    const encoded = encodeWorkspaceState(state);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.state).toEqual(state);

    const json = exportPinoutJson(state, 'stm32');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const key of ['theme', 'themeMode', 'themeId', 'mode']) {
      expect(parsed).not.toHaveProperty(key);
    }
    expect(parsePinoutJson(json).ok).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    const ioFiles = ['src/core/url-state.ts'];
    for (const entry of fs.readdirSync(path.join(ROOT, 'src', 'core', 'exporters'))) {
      if (entry.endsWith('.ts')) ioFiles.push(`src/core/exporters/${entry}`);
    }
    for (const file of ioFiles) {
      expect(file, source(file)).not.toMatch(/pincraft:theme|THEME_STORAGE_KEY|themeMode|themeId/);
    }
  });

  it('names only the two vendored blocks in CSS and documentation', () => {
    const css = source('src/themes/daisyui.css');
    expect(css.match(/\[data-theme="[^"]+"\]/g)).toEqual([
      '[data-theme="fantasy"]',
      '[data-theme="halloween"]',
    ]);
    expect(css).toContain('MIT (saadeghi/daisyUI)');
    expect(source('src/app.css')).toContain('two vendored [data-theme] blocks');
    for (const removed of ['lofi', 'forest', 'caramellatte']) {
      expect(source('src/app.css')).not.toContain(removed);
      expect(source('README.md')).not.toContain(removed);
      expect(source('index.html')).not.toContain(removed);
      expect(pickerSource()).not.toContain(removed);
    }
  });
});

function pickerSource(): string {
  return source('src/components/ThemePicker.svelte');
}

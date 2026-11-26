/**
 * Appearance mode for the interface.
 *
 * The mode is a UI preference stored only in localStorage under
 * `pincraft:theme`. It is never serialized into share URLs, project files, or
 * exports. The operating system color scheme is read once at load; no live
 * `matchMedia` listener is registered.
 */

import { createPersistedPreference } from './persisted-preference.svelte';

/** User-selectable appearance modes, in picker cycle order. */
export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** The two vendored daisyUI blocks that back the appearance modes. */
export type ThemeId = 'fantasy' | 'halloween';

/** localStorage key for the persisted mode. */
export const THEME_STORAGE_KEY = 'pincraft:theme';

/** Short labels for the three modes. */
export const MODE_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

/** Any value outside the three mode values resolves to system mode. */
export function normalizeThemeMode(value: unknown): ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
    ? (value as ThemeMode)
    : 'system';
}

/** Map one mode to a vendored theme, using the load-time OS preference for system. */
export function resolveThemeId(mode: ThemeMode, prefersDark: boolean): ThemeId {
  return mode === 'dark' || (mode === 'system' && prefersDark) ? 'halloween' : 'fantasy';
}

/** Sample `prefers-color-scheme` once. No change listener is installed. */
function readPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches === true;
  } catch {
    return false;
  }
}

function applyThemeToDom(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

/**
 * Runes-backed appearance mode. The shared persistence helper resolves the
 * saved mode on construction and writes each change for the no-FOUC bootstrap.
 */
export class ThemeStore {
  private readonly modePreference = createPersistedPreference<ThemeMode>(
    THEME_STORAGE_KEY,
    'system',
    normalizeThemeMode,
  );
  private readonly prefersDark = readPrefersDark();

  constructor() {
    applyThemeToDom(this.theme);
  }

  /** Active mode, normalized from localStorage on load. */
  get mode(): ThemeMode {
    return this.modePreference.value;
  }

  /** Vendored theme block selected by the current mode. */
  get theme(): ThemeId {
    return resolveThemeId(this.mode, this.prefersDark);
  }

  /** Short label of the active mode. */
  get label(): string {
    return MODE_LABELS[this.mode];
  }

  /** Select a mode and persist it for the no-FOUC bootstrap. */
  set(next: ThemeMode): void {
    this.modePreference.set(normalizeThemeMode(next));
    applyThemeToDom(this.theme);
  }

  /** Advance one step in System -> Light -> Dark -> System order. */
  cycle(): void {
    const index = THEME_MODES.indexOf(this.mode);
    this.set(THEME_MODES[(index + 1) % THEME_MODES.length]);
  }
}

export const themeStore = new ThemeStore();

/** Identifier of one of the four vendored daisyUI themes. */
export type ThemeId = 'lofi' | 'forest' | 'caramellatte' | 'halloween';

/** Human-readable theme metadata used by the compact theme picker. */
export interface ThemeOption {
  id: ThemeId;
  label: string;
}

const STORAGE_KEY = 'pincraft:theme';
const DEFAULT_THEME: ThemeId = 'forest';

/** All selectable themes, in cycle order. */
export const themes: readonly ThemeOption[] = [
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'forest', label: 'Forest' },
  { id: 'caramellatte', label: 'Caramel Latte' },
  { id: 'halloween', label: 'Halloween' },
];

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

function resolveInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    // Legacy light/dark preferences map onto the closest new themes.
    if (saved === 'dark') return 'forest';
    if (saved === 'light') return 'lofi';
    if (isThemeId(saved)) return saved;
  } catch {
    // ignore storage errors
  }
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  ) {
    return 'lofi';
  }
  return DEFAULT_THEME;
}

function applyThemeToDom(id: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = id;
}

class ThemeStore {
  id = $state<ThemeId>(resolveInitialTheme());

  constructor() {
    applyThemeToDom(this.id);
  }

  /** Human-readable label of the active theme. */
  get label(): string {
    return themes.find((theme) => theme.id === this.id)?.label ?? this.id;
  }

  /** Select a theme and persist it for the no-FOUC bootstrap. */
  set(next: ThemeId): void {
    this.id = next;
    applyThemeToDom(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }

  /** Advance to the next theme in picker order. */
  cycle(): void {
    const index = themes.findIndex((theme) => theme.id === this.id);
    this.set(themes[(index + 1) % themes.length].id);
  }

  /** Backwards-compatible alias for callers that used the old toggle API. */
  toggle(): void {
    this.cycle();
  }
}

export const themeStore = new ThemeStore();

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'pincraft:theme';

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore storage errors
  }
  return 'dark';
}

function applyThemeToDom(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

class ThemeStore {
  mode = $state<ThemeMode>(readInitialTheme());

  constructor() {
    applyThemeToDom(this.mode);
  }

  toggle(): void {
    this.set(this.mode === 'dark' ? 'light' : 'dark');
  }

  set(next: ThemeMode): void {
    this.mode = next;
    applyThemeToDom(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }
}

export const themeStore = new ThemeStore();

/**
 * Browser-local preferences for the global application shell.
 *
 * Sidebar expansion and the selected About tab are presentation state: they
 * stay in localStorage under a dedicated key and never enter share URLs,
 * version-2 project files, recent-session state, or undo history. Pin
 * configuration continues to live in `workspaceStore.state`.
 */

export const SHELL_PREFERENCES_STORAGE_KEY = 'pincraft:shell_preferences_v1';

export const ABOUT_TABS = ['sources', 'shortcuts'] as const;
export type AboutTab = (typeof ABOUT_TABS)[number];
export const DEFAULT_ABOUT_TAB: AboutTab = 'sources';

/** Absent or unrecognized tab values resolve to the first tab. */
export function normalizeAboutTab(value: unknown): AboutTab {
  return typeof value === 'string' && (ABOUT_TABS as readonly string[]).includes(value)
    ? (value as AboutTab)
    : DEFAULT_ABOUT_TAB;
}

function normalizeSidebarExpanded(value: unknown): boolean {
  return value === true;
}

interface StoredShellPreferences {
  sidebarExpanded?: unknown;
  aboutTab?: unknown;
}

/** Read the namespaced record, tolerating missing or unavailable storage. */
function readStoredPreferences(): StoredShellPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage?.getItem(SHELL_PREFERENCES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredShellPreferences;
  } catch {
    return {};
  }
}

/** Runes-backed helper restored from localStorage on construction. */
export class ShellPreferencesStore {
  private expanded = $state(false);
  private about = $state<AboutTab>(DEFAULT_ABOUT_TAB);

  constructor() {
    const stored = readStoredPreferences();
    this.expanded = normalizeSidebarExpanded(stored.sidebarExpanded);
    this.about = normalizeAboutTab(stored.aboutTab);
  }

  get sidebarExpanded(): boolean {
    return this.expanded;
  }

  set sidebarExpanded(value: boolean) {
    const next = normalizeSidebarExpanded(value);
    if (this.expanded === next) return;
    this.expanded = next;
    this.persist();
  }

  get aboutTab(): AboutTab {
    return this.about;
  }

  set aboutTab(value: AboutTab) {
    const next = normalizeAboutTab(value);
    if (this.about === next) return;
    this.about = next;
    this.persist();
  }

  /** Write the current snapshot; storage failures never affect the UI. */
  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(
        SHELL_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          sidebarExpanded: this.expanded,
          aboutTab: this.about,
        }),
      );
    } catch {
      // Storage may be disabled or full; in-memory defaults still apply.
    }
  }
}

/** Single shared instance mounted once by the application shell. */
export const shellPreferences = new ShellPreferencesStore();

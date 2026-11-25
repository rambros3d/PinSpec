/**
 * Browser-local preference for the global application shell.
 *
 * Sidebar expansion is presentation state: it stays in localStorage under a
 * dedicated key and never enters share URLs, version-2 project files,
 * recent-session state, or undo history. The About route owns a single static
 * provenance table, so it has no tab preference. Pin configuration continues to
 * live in `workspaceStore.state`.
 */

export const SHELL_PREFERENCES_STORAGE_KEY = 'pincraft:shell_preferences_v1';

function normalizeSidebarExpanded(value: unknown): boolean {
  return value === true;
}

interface StoredShellPreferences {
  sidebarExpanded?: unknown;
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

  constructor() {
    const stored = readStoredPreferences();
    this.expanded = normalizeSidebarExpanded(stored.sidebarExpanded);
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

  /** Write the current snapshot; storage failures never affect the UI. */
  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(
        SHELL_PREFERENCES_STORAGE_KEY,
        JSON.stringify({ sidebarExpanded: this.expanded }),
      );
    } catch {
      // Storage may be disabled or full; in-memory defaults still apply.
    }
  }
}

/** Single shared instance mounted once by the application shell. */
export const shellPreferences = new ShellPreferencesStore();

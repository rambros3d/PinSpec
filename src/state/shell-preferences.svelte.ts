/**
 * Browser-local preference for the global application shell.
 *
 * Sidebar expansion is presentation state: it stays in localStorage under a
 * dedicated key and never enters share URLs, version-2 project files,
 * recent-session state, or undo history. The About route owns a single static
 * provenance table, so it has no tab preference. Pin configuration continues to
 * live in `workspaceStore.state`.
 */

import { createPersistedPreference } from './persisted-preference.svelte';

export const SHELL_PREFERENCES_STORAGE_KEY = 'pincraft:shell_preferences_v1';

function normalizeSidebarExpanded(value: unknown): boolean {
  return value === true;
}

/** Runes-backed helper restored from localStorage on construction. */
export class ShellPreferencesStore {
  private readonly expandedPreference = createPersistedPreference<boolean>(
    SHELL_PREFERENCES_STORAGE_KEY,
    false,
    normalizeSidebarExpanded,
    'sidebarExpanded',
  );

  get sidebarExpanded(): boolean {
    return this.expandedPreference.value;
  }

  set sidebarExpanded(value: boolean) {
    this.expandedPreference.set(value);
  }
}

/** Single shared instance mounted once by the application shell. */
export const shellPreferences = new ShellPreferencesStore();

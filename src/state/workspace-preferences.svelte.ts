/**
 * Browser-local view preferences for the workspace.
 *
 * These values are presentation state only: the selected peripheral, the tree
 * filter, category expansion, the overlay toggle and the active summary/dock
 * tabs stay in localStorage and are never serialized into share URLs or
 * project files. Pin configuration, including placement bubbles, continues to
 * live in `workspaceStore.state`.
 */

import { normalizeDockTab, normalizeSummaryTab, type DockTab, type SummaryTab } from '../core/types';
import { createPersistedPreference } from './persisted-preference.svelte';

export const VIEW_PREFERENCES_STORAGE_KEY = 'pinspec:workspace_view_preferences_v1';

/** Default expansion state; the catch-all category starts collapsed. */
export const DEFAULT_CATEGORY_EXPANSION: Readonly<Record<string, boolean>> = {
  system: true,
  analog: false,
  timers: true,
  programmable: true,
  connectivity: true,
  other: false,
};

function validateSelectedPeripheral(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function validateFilterText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function validateCategoryExpansion(value: unknown): Record<string, boolean> {
  const result: Record<string, boolean> = { ...DEFAULT_CATEGORY_EXPANSION };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [id, isOpen] of Object.entries(value)) {
      if (typeof isOpen === 'boolean') result[id] = isOpen;
    }
  }
  return result;
}

/** Only the literal boolean true enables the overlay; all other values default off. */
function normalizeOverlayVisible(value: unknown): boolean {
  return value === true;
}

/**
 * Runes-backed helper for view preferences. Each preference loads its field
 * from the shared namespaced record on construction and writes through on
 * change, so a reload restores the same presentation state.
 */
export class WorkspacePreferencesStore {
  private readonly selectedPreference = createPersistedPreference<string | null>(
    VIEW_PREFERENCES_STORAGE_KEY,
    null,
    validateSelectedPeripheral,
    'selectedPeripheral',
  );
  private readonly filterPreference = createPersistedPreference<string>(
    VIEW_PREFERENCES_STORAGE_KEY,
    '',
    validateFilterText,
    'filterText',
  );
  private readonly categoriesPreference = createPersistedPreference<Record<string, boolean>>(
    VIEW_PREFERENCES_STORAGE_KEY,
    DEFAULT_CATEGORY_EXPANSION,
    validateCategoryExpansion,
    'openCategories',
  );
  private readonly overlayPreference = createPersistedPreference<boolean>(
    VIEW_PREFERENCES_STORAGE_KEY,
    false,
    normalizeOverlayVisible,
    'placementOverlayVisible',
  );
  private readonly summaryPreference = createPersistedPreference<SummaryTab>(
    VIEW_PREFERENCES_STORAGE_KEY,
    normalizeSummaryTab(null),
    normalizeSummaryTab,
    'summaryTab',
  );
  private readonly dockPreference = createPersistedPreference<DockTab>(
    VIEW_PREFERENCES_STORAGE_KEY,
    normalizeDockTab(null),
    normalizeDockTab,
    'dockTab',
  );

  get selectedPeripheral(): string | null {
    return this.selectedPreference.value;
  }

  set selectedPeripheral(value: string | null) {
    this.selectedPreference.set(value);
  }

  get filterText(): string {
    return this.filterPreference.value;
  }

  set filterText(value: string) {
    this.filterPreference.set(value);
  }

  get openCategories(): Readonly<Record<string, boolean>> {
    return this.categoriesPreference.value;
  }

  /** Read one category's expansion state with a documented default. */
  isCategoryOpen(id: string): boolean {
    return this.categoriesPreference.value[id] ?? DEFAULT_CATEGORY_EXPANSION[id] ?? false;
  }

  /** Persist one category's expansion state without affecting pin configuration. */
  setCategoryOpen(id: string, isOpen: boolean): void {
    if (this.categoriesPreference.value[id] === isOpen) return;
    this.categoriesPreference.set({ ...this.categoriesPreference.value, [id]: isOpen });
  }

  /** Canvas placement overlay visibility; localStorage only, never shareable. */
  get placementOverlayVisible(): boolean {
    return this.overlayPreference.value;
  }

  set placementOverlayVisible(value: boolean) {
    this.overlayPreference.set(value);
  }

  get summaryTab(): SummaryTab {
    return this.summaryPreference.value;
  }

  set summaryTab(value: SummaryTab) {
    this.summaryPreference.set(value);
  }

  get dockTab(): DockTab {
    return this.dockPreference.value;
  }

  set dockTab(value: DockTab) {
    this.dockPreference.set(value);
  }
}

/** Single shared instance used by the workspace page and peripheral tree. */
export const viewPreferences = new WorkspacePreferencesStore();

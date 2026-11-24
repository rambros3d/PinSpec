/**
 * Browser-local view preferences for the workspace.
 *
 * These values are presentation state only: the selected peripheral, the tree
 * filter, category expansion and the active summary/dock tabs stay in
 * localStorage and are never serialized into share URLs or project files.
 * Pin configuration continues to live in `workspaceStore.state`.
 */

import { normalizeDockTab, normalizeSummaryTab, type DockTab, type SummaryTab } from '../core/types';

export const VIEW_PREFERENCES_STORAGE_KEY = 'pincraft:workspace_view_preferences_v1';

/** Default expansion state; the catch-all category starts collapsed. */
export const DEFAULT_CATEGORY_EXPANSION: Readonly<Record<string, boolean>> = {
  system: true,
  analog: false,
  timers: true,
  programmable: true,
  connectivity: true,
  other: false,
};

interface StoredViewPreferences {
  selectedPeripheral?: unknown;
  filterText?: unknown;
  openCategories?: unknown;
  summaryTab?: unknown;
  dockTab?: unknown;
}

/** Read the namespaced record, tolerating missing or unavailable storage. */
function readStoredPreferences(): StoredViewPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage?.getItem(VIEW_PREFERENCES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredViewPreferences;
  } catch {
    return {};
  }
}

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

/**
 * Runes-backed helper for view preferences. Each instance loads the stored
 * record on construction so a reload restores the same presentation state.
 */
export class WorkspacePreferencesStore {
  private selected = $state<string | null>(validateSelectedPeripheral(null));
  private filter = $state(validateFilterText(null));
  private categories = $state<Record<string, boolean>>(validateCategoryExpansion(null));
  private summary = $state<SummaryTab>(normalizeSummaryTab(null));
  private dock = $state<DockTab>(normalizeDockTab(null));

  constructor() {
    const stored = readStoredPreferences();
    this.selected = validateSelectedPeripheral(stored.selectedPeripheral);
    this.filter = validateFilterText(stored.filterText);
    this.categories = validateCategoryExpansion(stored.openCategories);
    this.summary = normalizeSummaryTab(stored.summaryTab);
    this.dock = normalizeDockTab(stored.dockTab);
  }

  get selectedPeripheral(): string | null {
    return this.selected;
  }

  set selectedPeripheral(value: string | null) {
    this.selected = validateSelectedPeripheral(value);
    this.persist();
  }

  get filterText(): string {
    return this.filter;
  }

  set filterText(value: string) {
    this.filter = validateFilterText(value);
    this.persist();
  }

  get openCategories(): Readonly<Record<string, boolean>> {
    return this.categories;
  }

  /** Read one category's expansion state with a documented default. */
  isCategoryOpen(id: string): boolean {
    return this.categories[id] ?? DEFAULT_CATEGORY_EXPANSION[id] ?? false;
  }

  /** Persist one category's expansion state without affecting pin configuration. */
  setCategoryOpen(id: string, isOpen: boolean): void {
    if (this.categories[id] === isOpen) return;
    this.categories[id] = isOpen;
    this.persist();
  }

  get summaryTab(): SummaryTab {
    return this.summary;
  }

  set summaryTab(value: SummaryTab) {
    const next = normalizeSummaryTab(value);
    if (this.summary === next) return;
    this.summary = next;
    this.persist();
  }

  get dockTab(): DockTab {
    return this.dock;
  }

  set dockTab(value: DockTab) {
    const next = normalizeDockTab(value);
    if (this.dock === next) return;
    this.dock = next;
    this.persist();
  }

  /** Write the current preference snapshot; storage failures never affect the UI. */
  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(
        VIEW_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          selectedPeripheral: this.selected,
          filterText: this.filter,
          openCategories: this.categories,
          summaryTab: this.summary,
          dockTab: this.dock,
        }),
      );
    } catch {
      // Storage may be disabled or full; in-memory defaults still apply.
    }
  }
}

/** Single shared instance used by the workspace page and peripheral tree. */
export const viewPreferences = new WorkspacePreferencesStore();

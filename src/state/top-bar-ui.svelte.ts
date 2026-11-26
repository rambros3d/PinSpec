/**
 * Transient UI/view state for the single global top bar.
 *
 * Every field describes presentation only. Nothing here is persisted to
 * localStorage and nothing enters share URLs, version-2 project files, recent
 * session records, or undo history. Pin configuration continues to live in
 * `workspaceStore.state` and its history stack.
 */

/** Modal surfaces owned by the bar; only one can be active at a time. */
export type DialogKind = 'switcher' | 'export' | 'finder' | 'diff' | 'shortcutHelp';

class TopBarUIState {
  /** The single active modal. Boolean flags below are accessors over this value. */
  activeDialog = $state<DialogKind | null>(null);

  /** Modal opened from the MCU switcher action. */
  get switcherOpen(): boolean {
    return this.activeDialog === 'switcher';
  }
  set switcherOpen(open: boolean) {
    if (open) this.activeDialog = 'switcher';
    else if (this.activeDialog === 'switcher') this.activeDialog = null;
  }

  /** Modal opened from the export action. */
  get exportOpen(): boolean {
    return this.activeDialog === 'export';
  }
  set exportOpen(open: boolean) {
    if (open) this.activeDialog = 'export';
    else if (this.activeDialog === 'export') this.activeDialog = null;
  }

  /** Modal opened from the compatible-MCU finder action. */
  get finderOpen(): boolean {
    return this.activeDialog === 'finder';
  }
  set finderOpen(open: boolean) {
    if (open) this.activeDialog = 'finder';
    else if (this.activeDialog === 'finder') this.activeDialog = null;
  }

  /** Compare modal shared by the landing Compare action and the global bar. */
  get diffOpen(): boolean {
    return this.activeDialog === 'diff';
  }
  set diffOpen(open: boolean) {
    if (open) this.activeDialog = 'diff';
    else if (this.activeDialog === 'diff') this.activeDialog = null;
  }

  /** Shared by the bar, the sidebar Hotkeys entry, and the `?` shortcut. */
  get shortcutHelpOpen(): boolean {
    return this.activeDialog === 'shortcutHelp';
  }
  set shortcutHelpOpen(open: boolean) {
    if (open) this.activeDialog = 'shortcutHelp';
    else if (this.activeDialog === 'shortcutHelp') this.activeDialog = null;
  }

  /** Registered by the package canvas so the workspace Ctrl+F handler can select its query. */
  focusSearch: (() => void) | null = null;

  /** Leave no stale dialog behind when the workspace is unmounted. */
  reset(): void {
    this.activeDialog = null;
  }
}

/** Single shared instance mounted once by the global shell. */
export const topBarUI = new TopBarUIState();

/**
 * Transient UI/view state for the single global top bar.
 *
 * Every field describes presentation only. Nothing here is persisted to
 * localStorage and nothing enters share URLs, version-2 project files, recent
 * session records, or undo history. Pin configuration continues to live in
 * `workspaceStore.state` and its history stack.
 */
class TopBarUIState {
  /** True only while a workspace or shared route is mounted. */
  workspaceMode = $state(false);

  /** Dialog-open flags owned by the bar and consumed by the workspace page. */
  switcherOpen = $state(false);
  exportOpen = $state(false);
  finderOpen = $state(false);
  diffOpen = $state(false);

  /** Shared by the bar, the sidebar Hotkeys entry, and the `?` shortcut. */
  shortcutHelpOpen = $state(false);

  /** Registered by the package canvas so the workspace Ctrl+F handler can select its query. */
  focusSearch: (() => void) | null = null;

  /** Leave no stale dialog or mode behind when the workspace is unmounted. */
  reset(): void {
    this.workspaceMode = false;
    this.switcherOpen = false;
    this.exportOpen = false;
    this.finderOpen = false;
    this.diffOpen = false;
    this.shortcutHelpOpen = false;
  }
}

/** Single shared instance mounted once by the global shell. */
export const topBarUI = new TopBarUIState();

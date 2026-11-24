<script lang="ts">
  import {
    ChevronDown,
    Download,
    GitCompare,
    Maximize2,
    Redo2,
    RotateCw,
    Search,
    SearchCheck,
    Share2,
    Trash2,
    Undo2,
    X,
  } from 'lucide-svelte';
  import type { ChipData } from '../../core/types';
  import ThemePicker from '../ThemePicker.svelte';

  interface Props {
    chip: ChipData | null;
    globalSearch: string;
    searchMatchCount: number;
    canUndo: boolean;
    canRedo: boolean;
    rotation: 0 | 90 | 180 | 270;
    searchInputRef?: HTMLInputElement | null;
    onHome: () => void;
    onOpenSwitcher: () => void;
    onSearchChange: (val: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    onClearAll: () => void;
    onFitView: () => void;
    onRotate: () => void;
    onShare: () => void;
    onOpenExport: () => void;
    onOpenFinder: () => void;
    onOpenDiff: () => void;
  }

  let {
    chip,
    globalSearch,
    searchMatchCount,
    canUndo,
    canRedo,
    rotation,
    searchInputRef = $bindable(null),
    onHome,
    onOpenSwitcher,
    onSearchChange,
    onUndo,
    onRedo,
    onClearAll,
    onFitView,
    onRotate,
    onShare,
    onOpenExport,
    onOpenFinder,
    onOpenDiff,
  }: Props = $props();

  let confirmClear = $state(false);
</script>

<header class="h-12 shrink-0 min-h-0 min-w-0 overflow-hidden border-ui-b border-hairline bg-surface select-none">
  <div class="flex h-full w-full min-w-0 items-center justify-between gap-3 px-3 overflow-x-auto overscroll-x-contain">
  <!-- Left: Brand Home + Active MCU Switcher -->
  <div class="flex items-center gap-3 min-w-0 shrink-0">
    <button
      type="button"
      onclick={onHome}
      class="flex items-center gap-2 text-primary hover:text-hint transition-colors whitespace-nowrap shrink-0"
      title="Back to PinCraft Home"
    >
      <svg class="size-ui-lg text-hint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
        <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      </svg>
      <span class="hidden sm:inline font-bold text-sm tracking-tight">PinCraft</span>
    </button>

    <div class="w-px h-5 bg-elevated shrink-0"></div>

    {#if chip}
      <button
        type="button"
        onclick={onOpenSwitcher}
        class="flex items-center gap-2 px-2.5 py-1 rounded-control border-ui border-hairline bg-subtle hover:border-hint transition-colors min-w-0 whitespace-nowrap"
        title="Switch MCU"
      >
        <span class="font-mono font-semibold text-xs text-primary truncate max-w-[11rem]">
          {chip.id}
        </span>
        <span class="hidden lg:inline font-mono-tabular text-[11px] text-muted">
          {chip.core} - {chip.flashKb}KB/{chip.ramKb}KB - {chip.package.name} ({chip.package.pinCount})
        </span>
        <ChevronDown class="size-ui-md text-faint shrink-0" />
      </button>
    {/if}
  </div>

  <!-- Center: Global Pin/Signal Search (Ctrl+F) -->
  <div class="flex-1 min-w-[9rem] max-w-xs relative flex items-center shrink-0">
    <Search class="size-ui-md text-faint absolute left-2.5 pointer-events-none" />
    <input
      bind:this={searchInputRef}
      value={globalSearch}
      oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
      type="text"
      placeholder="Find pin or signal (Ctrl+F)..."
      class="w-full pl-8 pr-14 py-1.5 rounded-control bg-elevated border-ui border-hairline text-xs font-mono text-primary placeholder:text-faint focus:outline-none focus:border-hint"
    />
    {#if globalSearch}
      <div class="absolute right-2 flex items-center gap-1">
        <span class="font-mono-tabular text-[10px] text-hint">
          {searchMatchCount}
        </span>
        <button
          type="button"
          onclick={() => onSearchChange('')}
          class="p-0.5 rounded-control hover:bg-elevated text-faint"
          title="Clear search"
        >
          <X class="size-ui-sm" />
        </button>
      </div>
    {/if}
  </div>

  <!-- Right: Workspace Actions -->
  <div class="flex items-center gap-1 shrink-0">
    <button
      type="button"
      onclick={onUndo}
      disabled={!canUndo}
      title="Undo (Ctrl+Z)"
      class="p-1.5 rounded-control hover:bg-elevated text-primary disabled:opacity-35"
    >
      <Undo2 class="size-ui" />
    </button>
    <button
      type="button"
      onclick={onRedo}
      disabled={!canRedo}
      title="Redo (Ctrl+Y)"
      class="p-1.5 rounded-control hover:bg-elevated text-primary disabled:opacity-35"
    >
      <Redo2 class="size-ui" />
    </button>

    <div class="relative">
      <button
        type="button"
        onclick={() => (confirmClear = !confirmClear)}
        title="Clear all assignments"
        class="p-1.5 rounded-control hover:bg-danger-soft text-muted hover:text-danger"
      >
        <Trash2 class="size-ui" />
      </button>
      {#if confirmClear}
        <div class="absolute right-0 top-10 z-50 w-56 rounded-panel border-ui border-hairline bg-surface shadow-xl p-3 text-xs">
          <p class="text-primary font-medium">Clear all pin assignments?</p>
          <p class="mt-1 text-[11px] text-muted">
            You can undo this action with Ctrl+Z.
          </p>
          <div class="mt-2.5 flex justify-end gap-1.5">
            <button
              type="button"
              onclick={() => (confirmClear = false)}
              class="px-2.5 py-1 rounded-control border-ui border-hairline text-muted hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={() => {
                confirmClear = false;
                onClearAll();
              }}
              class="px-2.5 py-1 rounded-control bg-danger hover:bg-danger-hover text-on-danger font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      {/if}
    </div>

    <div class="w-px h-5 bg-elevated mx-1"></div>

    <button
      type="button"
      onclick={onFitView}
      title="Fit View (0)"
      class="hidden sm:inline-flex p-1.5 rounded-control hover:bg-elevated text-primary"
    >
      <Maximize2 class="size-ui" />
    </button>
    <button
      type="button"
      onclick={onRotate}
      title={`Rotate package (${rotation} deg)`}
      class="hidden sm:inline-flex p-1.5 rounded-control hover:bg-elevated text-primary"
    >
      <RotateCw class="size-ui" />
    </button>

    <div class="w-px h-5 bg-elevated mx-1"></div>

    <button
      type="button"
      onclick={onOpenFinder}
      title="Find a compatible MCU for this pinout"
      aria-label="Find compatible MCU"
      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border-ui border-hairline hover:bg-elevated text-xs font-medium text-primary whitespace-nowrap"
    >
      <SearchCheck class="size-ui-md" />
      <span class="hidden lg:inline">Find MCU</span>
    </button>

    <button
      type="button"
      onclick={onOpenDiff}
      title="Compare two project pinouts"
      aria-label="Compare project pinouts"
      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border-ui border-hairline hover:bg-elevated text-xs font-medium text-primary whitespace-nowrap"
    >
      <GitCompare class="size-ui-md" />
      <span class="hidden lg:inline">Compare</span>
    </button>

    <button
      type="button"
      onclick={onShare}
      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border-ui border-hairline hover:bg-elevated text-xs font-medium text-primary whitespace-nowrap"
    >
      <Share2 class="size-ui-md" />
      <span class="hidden md:inline">Share</span>
    </button>

    <button
      type="button"
      onclick={onOpenExport}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-action hover:bg-action-hover text-xs font-semibold text-on-action whitespace-nowrap transition-colors"
    >
      <Download class="size-ui-md" />
      <span>Export</span>
    </button>

    <ThemePicker compact={true} />
  </div>
  </div>
</header>

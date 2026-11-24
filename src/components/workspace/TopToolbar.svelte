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

<header class="h-12 shrink-0 min-h-0 min-w-0 overflow-hidden border-b border-base-300 bg-base-100 select-none">
  <div class="flex h-full w-full min-w-0 items-center justify-between gap-3 px-3 overflow-x-auto overscroll-x-contain">
  <!-- Left: Brand Home + Active MCU Switcher -->
  <div class="flex items-center gap-3 min-w-0 shrink-0">
    <button
      type="button"
      onclick={onHome}
      class="btn btn-ghost btn-sm gap-2 whitespace-nowrap shrink-0"
      title="Back to PinCraft Home"
    >
      <svg class="size-5 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
        <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      </svg>
      <span class="hidden sm:inline font-bold text-sm tracking-tight">PinCraft</span>
    </button>

    <div class="w-px h-5 bg-base-300 shrink-0"></div>

    {#if chip}
      <button
        type="button"
        onclick={onOpenSwitcher}
        class="btn btn-sm btn-outline gap-2 min-w-0 whitespace-nowrap"
        title="Switch MCU"
      >
        <span class="font-mono font-semibold text-xs text-foreground truncate max-w-[11rem]">
          {chip.id}
        </span>
        <span class="hidden lg:inline font-mono-tabular text-[11px] text-base-content/60">
          {chip.core} - {chip.flashKb}KB/{chip.ramKb}KB - {chip.package.name} ({chip.package.pinCount})
        </span>
        <ChevronDown class="size-3.5 text-base-content/40 shrink-0" />
      </button>
    {/if}
  </div>

  <!-- Center: Global Pin/Signal Search (Ctrl+F) -->
  <div class="flex-1 min-w-[9rem] max-w-xs relative flex items-center shrink-0">
    <Search class="size-3.5 text-base-content/40 absolute left-2.5 pointer-events-none" />
    <input
      bind:this={searchInputRef}
      value={globalSearch}
      oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
      type="text"
      placeholder="Find pin or signal (Ctrl+F)..."
      class="input input-xs w-full pl-8 pr-14 font-mono"
    />
    {#if globalSearch}
      <div class="absolute right-2 flex items-center gap-1">
        <span class="font-mono-tabular text-[10px] text-info">
          {searchMatchCount}
        </span>
        <button
          type="button"
          onclick={() => onSearchChange('')}
          class="btn btn-ghost btn-xs btn-square"
          title="Clear search"
        >
          <X class="size-3" />
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
      class="btn btn-ghost btn-sm btn-square"
    >
      <Undo2 class="size-4" />
    </button>
    <button
      type="button"
      onclick={onRedo}
      disabled={!canRedo}
      title="Redo (Ctrl+Y)"
      class="btn btn-ghost btn-sm btn-square"
    >
      <Redo2 class="size-4" />
    </button>

    <div class="relative">
      <button
        type="button"
        onclick={() => (confirmClear = !confirmClear)}
        title="Clear all assignments"
        class="btn btn-ghost btn-sm btn-square hover:text-error"
      >
        <Trash2 class="size-4" />
      </button>
      {#if confirmClear}
        <div class="card card-border absolute right-0 top-10 z-50 w-56 bg-base-100 shadow-xl p-3 text-xs">
          <p class="text-foreground font-medium">Clear all pin assignments?</p>
          <p class="mt-1 text-[11px] text-base-content/60">
            You can undo this action with Ctrl+Z.
          </p>
          <div class="mt-2.5 flex justify-end gap-1.5">
            <button
              type="button"
              onclick={() => (confirmClear = false)}
              class="btn btn-sm btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={() => {
                confirmClear = false;
                onClearAll();
              }}
              class="btn btn-sm btn-error font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      {/if}
    </div>

    <div class="w-px h-5 bg-base-300 mx-1"></div>

    <button
      type="button"
      onclick={onFitView}
      title="Fit View (0)"
      class="btn btn-ghost btn-sm btn-square hidden sm:inline-flex"
    >
      <Maximize2 class="size-4" />
    </button>
    <button
      type="button"
      onclick={onRotate}
      title={`Rotate package (${rotation} deg)`}
      class="btn btn-ghost btn-sm btn-square hidden sm:inline-flex"
    >
      <RotateCw class="size-4" />
    </button>

    <div class="w-px h-5 bg-base-300 mx-1"></div>

    <button
      type="button"
      onclick={onOpenFinder}
      title="Find a compatible MCU for this pinout"
      aria-label="Find compatible MCU"
      class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
    >
      <SearchCheck class="size-3.5" />
      <span class="hidden lg:inline">Find MCU</span>
    </button>

    <button
      type="button"
      onclick={onOpenDiff}
      title="Compare two project pinouts"
      aria-label="Compare project pinouts"
      class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
    >
      <GitCompare class="size-3.5" />
      <span class="hidden lg:inline">Compare</span>
    </button>

    <button
      type="button"
      onclick={onShare}
      class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
    >
      <Share2 class="size-3.5" />
      <span class="hidden md:inline">Share</span>
    </button>

    <button
      type="button"
      onclick={onOpenExport}
      class="btn btn-sm btn-primary gap-1.5 text-xs font-semibold whitespace-nowrap"
    >
      <Download class="size-3.5" />
      <span>Export</span>
    </button>

    <ThemePicker compact={true} />
  </div>
  </div>
</header>

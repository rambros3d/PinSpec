<script lang="ts">
  import {
    ChevronDown,
    Download,
    Maximize2,
    Moon,
    Redo2,
    RotateCw,
    Search,
    Share2,
    Sun,
    Trash2,
    Undo2,
    X,
  } from 'lucide-svelte';
  import type { ChipData } from '../../core/types';
  import { themeStore } from '../../state/theme.svelte';

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
  }: Props = $props();

  let confirmClear = $state(false);
</script>

<header class="h-12 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121722] select-none">
  <!-- Left: Brand Home + Active MCU Switcher -->
  <div class="flex items-center gap-3 min-w-0">
    <button
      type="button"
      onclick={onHome}
      class="flex items-center gap-2 text-slate-900 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors whitespace-nowrap shrink-0"
      title="Back to PinCraft Home"
    >
      <svg class="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
        <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      </svg>
      <span class="font-bold text-sm tracking-tight">PinCraft</span>
    </button>

    <div class="w-px h-5 bg-slate-200 dark:bg-slate-800 shrink-0"></div>

    {#if chip}
      <button
        type="button"
        onclick={onOpenSwitcher}
        class="flex items-center gap-2 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0b0e14] hover:border-sky-500/60 transition-colors min-w-0 whitespace-nowrap"
        title="Switch STM32 MCU"
      >
        <span class="font-mono font-semibold text-xs text-slate-900 dark:text-slate-100">
          {chip.id}
        </span>
        <span class="hidden lg:inline font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
          {chip.core} · {chip.flashKb}KB/{chip.ramKb}KB · {chip.package.name} ({chip.package.pinCount})
        </span>
        <ChevronDown class="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>
    {/if}
  </div>

  <!-- Center: Global Pin/Signal Search (Ctrl+F) -->
  <div class="flex-1 max-w-xs relative flex items-center">
    <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
    <input
      bind:this={searchInputRef}
      value={globalSearch}
      oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
      type="text"
      placeholder="Find pin or signal (Ctrl+F)..."
      class="w-full pl-8 pr-14 py-1.5 rounded-md bg-slate-100 dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
    />
    {#if globalSearch}
      <div class="absolute right-2 flex items-center gap-1">
        <span class="font-mono-tabular text-[10px] text-sky-600 dark:text-sky-400">
          {searchMatchCount}
        </span>
        <button
          type="button"
          onclick={() => onSearchChange('')}
          class="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
          title="Clear search"
        >
          <X class="w-3 h-3" />
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
      class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-35"
    >
      <Undo2 class="w-4 h-4" />
    </button>
    <button
      type="button"
      onclick={onRedo}
      disabled={!canRedo}
      title="Redo (Ctrl+Y)"
      class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-35"
    >
      <Redo2 class="w-4 h-4" />
    </button>

    <div class="relative">
      <button
        type="button"
        onclick={() => (confirmClear = !confirmClear)}
        title="Clear all assignments"
        class="p-1.5 rounded-md hover:bg-red-500/10 text-slate-600 dark:text-slate-400 hover:text-red-500"
      >
        <Trash2 class="w-4 h-4" />
      </button>
      {#if confirmClear}
        <div class="absolute right-0 top-10 z-50 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121722] shadow-xl p-3 text-xs">
          <p class="text-slate-800 dark:text-slate-200 font-medium">Clear all pin assignments?</p>
          <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            You can undo this action with Ctrl+Z.
          </p>
          <div class="mt-2.5 flex justify-end gap-1.5">
            <button
              type="button"
              onclick={() => (confirmClear = false)}
              class="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={() => {
                confirmClear = false;
                onClearAll();
              }}
              class="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      {/if}
    </div>

    <div class="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1"></div>

    <button
      type="button"
      onclick={onFitView}
      title="Fit View (0)"
      class="hidden sm:inline-flex p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
    >
      <Maximize2 class="w-4 h-4" />
    </button>
    <button
      type="button"
      onclick={onRotate}
      title={`Rotate package (${rotation} deg)`}
      class="hidden sm:inline-flex p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
    >
      <RotateCw class="w-4 h-4" />
    </button>

    <div class="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1"></div>

    <button
      type="button"
      onclick={onShare}
      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap"
    >
      <Share2 class="w-3.5 h-3.5" />
      <span class="hidden md:inline">Share</span>
    </button>

    <button
      type="button"
      onclick={onOpenExport}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white whitespace-nowrap transition-colors"
    >
      <Download class="w-3.5 h-3.5" />
      <span>Export</span>
    </button>

    <button
      type="button"
      onclick={() => themeStore.toggle()}
      title="Toggle dark/light theme"
      class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 ml-0.5"
    >
      {#if themeStore.mode === 'dark'}
        <Sun class="w-4 h-4" />
      {:else}
        <Moon class="w-4 h-4" />
      {/if}
    </button>
  </div>
</header>

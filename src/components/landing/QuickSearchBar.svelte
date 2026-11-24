<script lang="ts">
  import { ArrowRight, Cpu, Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { catalogStore, searchCatalogEntries } from '../../state/catalog.svelte';

  interface Props {
    onSelect: (mcuId: string) => void;
  }

  let { onSelect }: Props = $props();

  let query = $state('');
  let familyFilter = $state('');
  let pkgFilter = $state('');
  let focused = $state(false);
  let activeIdx = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let wrapperEl = $state<HTMLDivElement | null>(null);

  const familyFilters = ['F1', 'F4', 'G4', 'H7', 'U5', 'C0'];
  const pkgFilters = ['LQFP', 'QFN', 'BGA'];

  const results = $derived.by(() =>
    searchCatalogEntries(
      catalogStore.index,
      query,
      { family: familyFilter, packageKind: pkgFilter },
      18,
    ),
  );

  const showDropdown = $derived(
    focused && (query.trim().length > 0 || familyFilter !== '' || pkgFilter !== ''),
  );

  $effect(() => {
    results.length;
    activeIdx = 0;
  });

  function selectEntry(id: string): void {
    focused = false;
    onSelect(id);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!showDropdown && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      focused = true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      selectEntry(results[activeIdx].id);
    } else if (e.key === 'Escape') {
      focused = false;
      inputEl?.blur();
    }
  }

  onMount(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputEl?.focus();
        inputEl?.select();
        focused = true;
      }
    };
    const onOutsideClick = (e: MouseEvent) => {
      if (wrapperEl && !wrapperEl.contains(e.target as Node)) {
        focused = false;
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    window.addEventListener('mousedown', onOutsideClick);
    return () => {
      window.removeEventListener('keydown', onGlobalKey);
      window.removeEventListener('mousedown', onOutsideClick);
    };
  });
</script>

<div bind:this={wrapperEl} class="relative w-full space-y-2.5">
  <!-- Search Input Box -->
  <div class="relative flex items-center">
    <Search class="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
    <input
      bind:this={inputEl}
      bind:value={query}
      onfocus={() => (focused = true)}
      onkeydown={handleKeydown}
      type="text"
      placeholder="Jump to STM32 MCU (e.g. STM32G431CBU6, H743 BGA, F411)..."
      class="w-full pl-10 pr-20 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121722] text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-xs transition-colors"
    />
    <div class="absolute right-3 flex items-center gap-1.5">
      {#if query}
        <button
          type="button"
          onclick={() => {
            query = '';
            inputEl?.focus();
          }}
          class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          title="Clear"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      {:else}
        <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-[#0b0e14]">
          Ctrl+K
        </kbd>
      {/if}
    </div>
  </div>

  <!-- Interactive Segmented Quick Filter Buttons -->
  <div class="flex flex-wrap items-center gap-1.5 text-xs">
    <span class="text-slate-500 dark:text-slate-400 mr-1">Filter:</span>
    {#each familyFilters as fam}
      <button
        type="button"
        onclick={() => {
          familyFilter = familyFilter === fam ? '' : fam;
          focused = true;
          inputEl?.focus();
        }}
        class={`px-2.5 py-1 rounded-md font-mono whitespace-nowrap transition-colors ${
          familyFilter === fam
            ? 'bg-sky-500 text-white font-medium'
            : 'bg-slate-200/75 dark:bg-[#151c29] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
        }`}
      >
        {fam}
      </button>
    {/each}
    <span class="text-slate-300 dark:text-slate-700 mx-0.5">|</span>
    {#each pkgFilters as pkg}
      <button
        type="button"
        onclick={() => {
          pkgFilter = pkgFilter === pkg ? '' : pkg;
          focused = true;
          inputEl?.focus();
        }}
        class={`px-2.5 py-1 rounded-md font-mono whitespace-nowrap transition-colors ${
          pkgFilter === pkg
            ? 'bg-sky-500 text-white font-medium'
            : 'bg-slate-200/75 dark:bg-[#151c29] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
        }`}
      >
        {pkg}
      </button>
    {/each}
    {#if familyFilter || pkgFilter}
      <button
        type="button"
        onclick={() => {
          familyFilter = '';
          pkgFilter = '';
        }}
        class="ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 underline"
      >
        Reset
      </button>
    {/if}
  </div>

  <!-- Live Dropdown Results -->
  {#if showDropdown}
    <div class="absolute left-0 right-0 top-[52px] z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121722] shadow-2xl overflow-hidden max-h-[340px] flex flex-col">
      <div class="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e131d] text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
        <span>
          {#if catalogStore.loadingIndex}
            Loading STM32 catalog...
          {:else}
            Showing {results.length} matching parts
          {/if}
        </span>
        <span>Enter to open · Up/Down to navigate</span>
      </div>

      <div class="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {#if results.length === 0 && !catalogStore.loadingIndex}
          <div class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No parts matched your filter criteria.
          </div>
        {:else}
          {#each results as entry, i (entry.id)}
            <button
              type="button"
              onclick={() => selectEntry(entry.id)}
              onmouseenter={() => (activeIdx = i)}
              class={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                i === activeIdx
                  ? 'bg-sky-500/12 dark:bg-sky-500/18'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Cpu class="w-4 h-4 text-slate-400 shrink-0" />
                <div class="min-w-0">
                  <div class="font-mono font-semibold text-xs text-slate-900 dark:text-slate-100">
                    {entry.id}
                  </div>
                  <div class="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {entry.core} · {entry.flashKb} KB Flash · {entry.ramKb} KB RAM
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="text-right font-mono-tabular text-[11px]">
                  <div class="text-slate-800 dark:text-slate-200">{entry.package}</div>
                  <div class="text-slate-400">{entry.pinCount} pins</div>
                </div>
                <ArrowRight class="w-3.5 h-3.5 text-slate-400" />
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

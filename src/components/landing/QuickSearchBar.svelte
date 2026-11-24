<script lang="ts">
  import { ArrowRight, Cpu, Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { catalogStore, searchCatalogEntries } from '../../state/catalog.svelte';
  import {
    buildVendorTabs,
    catalogFamilies,
    catalogPackageKinds,
  } from '../../core/vendor-view';
  import type { VendorId } from '../../core/types';

  interface Props {
    onSelect: (mcuId: string) => void;
  }

  let { onSelect }: Props = $props();

  let query = $state('');
  let vendorFilter = $state<VendorId | 'all'>('all');
  let familyFilter = $state('');
  let pkgFilter = $state('');
  let focused = $state(false);
  let activeIdx = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let wrapperEl = $state<HTMLDivElement | null>(null);

  const vendorTabs = $derived(buildVendorTabs(catalogStore.meta, catalogStore.index));
  const familyOptions = $derived(catalogFamilies(catalogStore.index));
  const packageOptions = $derived(catalogPackageKinds(catalogStore.index));

  const results = $derived.by(() =>
    searchCatalogEntries(
      catalogStore.index,
      query,
      { vendor: vendorFilter, family: familyFilter, packageKind: pkgFilter },
      18,
    ),
  );

  const showDropdown = $derived(
    focused &&
      (query.trim().length > 0 ||
        vendorFilter !== 'all' ||
        familyFilter !== '' ||
        pkgFilter !== ''),
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
    <Search class="w-4 h-4 text-faint absolute left-3.5 pointer-events-none" />
    <input
      bind:this={inputEl}
      bind:value={query}
      onfocus={() => (focused = true)}
      onkeydown={handleKeydown}
      type="text"
      placeholder="Jump to any MCU (e.g. STM32G431CBU6, CH32V003J4M6, RP2350B)..."
      class="w-full pl-10 pr-20 py-3 rounded-lg border border-strong bg-surface text-sm font-mono text-primary placeholder:text-faint focus:outline-none focus:border-hint shadow-xs transition-colors"
    />
    <div class="absolute right-3 flex items-center gap-1.5">
      {#if query}
        <button
          type="button"
          onclick={() => {
            query = '';
            inputEl?.focus();
          }}
          class="p-1 rounded hover:bg-elevated text-faint"
          title="Clear"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      {:else}
        <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono text-faint border border-hairline rounded bg-subtle">
          Ctrl+K
        </kbd>
      {/if}
    </div>
  </div>

  <!-- Vendor tabs plus vendor-neutral family/package filters -->
  <div class="flex flex-wrap items-center gap-1.5 text-xs">
    <span class="text-muted mr-1">Vendor:</span>
    {#each vendorTabs as tab (tab.id)}
      <button
        type="button"
        onclick={() => {
          vendorFilter = tab.id;
          focused = true;
          inputEl?.focus();
        }}
        class={`px-2.5 py-1 rounded-md font-mono whitespace-nowrap transition-colors ${
          vendorFilter === tab.id
            ? 'bg-action text-on-action font-medium'
            : 'bg-elevated text-primary hover:bg-elevated border border-hairline'
        }`}
      >
        {tab.label}
        <span class="font-mono-tabular opacity-75">({tab.count})</span>
      </button>
    {/each}

    <span class="text-faint mx-0.5">|</span>

    <label class="inline-flex items-center gap-1 text-muted">
      Family
      <select
        bind:value={familyFilter}
        class="px-1.5 py-1 rounded-md bg-elevated border border-hairline text-xs text-primary focus:outline-none focus:border-hint"
      >
        <option value="">All</option>
        {#each familyOptions as fam (fam)}
          <option value={fam}>{fam}</option>
        {/each}
      </select>
    </label>
    <label class="inline-flex items-center gap-1 text-muted">
      Package
      <select
        bind:value={pkgFilter}
        class="px-1.5 py-1 rounded-md bg-elevated border border-hairline text-xs text-primary focus:outline-none focus:border-hint"
      >
        <option value="">All</option>
        {#each packageOptions as pkg (pkg)}
          <option value={pkg}>{pkg}</option>
        {/each}
      </select>
    </label>
    {#if familyFilter || pkgFilter || vendorFilter !== 'all'}
      <button
        type="button"
        onclick={() => {
          vendorFilter = 'all';
          familyFilter = '';
          pkgFilter = '';
        }}
        class="ml-1 text-muted hover:text-primary underline"
      >
        Reset
      </button>
    {/if}
  </div>

  <!-- Live Dropdown Results -->
  {#if showDropdown}
    <div class="absolute left-0 right-0 top-[52px] z-30 rounded-xl border border-hairline bg-surface shadow-2xl overflow-hidden max-h-[340px] flex flex-col">
      <div class="flex items-center justify-between px-3.5 py-2 border-b border-hairline bg-subtle text-[11px] font-mono-tabular text-muted">
        <span>
          {#if catalogStore.loadingIndex}
            Loading multi-vendor catalog...
          {:else}
            Showing {results.length} matching parts
          {/if}
        </span>
        <span>Enter to open · Up/Down to navigate</span>
      </div>

      <div class="overflow-y-auto divide-y divide-hairline">
        {#if results.length === 0 && !catalogStore.loadingIndex}
          <div class="py-8 text-center text-xs text-muted">
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
                  ? 'bg-info-soft'
                  : 'hover:bg-elevated'
              }`}
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Cpu class="w-4 h-4 text-faint shrink-0" />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-semibold text-xs text-primary">
                      {entry.id}
                    </span>
                    <span class="px-1 py-px rounded border border-hairline bg-subtle font-mono text-[9px] uppercase text-muted">
                      {entry.vendor ?? 'stm32'}
                    </span>
                  </div>
                  <div class="font-mono-tabular text-[11px] text-muted truncate">
                    {entry.family} · {entry.core} · {entry.flashKb} KB Flash · {entry.ramKb} KB RAM
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="text-right font-mono-tabular text-[11px]">
                  <div class="text-primary">{entry.package}</div>
                  <div class="text-faint">{entry.pinCount} pins</div>
                </div>
                <ArrowRight class="w-3.5 h-3.5 text-faint" />
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

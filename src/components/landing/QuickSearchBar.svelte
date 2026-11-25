<script lang="ts">
  import ArrowRight from '@solar-icons/svelte/bold-duotone/arrow-right';
  import Cpu from '@solar-icons/svelte/bold-duotone/cpu';
  import Search from '@solar-icons/svelte/bold-duotone/magnifier';
  import X from '@solar-icons/svelte/bold-duotone/close';
  import { onMount } from 'svelte';
  import { catalogStore, searchCatalogEntries } from '../../state/catalog.svelte';
  import { discoveryPreferences } from '../../state/discovery-preferences.svelte';
  import {
    buildVendorTabs,
    catalogFamilies,
    catalogPackageKinds,
  } from '../../core/vendor-view';
  interface Props {
    onSelect: (mcuId: string) => void;
  }

  let { onSelect }: Props = $props();

  /* Independent localStorage-only filters; never part of shareable state. */
  const filters = discoveryPreferences.quickSearch;
  let focused = $state(false);
  let activeIdx = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let wrapperEl = $state<HTMLDivElement | null>(null);

  /** Focus and select the search input when the start-screen action is used. */
  export function focusInput(): void {
    inputEl?.focus();
    inputEl?.select();
    focused = true;
  }

  const vendorTabs = $derived(buildVendorTabs(catalogStore.meta, catalogStore.index));
  const familyOptions = $derived(catalogFamilies(catalogStore.index));
  const packageOptions = $derived(catalogPackageKinds(catalogStore.index));

  const results = $derived.by(() =>
    searchCatalogEntries(
      catalogStore.index,
      filters.query,
      { vendor: filters.vendor, family: filters.family, packageKind: filters.package },
      18,
    ),
  );

  const showDropdown = $derived(
    focused &&
      (filters.query.trim().length > 0 ||
        filters.vendor !== 'all' ||
        filters.family !== '' ||
        filters.package !== ''),
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
    <Search class="size-4 text-base-content/40 absolute left-3.5 pointer-events-none" />
    <input
      bind:this={inputEl}
      bind:value={filters.query}
      onfocus={() => (focused = true)}
      onkeydown={handleKeydown}
      type="text"
      placeholder="Jump to any MCU (e.g. STM32G431CBU6, CH32V003J4M6, RP2350B)..."
      class="input input-lg w-full pl-10 pr-20 font-mono"
    />
    <div class="absolute right-3 flex items-center gap-1.5">
      {#if filters.query}
        <button
          type="button"
          onclick={() => {
            filters.query = '';
            inputEl?.focus();
          }}
          class="btn btn-ghost btn-sm btn-square"
          aria-label="Clear search"
          title="Clear"
        >
          <X class="size-3.5" />
        </button>
      {:else}
        <kbd class="kbd kbd-sm hidden sm:inline-block text-[11px] font-mono">
          Ctrl+K
        </kbd>
      {/if}
    </div>
  </div>

  <!-- Vendor tabs plus vendor-neutral family/package filters -->
  <div class="flex flex-wrap items-center gap-1.5 text-xs">
    <span class="text-base-content/60 mr-1">Vendor:</span>
    {#each vendorTabs as tab (tab.id)}
      <button
        type="button"
        onclick={() => {
          filters.vendor = tab.id;
          focused = true;
          inputEl?.focus();
        }}
        class={`btn btn-sm font-mono whitespace-nowrap ${
          filters.vendor === tab.id ? 'btn-primary' : 'btn-outline'
        }`}
      >
        {tab.label}
        <span class="font-mono-tabular opacity-75">({tab.count})</span>
      </button>
    {/each}

    <span class="text-base-content/60 mx-0.5">|</span>

    <label class="inline-flex items-center gap-1 text-base-content/60">
      Family
      <select
        bind:value={filters.family}
        class="select select-sm"
        aria-label="Filter by family"
      >
        <option value="">All</option>
        {#each familyOptions as fam (fam)}
          <option value={fam}>{fam}</option>
        {/each}
      </select>
    </label>
    <label class="inline-flex items-center gap-1 text-base-content/60">
      Package
      <select
        bind:value={filters.package}
        class="select select-sm"
        aria-label="Filter by package"
      >
        <option value="">All</option>
        {#each packageOptions as pkg (pkg)}
          <option value={pkg}>{pkg}</option>
        {/each}
      </select>
    </label>
    {#if filters.family || filters.package || filters.vendor !== 'all'}
      <button
        type="button"
        onclick={() => filters.reset()}
        class="btn btn-link btn-sm ml-1"
      >
        Reset
      </button>
    {/if}
  </div>

  <!-- Live Dropdown Results -->
  {#if showDropdown}
    <div class="card card-border absolute left-0 right-0 top-[52px] z-30 bg-base-100 shadow-2xl overflow-hidden max-h-[340px] flex flex-col">
      <div class="flex items-center justify-between px-3.5 py-2 border-b border-base-300 bg-base-200 text-[11px] font-mono-tabular text-base-content/60">
        <span>
          {#if catalogStore.loadingIndex}
            <span class="loading loading-spinner loading-xs"></span>
            Loading multi-vendor catalog...
          {:else}
            Showing {results.length} matching parts
          {/if}
        </span>
        <span>Enter to open · Up/Down to navigate</span>
      </div>

      <div class="overflow-y-auto divide-y divide-base-300">
        {#if catalogStore.indexError}
          <div role="alert" class="alert alert-soft alert-error py-6 px-4 text-center text-xs space-y-2">
            <p class="font-medium">{catalogStore.indexError}</p>
            <button
              type="button"
              onclick={() => catalogStore.retry()}
              class="btn btn-sm btn-outline"
            >
              Retry catalog load
            </button>
          </div>
        {:else if results.length === 0 && !catalogStore.loadingIndex}
          <div class="py-8 text-center text-xs text-base-content/60">
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
                  ? 'bg-info/15'
                  : 'hover:bg-base-300'
              }`}
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Cpu class="size-4 text-base-content/40 shrink-0" />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-semibold text-xs text-foreground">
                      {entry.id}
                    </span>
                    <span class="badge badge-xs badge-ghost font-mono text-[9px] uppercase">
                      {entry.vendor ?? 'stm32'}
                    </span>
                    {#if entry.module}
                      <span class="badge badge-xs badge-outline font-mono text-[9px] uppercase">
                        MODULE
                      </span>
                    {/if}
                  </div>
                  <div class="font-mono-tabular text-[11px] text-base-content/60 truncate">
                    {entry.family} · {entry.core} · {entry.flashKb ?? '—'} KB Flash · {entry.ramKb} KB RAM
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="text-right font-mono-tabular text-[11px]">
                  <div class="text-foreground">{entry.package}</div>
                  <div class="text-base-content/60">{entry.pinCount} pins</div>
                </div>
                <ArrowRight class="size-3.5 text-base-content/40" />
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

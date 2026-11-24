<script lang="ts">
  import { Cpu, Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { catalogStore, searchCatalogEntries } from '../../state/catalog.svelte';
  import {
    buildVendorTabs,
    catalogFamilies,
    catalogPackageKinds,
  } from '../../core/vendor-view';
  import type { VendorId } from '../../core/types';

  interface Props {
    activeMcuId: string;
    onSelect: (mcuId: string) => void;
    onClose: () => void;
  }

  let { activeMcuId, onSelect, onClose }: Props = $props();

  let query = $state('');
  let vendorFilter = $state<VendorId | 'all'>('all');
  let familyFilter = $state('');
  let pkgFilter = $state('');
  let activeIdx = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  const vendorTabs = $derived(buildVendorTabs(catalogStore.meta, catalogStore.index));
  const familyOptions = $derived(catalogFamilies(catalogStore.index));
  const pkgOptions = $derived(catalogPackageKinds(catalogStore.index));

  const results = $derived.by(() =>
    searchCatalogEntries(
      catalogStore.index,
      query,
      { vendor: vendorFilter, family: familyFilter, packageKind: pkgFilter },
      50,
    ),
  );

  $effect(() => {
    // Reset highlighted index when results change
    results.length;
    activeIdx = 0;
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      onSelect(results[activeIdx].id);
      onClose();
    }
  }

  onMount(() => {
    catalogStore.ensureLoaded();
    inputEl?.focus();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-overlay flex items-start justify-center pt-[8vh] px-4"
  onclick={onClose}
>
  <div
    class="w-full max-w-2xl rounded-panel border-ui border-hairline bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[78vh]"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
    aria-label="Switch MCU"
  >
    <!-- Search bar -->
    <div class="flex items-center gap-2.5 px-4 py-3 border-ui-b border-hairline">
      <Search class="size-ui text-faint shrink-0" />
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Search part number, family, or package (e.g. G431, CH32V003, RP2350B)..."
        class="flex-1 bg-transparent text-sm text-primary placeholder:text-faint focus:outline-none font-mono"
      />
      <button
        type="button"
        onclick={onClose}
        class="p-1 rounded-control hover:bg-elevated text-muted"
        title="Close (Esc)"
      >
        <X class="size-ui" />
      </button>
    </div>

    <!-- Filter Controls -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-ui-b border-hairline bg-subtle text-xs">
      <div class="flex flex-wrap items-center gap-1">
        {#each vendorTabs as tab (tab.id)}
          <button
            type="button"
            onclick={() => (vendorFilter = tab.id)}
            class={`px-2 py-1 rounded-control font-mono whitespace-nowrap transition-colors ${
              vendorFilter === tab.id
                ? 'bg-action text-on-action font-medium'
                : 'bg-elevated text-primary hover:bg-elevated'
            }`}
          >
            {tab.label} <span class="font-mono-tabular opacity-75">({tab.count})</span>
          </button>
        {/each}
        <span class="mx-1 text-faint">|</span>
        <label class="inline-flex items-center gap-1 text-muted">
          Family
          <select
            bind:value={familyFilter}
            class="px-1.5 py-1 rounded-control bg-elevated border-ui border-hairline text-xs text-primary focus:outline-none focus:border-hint"
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
            class="px-1.5 py-1 rounded-control bg-elevated border-ui border-hairline text-xs text-primary focus:outline-none focus:border-hint"
          >
            <option value="">All</option>
            {#each pkgOptions as pkg (pkg)}
              <option value={pkg}>{pkg}</option>
            {/each}
          </select>
        </label>
      </div>
      <span class="font-mono-tabular text-[11px] text-muted">
        {results.length} shown of {catalogStore.index.length}
      </span>
    </div>

    <!-- Results List -->
    <div class="flex-1 overflow-y-auto divide-y divide-hairline">
      {#if catalogStore.loadingIndex}
        <div class="py-10 text-center text-xs text-muted">Loading multi-vendor catalog...</div>
      {:else if results.length === 0}
        <div class="py-10 text-center text-xs text-muted">
          No parts matched "{query}".
        </div>
      {:else}
        {#each results as entry, i (entry.id)}
          {@const isSelected = i === activeIdx}
          {@const isCurrent = entry.id === activeMcuId}
          <button
            type="button"
            onclick={() => {
              onSelect(entry.id);
              onClose();
            }}
            onmouseenter={() => (activeIdx = i)}
            class={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
              isSelected
                ? 'bg-info-soft'
                : 'hover:bg-elevated'
            }`}
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Cpu class="size-ui text-faint shrink-0" />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-semibold text-sm text-primary">
                    {entry.id}
                  </span>
                  <span class="px-1 py-px rounded-control border-ui border-hairline bg-subtle font-mono text-[9px] uppercase text-muted">
                    {entry.vendor ?? 'stm32'}
                  </span>
                  {#if isCurrent}
                    <span class="text-[11px] font-medium text-pin-success">
                      Active
                    </span>
                  {/if}
                </div>
                <div class="text-[11px] font-mono-tabular text-muted">
                  {entry.core} · {entry.flashKb} KB Flash · {entry.ramKb} KB RAM
                </div>
              </div>
            </div>
            <div class="text-right font-mono-tabular text-xs shrink-0">
              <div class="text-primary font-medium">{entry.package}</div>
              <div class="text-[11px] text-muted">
                {entry.pinCount} pins
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>

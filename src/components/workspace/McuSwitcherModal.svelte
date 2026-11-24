<script lang="ts">
  import { Cpu, Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { catalogStore, searchCatalogEntries } from '../../state/catalog.svelte';
  import { openDialogWithFocus } from '../../state/dialog-focus';
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
  let dialogEl = $state<HTMLDialogElement | null>(null);

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

  /** Native dialog close path; the close event notifies the parent once. */
  function closeDialog(): void {
    dialogEl?.close();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) activeIdx = (activeIdx - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      onSelect(results[activeIdx].id);
      closeDialog();
    }
  }

  onMount(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogEl?.open) dialogEl?.showModal();
    openDialogWithFocus(dialogEl, inputEl, opener);
    catalogStore.ensureLoaded();
  });
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  onclose={onClose}
  oncancel={(e) => {
    e.preventDefault();
    closeDialog();
  }}
  onclick={(e) => {
    if (e.target === dialogEl) closeDialog();
  }}
  aria-label="Switch MCU"
>
  <div
    class="modal-box w-full max-w-2xl p-0 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] min-h-0"
  >
    <!-- Search bar -->
    <div class="flex items-center gap-2.5 px-4 py-3 border-b border-base-300">
      <Search class="size-4 text-base-content/40 shrink-0" />
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={handleKeydown}
        type="text"
        placeholder="Search part number, family, or package (e.g. G431, CH32V003, RP2350B)..."
        class="input input-ghost flex-1 bg-transparent text-sm font-mono"
        aria-label="Search MCU catalog"
      />
      <button
        type="button"
        onclick={closeDialog}
        class="btn btn-ghost btn-sm btn-square"
        aria-label="Close MCU switcher"
        title="Close (Esc)"
      >
        <X class="size-4" />
      </button>
    </div>

    <!-- Filter Controls -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-base-300 bg-base-200 text-xs">
      <div class="join flex flex-wrap items-center gap-1">
        {#each vendorTabs as tab (tab.id)}
          <button
            type="button"
            onclick={() => (vendorFilter = tab.id)}
            class={`btn join-item btn-xs font-mono whitespace-nowrap ${
              vendorFilter === tab.id ? 'btn-active btn-primary' : 'btn-outline'
            }`}
          >
            {tab.label} <span class="font-mono-tabular opacity-75">({tab.count})</span>
          </button>
        {/each}
        <span class="mx-1 text-base-content/60">|</span>
        <label class="inline-flex items-center gap-1 text-base-content/60">
          Family
          <select
            bind:value={familyFilter}
            class="select select-xs"
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
            bind:value={pkgFilter}
            class="select select-xs"
            aria-label="Filter by package"
          >
            <option value="">All</option>
            {#each pkgOptions as pkg (pkg)}
              <option value={pkg}>{pkg}</option>
            {/each}
          </select>
        </label>
      </div>
      <span class="font-mono-tabular text-[11px] text-base-content/60">
        {results.length} shown of {catalogStore.index.length}
      </span>
    </div>

    <!-- Results List -->
    <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-base-300">
      {#if catalogStore.loadingIndex}
        <div class="py-10 text-center text-xs text-base-content/60">Loading multi-vendor catalog...</div>
      {:else if results.length === 0}
        <div class="py-10 text-center text-xs text-base-content/60">
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
              closeDialog();
            }}
            onmouseenter={() => (activeIdx = i)}
            class={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
              isSelected
                ? 'bg-info/15'
                : 'hover:bg-base-300'
            }`}
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Cpu class="size-4 text-base-content/40 shrink-0" />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-semibold text-sm text-foreground">
                    {entry.id}
                  </span>
                  <span class="badge badge-xs badge-ghost font-mono text-[9px] uppercase">
                    {entry.vendor ?? 'stm32'}
                  </span>
                  {#if isCurrent}
                    <span class="badge badge-xs badge-success text-[9px]">
                      Active
                    </span>
                  {/if}
                </div>
                <div class="text-[11px] font-mono-tabular text-base-content/60">
                  {entry.core} · {entry.flashKb} KB Flash · {entry.ramKb} KB RAM
                </div>
              </div>
            </div>
            <div class="text-right font-mono-tabular text-xs shrink-0">
              <div class="text-foreground font-medium">{entry.package}</div>
              <div class="text-[11px] text-base-content/60">
                {entry.pinCount} pins
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Close MCU switcher">close</button>
  </form>
</dialog>

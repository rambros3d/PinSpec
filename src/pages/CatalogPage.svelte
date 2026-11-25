<script lang="ts">
  import { Cpu, Search, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { catalogStore, searchCatalogEntries } from '../state/catalog.svelte';
  import {
    buildVendorTabs,
    catalogFamilies,
    catalogPackageKinds,
  } from '../core/vendor-view';
  import type { VendorId } from '../core/types';
  import { router } from '../state/router.svelte';

  let query = $state('');
  let vendorFilter = $state<VendorId | 'all'>('all');
  let familyFilter = $state('');
  let packageFilter = $state('');

  const vendorTabs = $derived(buildVendorTabs(catalogStore.meta, catalogStore.index));
  const familyOptions = $derived(catalogFamilies(catalogStore.index));
  const packageOptions = $derived(catalogPackageKinds(catalogStore.index));
  const results = $derived(
    searchCatalogEntries(
      catalogStore.index,
      query,
      { vendor: vendorFilter, family: familyFilter, packageKind: packageFilter },
      500,
    ),
  );
  const hasFilters = $derived(
    query.trim().length > 0 || vendorFilter !== 'all' || familyFilter !== '' || packageFilter !== '',
  );

  function resetFilters(): void {
    query = '';
    vendorFilter = 'all';
    familyFilter = '';
    packageFilter = '';
  }

  onMount(() => {
    catalogStore.ensureLoaded();
  });
</script>

<div class="shell-route flex flex-col bg-base-200 text-foreground">
  <header class="navbar shrink-0 border-b border-base-300 bg-base-100/95 backdrop-blur-xs">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4 w-full">
      <div class="min-w-0">
        <h1 class="text-base font-semibold tracking-tight text-foreground">Catalog</h1>
        <p class="text-[11px] text-base-content/60 font-mono-tabular">
          {#if catalogStore.meta}
            {catalogStore.meta.chipCount.toLocaleString()} parts indexed
          {:else}
            Loading generated catalog
          {/if}
        </p>
      </div>
      <a href="#/" class="btn btn-ghost btn-sm">Start screen</a>
    </div>
  </header>

  <main class="max-w-7xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
    <section class="card card-border bg-base-100 p-5 space-y-4">
      <div class="flex items-center gap-2.5">
        <Search class="size-4 text-base-content/40 shrink-0" />
        <input
          bind:value={query}
          type="text"
          class="input w-full font-mono"
          placeholder="Filter by part, family, package or core"
          aria-label="Search the catalog"
        />
        {#if hasFilters}
          <button type="button" onclick={resetFilters} class="btn btn-ghost btn-sm btn-square" aria-label="Clear filters" title="Clear filters">
            <X class="size-4" />
          </button>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        {#each vendorTabs as tab (tab.id)}
          <button
            type="button"
            onclick={() => (vendorFilter = tab.id)}
            class={`btn btn-sm font-mono whitespace-nowrap ${vendorFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
          >
            {tab.label} <span class="font-mono-tabular opacity-75">({tab.count})</span>
          </button>
        {/each}
        <span class="text-base-content/60 mx-0.5">|</span>
        <label class="inline-flex items-center gap-1 text-base-content/60">
          Family
          <select bind:value={familyFilter} class="select select-sm" aria-label="Filter by family">
            <option value="">All</option>
            {#each familyOptions as fam (fam)}
              <option value={fam}>{fam}</option>
            {/each}
          </select>
        </label>
        <label class="inline-flex items-center gap-1 text-base-content/60">
          Package
          <select bind:value={packageFilter} class="select select-sm" aria-label="Filter by package">
            <option value="">All</option>
            {#each packageOptions as pkg (pkg)}
              <option value={pkg}>{pkg}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>

    {#if catalogStore.indexError}
      <div role="alert" class="card card-border bg-base-100 p-8 text-center space-y-3">
        <p class="text-sm text-error">{catalogStore.indexError}</p>
        <button type="button" onclick={() => catalogStore.retry()} class="btn btn-sm btn-outline">
          Retry catalog load
        </button>
      </div>
    {:else if catalogStore.loadingIndex}
      <p class="py-10 text-center text-xs text-base-content/60">Loading multi-vendor catalog...</p>
    {:else if results.length === 0}
      <p class="py-10 text-center text-xs text-base-content/60">No parts matched the current filters.</p>
    {:else}
      <section class="card card-border bg-base-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table table-sm w-full text-left text-xs">
            <thead class="bg-base-200 text-[11px] text-base-content/60 uppercase tracking-wide">
              <tr>
                <th class="px-4 py-2 font-medium">Part</th>
                <th class="px-2 py-2 font-medium">Vendor</th>
                <th class="px-2 py-2 font-medium">Family</th>
                <th class="px-2 py-2 font-medium">Package</th>
                <th class="px-2 py-2 font-medium">Pins</th>
                <th class="px-2 py-2 font-medium">Flash / RAM</th>
                <th class="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {#each results as entry (entry.id)}
                <tr class="border-t border-base-300">
                  <td class="px-4 py-2">
                    <span class="flex items-center gap-2 font-mono font-semibold text-foreground">
                      <Cpu class="size-3.5 text-base-content/40 shrink-0" />
                      {entry.id}
                      {#if entry.module}
                        <span class="badge badge-xs badge-outline font-mono text-[9px] uppercase">MODULE</span>
                      {/if}
                    </span>
                  </td>
                  <td class="px-2 py-2 font-mono text-base-content/60">{entry.vendor ?? 'stm32'}</td>
                  <td class="px-2 py-2 font-mono text-base-content/60">{entry.family}</td>
                  <td class="px-2 py-2 font-mono text-foreground">{entry.package}</td>
                  <td class="px-2 py-2 font-mono-tabular text-base-content/60">{entry.pinCount}</td>
                  <td class="px-2 py-2 font-mono-tabular text-base-content/60">
                    {entry.flashKb ?? '—'} KB / {entry.ramKb} KB
                  </td>
                  <td class="px-2 py-2 text-right">
                    <button
                      type="button"
                      onclick={() => router.navigateMcu(entry.id)}
                      class="btn btn-xs btn-outline"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  </main>
</div>

<script lang="ts">
  import Cpu from '@solar-icons/svelte/bold-duotone/cpu';
  import Search from '@solar-icons/svelte/bold-duotone/magnifier';
  import X from '@solar-icons/svelte/bold-duotone/close';
  import { onMount } from 'svelte';
  import PackageThumbnail from '../components/catalog/PackageThumbnail.svelte';
  import { thumbnailGeometryFromIndex } from '../core/package-thumbnail';
  import {
    buildVendorTabs,
    catalogFamilies,
    catalogPackageKinds,
  } from '../core/vendor-view';
  import { catalogStore, searchCatalogEntries } from '../state/catalog.svelte';
  import { discoveryPreferences } from '../state/discovery-preferences.svelte';
  import { router } from '../state/router.svelte';

  /* Discovery filters are localStorage-only preferences, never shareable. */
  const filters = discoveryPreferences.catalog;

  const vendorTabs = $derived(buildVendorTabs(catalogStore.meta, catalogStore.index));
  const familyOptions = $derived(catalogFamilies(catalogStore.index));
  const packageOptions = $derived(catalogPackageKinds(catalogStore.index));
  const results = $derived(
    searchCatalogEntries(
      catalogStore.index,
      filters.query,
      { vendor: filters.vendor, family: filters.family, packageKind: filters.package },
      500,
    ),
  );
  const hasFilters = $derived(
    filters.query.trim().length > 0 ||
      filters.vendor !== 'all' ||
      filters.family !== '' ||
      filters.package !== '',
  );

  function resetFilters(): void {
    filters.reset();
  }

  onMount(() => {
    catalogStore.ensureLoaded();
  });
</script>

<div class="shell-route flex flex-col bg-base-200 text-foreground">
  <main class="max-w-7xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
    <p class="text-[11px] text-base-content/60 font-mono-tabular">
      {#if catalogStore.meta}
        {catalogStore.index.length.toLocaleString()} parts indexed
      {:else}
        Loading generated catalog
      {/if}
    </p>
    <section class="card card-border bg-base-100 p-5 space-y-4">
      <div class="flex items-center gap-2.5">
        <Search class="size-4 text-base-content/40 shrink-0" />
        <input
          bind:value={filters.query}
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
            onclick={() => (filters.vendor = tab.id)}
            class={`btn btn-sm font-mono whitespace-nowrap ${filters.vendor === tab.id ? 'btn-primary' : 'btn-outline'}`}
          >
            {tab.label} <span class="font-mono-tabular opacity-75">({tab.count})</span>
          </button>
        {/each}
        <span class="text-base-content/60 mx-0.5">|</span>
        <label class="inline-flex items-center gap-1 text-base-content/60">
          Family
          <select bind:value={filters.family} class="select select-sm" aria-label="Filter by family">
            <option value="">All</option>
            {#each familyOptions as fam (fam)}
              <option value={fam}>{fam}</option>
            {/each}
          </select>
        </label>
        <label class="inline-flex items-center gap-1 text-base-content/60">
          Package
          <select bind:value={filters.package} class="select select-sm" aria-label="Filter by package">
            <option value="">All</option>
            {#each packageOptions as pkg (pkg)}
              <option value={pkg}>{pkg}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>

    {#if catalogStore.indexError}
      <div role="alert" class="alert alert-soft alert-error p-8 text-center space-y-3">
        <p class="text-sm">{catalogStore.indexError}</p>
        <button type="button" onclick={() => catalogStore.retry()} class="btn btn-sm btn-outline">
          Retry catalog load
        </button>
      </div>
    {:else if catalogStore.loadingIndex}
      <p class="py-10 text-center text-xs text-base-content/60">
        <span class="loading loading-spinner loading-xs"></span>
        Loading multi-vendor catalog...
      </p>
    {:else if results.length === 0}
      <p class="py-10 text-center text-xs text-base-content/60">No parts matched the current filters.</p>
    {:else}
      <section class="card card-border bg-base-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table table-sm w-full text-left text-xs">
            <thead class="bg-base-200 text-[11px] text-base-content/60 uppercase tracking-wide">
              <tr>
                <th class="w-12 px-2 py-2 font-medium">Outline</th>
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
                  <td class="w-12 px-2 py-2">
                    <PackageThumbnail geometry={thumbnailGeometryFromIndex(entry)} size={44} />
                  </td>
                  <td class="px-4 py-2">
                    <span class="flex items-center gap-2 font-mono font-semibold text-foreground">
                      <Cpu class="size-3.5 text-base-content/40 shrink-0" />
                      {entry.id}
                      {#if entry.module}
                        <span class="badge badge-xs badge-outline font-mono text-[9px] uppercase">MODULE</span>
                      {/if}
                    </span>
                  </td>
                  <td class="px-2 py-2 font-mono text-base-content/60">{entry.vendor}</td>
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

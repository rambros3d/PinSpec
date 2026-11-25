<script lang="ts">
  import {
    PROVENANCE_SOURCES,
    PROVENANCE_VENDORS,
    SHORTCUTS,
  } from '../../data/provenance';
  import { catalogStore } from '../../state/catalog.svelte';
  import type { AboutTab } from '../../state/shell-preferences.svelte';

  interface Props {
    tab: AboutTab;
  }

  let { tab }: Props = $props();

  function formatSyncDate(iso: string | undefined): string {
    if (!iso) return 'pending';
    try {
      return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    } catch {
      return iso;
    }
  }
</script>

<div class="space-y-8">
  {#if tab === 'sources'}
    <section class="card card-border bg-base-100 p-5 space-y-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-sm font-semibold text-foreground">Per-vendor chip counts and source revisions</h2>
        <span class="font-mono-tabular text-[11px] text-base-content/60">
          {#if catalogStore.meta}
            {catalogStore.meta.chipCount.toLocaleString()} MCUs indexed · Synced {formatSyncDate(catalogStore.meta.generatedAt)}
          {:else}
            Catalog statistics unavailable
          {/if}
        </span>
      </div>
      {#if catalogStore.meta}
        <div class="space-y-3">
          {#each PROVENANCE_VENDORS as vendor (vendor.id)}
            {@const vendorSource = catalogStore.meta.sources?.[vendor.id]}
            {#if vendorSource}
              <div class="text-xs space-y-1 border-b border-base-300 pb-2">
                <div class="flex flex-wrap justify-between gap-2">
                  <span class="font-mono font-semibold text-foreground">{vendor.label}</span>
                  <span class="font-mono-tabular text-base-content/60">
                    {vendorSource.chipCount.toLocaleString()} chips · primary revision {vendorSource.commit ?? 'unknown'}
                    {#if vendorSource.ratios}
                      · match {vendorSource.ratios.match.toFixed(1)}% · coverage {vendorSource.ratios.coverage.toFixed(1)}%
                    {/if}
                  </span>
                </div>
                {#each vendorSource.repositories ?? [] as repo (repo.id)}
                  <div class="font-mono text-[11px] text-base-content/60">
                    {repo.id} {repo.commit} ({repo.license})
                  </div>
                {/each}
              </div>
            {/if}
          {/each}
        </div>
      {:else if catalogStore.indexError}
        <p role="alert" class="text-xs text-error">{catalogStore.indexError}</p>
        <button type="button" onclick={() => catalogStore.retry()} class="btn btn-sm btn-outline">
          Retry catalog load
        </button>
      {:else}
        <p class="text-xs text-base-content/60">Loading catalog statistics...</p>
      {/if}
    </section>

    <section class="card card-border bg-base-100 p-5 space-y-3">
      <h2 class="text-sm font-semibold text-foreground">Upstream data sources and licenses</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        {#each PROVENANCE_SOURCES as source (source.id)}
          {@const record = catalogStore.meta?.sources?.[source.id]}
          <div class="text-[11px] flex flex-wrap items-baseline gap-x-1">
            <a class="underline hover:text-foreground" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
            <span class="text-base-content/60">({source.license}) · {record?.sha ?? 'loading'}</span>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section class="card card-border bg-base-100 p-5 space-y-3">
      <h2 class="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
      <ul class="space-y-1.5 text-xs">
        {#each SHORTCUTS as shortcut (shortcut.keys)}
          <li class="flex items-center justify-between gap-3">
            <kbd class="kbd kbd-sm font-mono text-[11px] whitespace-nowrap">{shortcut.keys}</kbd>
            <span class="text-base-content/60 text-right">{shortcut.action}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- The shortcut reference remains available while viewing sources. -->
  {#if tab === 'sources'}
    <section class="card card-border bg-base-100 p-5 space-y-2">
      <h2 class="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
      <p class="text-[11px] text-base-content/60">
        {#each SHORTCUTS as shortcut (shortcut.keys)}
          <span class="font-mono">{shortcut.keys}</span> {shortcut.action};
        {/each}
      </p>
    </section>
  {/if}
</div>

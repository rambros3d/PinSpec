<script lang="ts">
  /**
   * One grouped Catalog sources table. Totals, vendor summaries, canonical
   * source revisions and load states all belong to this surface; About owns no
   * separate summary or shortcut card.
   */
  import {
    PROVENANCE_SOURCES,
    PROVENANCE_VENDORS,
  } from '../../data/provenance';
  import type { CatalogSourceId, VendorId } from '../../core/types';
  import { catalogStore } from '../../state/catalog.svelte';

  /** Family count comes from the generated index, not a duplicated meta field. */
  const familyCount = $derived(new Set(catalogStore.index.map((entry) => entry.family)).size);

  /** Static attribution grouping; no hardware fact is inferred from it. */
  const SOURCE_GROUPS: Partial<Record<VendorId, readonly CatalogSourceId[]>> = {
    stm32: ['st-open-pin-data', 'stm32-data-generated'],
    ch32: ['ch32-device-data'],
    rp: ['kicad', 'pico-sdk', 'zephyr', 'raspberry-pi-docs'],
    esp32: ['esp-gpio-tool', 'esp-hal-metadata', 'espressif-kicad', 'esp-idf'],
    microchip: ['microchip-atdf'],
    nordic: ['nrf-pacs'],
  };

  function formatSyncDate(iso: string | undefined): string {
    if (!iso) return 'pending';
    try {
      return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    } catch {
      return iso;
    }
  }

  function sourceGroup(vendor: VendorId): readonly CatalogSourceId[] {
    return SOURCE_GROUPS[vendor] ?? [];
  }
</script>

<section class="card card-border bg-base-100 overflow-hidden" aria-labelledby="catalog-sources-title">
  <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-300 px-5 py-4">
    <h2 id="catalog-sources-title" class="text-sm font-semibold text-foreground">Catalog sources</h2>
    <span class="font-mono-tabular text-[11px] text-base-content/60">
      {#if catalogStore.meta}
        {catalogStore.index.length.toLocaleString()} parts indexed · {familyCount} families · Synced {formatSyncDate(catalogStore.meta.generatedAt)}
      {:else}
        Catalog statistics unavailable
      {/if}
    </span>
  </div>

  {#if catalogStore.meta}
    <div class="overflow-x-auto">
      <table class="table table-sm w-full text-left text-xs">
        <thead class="bg-base-200 text-[11px] text-base-content/60 uppercase tracking-wide">
          <tr>
            <th class="px-4 py-2 font-medium">Vendor / source</th>
            <th class="px-2 py-2 font-medium">Chips</th>
            <th class="px-2 py-2 font-medium">Match / coverage</th>
            <th class="px-2 py-2 font-medium">Synced</th>
            <th class="px-2 py-2 font-medium">Revision / license</th>
          </tr>
        </thead>
        <tbody>
          {#each PROVENANCE_VENDORS as vendor (vendor.id)}
            {@const vendorSource = catalogStore.meta.sources?.[vendor.id]}
            {#if vendorSource}
              <tr class="border-t border-base-300 bg-base-200/50">
                <td class="px-4 py-2 font-mono font-semibold text-foreground">{vendor.label}</td>
                <td class="px-2 py-2 font-mono-tabular text-base-content/60">
                  {vendorSource.chipCount.toLocaleString()}
                </td>
                <td class="px-2 py-2 font-mono-tabular text-base-content/60">
                  {#if vendorSource.ratios}
                    {vendorSource.ratios.match.toFixed(1)}% / {vendorSource.ratios.coverage.toFixed(1)}%
                  {:else}
                    —
                  {/if}
                </td>
                <td class="px-2 py-2 font-mono-tabular text-base-content/60">
                  {formatSyncDate(catalogStore.meta.generatedAt)}
                </td>
                <td class="px-2 py-2 font-mono text-base-content/60">
                  {vendorSource.commit ?? 'unknown'} · {vendorSource.license}
                </td>
              </tr>
              {#each sourceGroup(vendor.id) as sourceId (sourceId)}
                {@const source = PROVENANCE_SOURCES.find((item) => item.id === sourceId)}
                {@const record = catalogStore.meta.sources?.[sourceId]}
                {#if source}
                  <tr class="border-t border-base-300">
                    <td class="px-4 py-2 pl-8 font-mono text-[11px] text-base-content/60">
                      <a class="link link-hover" href={source.url} target="_blank" rel="noreferrer">{source.id}</a>
                    </td>
                    <td class="px-2 py-2 font-mono text-base-content/60">—</td>
                    <td class="px-2 py-2 font-mono text-base-content/60">—</td>
                    <td class="px-2 py-2 font-mono-tabular text-base-content/60">
                      {record?.sha ?? 'pending'}
                    </td>
                    <td class="px-2 py-2 text-[11px] text-base-content/60">{source.license}</td>
                  </tr>
                {/if}
              {/each}
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {:else if catalogStore.indexError}
    <p role="alert" class="alert alert-soft alert-error px-5 py-6 text-center text-xs">
      {catalogStore.indexError}
    </p>
    <div class="px-5 pb-5 text-center">
      <button type="button" onclick={() => catalogStore.retry()} class="btn btn-sm btn-outline">
        Retry catalog load
      </button>
    </div>
  {:else}
    <p class="px-5 py-6 text-center text-xs text-base-content/60">
      <span class="loading loading-spinner loading-xs"></span>
      Loading catalog statistics...
    </p>
  {/if}
</section>

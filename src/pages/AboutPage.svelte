<script lang="ts">
  import ProvenancePanel from '../components/about/ProvenancePanel.svelte';
  import { catalogStore } from '../state/catalog.svelte';
  import {
    ABOUT_TABS,
    shellPreferences,
    type AboutTab,
  } from '../state/shell-preferences.svelte';
  import { onMount } from 'svelte';

  const TAB_LABELS: Record<AboutTab, string> = {
    sources: 'Sources and licenses',
    shortcuts: 'Shortcuts',
  };

  onMount(() => {
    catalogStore.ensureLoaded();
  });
</script>

<div class="shell-route flex flex-col bg-base-200 text-foreground">
  <header class="navbar shrink-0 border-b border-base-300 bg-base-100/95 backdrop-blur-xs">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4 w-full">
      <div class="min-w-0">
        <h1 class="text-base font-semibold tracking-tight text-foreground">About</h1>
        <p class="text-[11px] text-base-content/60">Catalog provenance and keyboard reference.</p>
      </div>
      <a href="#/" class="btn btn-ghost btn-sm">Start screen</a>
    </div>
  </header>

  <main class="max-w-5xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
    <section class="card card-border bg-base-100 p-5 space-y-2">
      <h2 class="text-sm font-semibold text-foreground">Catalog summary</h2>
      {#if catalogStore.meta}
        <p class="text-xs text-base-content/60 font-mono-tabular">
          {catalogStore.meta.chipCount.toLocaleString()} parts indexed · {catalogStore.meta.families.length} families
        </p>
      {:else if catalogStore.indexError}
        <p role="alert" class="text-xs text-error">{catalogStore.indexError}</p>
        <button type="button" onclick={() => catalogStore.retry()} class="btn btn-sm btn-outline">
          Retry catalog load
        </button>
      {:else}
        <p class="text-xs text-base-content/60">Loading catalog statistics...</p>
      {/if}
    </section>

    <div role="tablist" aria-label="About sections" class="tabs tabs-boxed w-fit">
      {#each ABOUT_TABS as tab (tab)}
        <button
          type="button"
          role="tab"
          aria-selected={shellPreferences.aboutTab === tab}
          onclick={() => (shellPreferences.aboutTab = tab)}
          class={`tab ${shellPreferences.aboutTab === tab ? 'tab-active font-semibold' : ''}`}
        >
          {TAB_LABELS[tab]}
        </button>
      {/each}
    </div>

    <ProvenancePanel tab={shellPreferences.aboutTab} />
  </main>
</div>

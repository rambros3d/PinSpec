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
  };

  onMount(() => {
    catalogStore.ensureLoaded();
  });
</script>

<div class="shell-route flex flex-col bg-base-200 text-foreground">
  <main class="max-w-5xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
    <div role="tablist" aria-label="About sections" class="tabs tabs-box w-fit">
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

<script lang="ts">
  import ProvenancePanel from '../components/about/ProvenancePanel.svelte';
  import { catalogStore } from '../state/catalog.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    catalogStore.ensureLoaded();
  });
</script>

<div class="shell-route flex flex-col bg-base-200 text-foreground">
  <main class="max-w-5xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
    <ProvenancePanel />
  </main>
</div>

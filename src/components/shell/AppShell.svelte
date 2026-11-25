<script lang="ts">
  import type { Snippet } from 'svelte';
  import GlobalSidebar from './GlobalSidebar.svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<!-- One mount for every route; the sidebar overlays and never reflows content. -->
<div class="app-shell">
  <GlobalSidebar />
  <div class="app-shell-content">
    {@render children?.()}
  </div>
</div>

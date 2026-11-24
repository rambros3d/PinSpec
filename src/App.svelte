<script lang="ts">
  import LandingPage from './pages/LandingPage.svelte';
  import WorkspacePage from './pages/WorkspacePage.svelte';
  import { router } from './state/router.svelte';
</script>

{#if router.route.view === 'landing'}
  <LandingPage />
{:else if router.route.view === 'workspace'}
  <WorkspacePage mcuId={router.route.mcuId} />
{:else if router.route.view === 'shared'}
  <WorkspacePage sharedPayload={router.route.payload} />
{/if}

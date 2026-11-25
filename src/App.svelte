<script lang="ts">
  import AppShell from './components/shell/AppShell.svelte';
  import AboutPage from './pages/AboutPage.svelte';
  import CatalogPage from './pages/CatalogPage.svelte';
  import LandingPage from './pages/LandingPage.svelte';
  import ProjectsPage from './pages/ProjectsPage.svelte';
  import WorkspacePage from './pages/WorkspacePage.svelte';
  import { router } from './state/router.svelte';
</script>

<AppShell>
  {#if router.route.view === 'landing'}
    <LandingPage />
  {:else if router.route.view === 'catalog'}
    <CatalogPage />
  {:else if router.route.view === 'projects'}
    <ProjectsPage />
  {:else if router.route.view === 'about'}
    <AboutPage />
  {:else if router.route.view === 'workspace'}
    <WorkspacePage mcuId={router.route.mcuId} />
  {:else if router.route.view === 'shared'}
    <WorkspacePage sharedPayload={router.route.payload} />
  {/if}
</AppShell>

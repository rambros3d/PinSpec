<script lang="ts">
  import CircuitBoard from '@solar-icons/svelte/bold-duotone/cpu';
  import FolderOpen from '@solar-icons/svelte/bold-duotone/folder-open';
  import Home from '@solar-icons/svelte/bold-duotone/home';
  import Info from '@solar-icons/svelte/bold-duotone/info-circle';
  import Keyboard from '@solar-icons/svelte/bold-duotone/keyboard';
  import LayoutGrid from '@solar-icons/svelte/bold-duotone/grid-2x2';
  import PanelLeftClose from '@solar-icons/svelte/bold-duotone/panel-left-close';
  import PanelLeftOpen from '@solar-icons/svelte/bold-duotone/panel-left-open';
  import Trash2 from '@solar-icons/svelte/bold-duotone/trash-bin-trash';
  import { router } from '../../state/router.svelte';
  import { shellPreferences } from '../../state/shell-preferences.svelte';
  import { topBarUI } from '../../state/top-bar-ui.svelte';
  import { workspaceStore } from '../../state/workspace.svelte';

  interface Section {
    id: 'home' | 'workspace' | 'catalog' | 'projects' | 'about';
    label: string;
    hash: string;
    icon: typeof Home;
  }

  const SECTIONS: readonly Section[] = [
    { id: 'home', label: 'Home', hash: '#/', icon: Home },
    { id: 'workspace', label: 'Workspace', hash: '', icon: CircuitBoard },
    { id: 'catalog', label: 'Catalog', hash: '#/catalog', icon: LayoutGrid },
    { id: 'projects', label: 'Projects', hash: '#/projects', icon: FolderOpen },
    { id: 'about', label: 'About', hash: '#/about', icon: Info },
  ];

  const TOP_SECTIONS = SECTIONS.filter(
    (s) => s.id === 'home' || s.id === 'workspace' || s.id === 'projects',
  );
  const BOTTOM_SECTIONS = SECTIONS.filter((s) => s.id === 'catalog' || s.id === 'about');

  const expanded = $derived(shellPreferences.sidebarExpanded);
  const activeSection = $derived(
    router.route.view === 'workspace' || router.route.view === 'shared'
      ? 'workspace'
      : router.route.view,
  );
  const recent = $derived(workspaceStore.recentSessions.slice(0, 10));
  const workspaceTarget = $derived(
    workspaceStore.chip?.id ?? workspaceStore.recentSessions[0]?.mcuId ?? null,
  );

  function navigate(section: Section): void {
    if (section.id === 'home') router.navigateHome();
    else if (section.id === 'catalog') router.navigateCatalog();
    else if (section.id === 'projects') router.navigateProjects();
    else router.navigateAbout();
  }

  /** Open the loaded chip, or hydrate the most recent session before routing. */
  function openWorkspace(): void {
    if (!workspaceTarget) return;
    if (!workspaceStore.chip) void workspaceStore.openMcu(workspaceTarget);
    router.navigateMcu(workspaceTarget);
  }

  function sectionClass(section: Section): string {
    return `flex items-center rounded-box py-2 text-base-content/70 transition-colors ${
      expanded ? 'gap-3 px-3' : 'justify-center px-0'
    } ${activeSection === section.id ? 'bg-info/15 font-semibold text-info' : 'hover:bg-base-300'}`;
  }

  function openRecent(mcuId: string): void {
    void workspaceStore.openMcu(mcuId);
    router.navigateMcu(mcuId);
  }

  function deleteRecent(mcuId: string): void {
    workspaceStore.deleteRecentSession(mcuId);
  }
</script>

{#if expanded}
  <!-- Activation closes the overlay without changing any route or pin state. -->
  <button
    type="button"
    class="shell-backdrop fixed inset-0 z-30 cursor-default bg-neutral/50"
    aria-label="Close navigation"
    onclick={() => (shellPreferences.sidebarExpanded = false)}
  ></button>
{/if}

<aside
  class={`shell-panel fixed bottom-0 left-0 top-12 z-40 flex flex-col border-r border-base-300 bg-base-100 ${expanded ? 'w-72' : 'shell-rail w-12'}`}
  aria-label="Application navigation"
>
  <div
    class={`flex h-12 shrink-0 items-center border-b border-base-300 ${expanded ? 'px-3' : 'justify-center'}`}
  >
    {#if expanded}
      <img
        src={`${import.meta.env.BASE_URL}radiokit-logo.svg`}
        alt=""
        class="size-5 shrink-0"
      />
      <span class="truncate text-sm font-semibold text-foreground">PinCraft</span>
    {/if}
  </div>

  <nav class="shrink-0 space-y-1 py-2" aria-label="Sections">
    {#each TOP_SECTIONS as section (section.id)}
      {@const Icon = section.icon}
      {#if section.id === 'workspace'}
        {#if workspaceTarget}
          <a
            href={`#/mcu/${workspaceTarget}`}
            onclick={(e) => {
              e.preventDefault();
              openWorkspace();
            }}
            aria-current={activeSection === section.id ? 'page' : undefined}
            title={section.label}
            class={sectionClass(section)}
          >
            <Icon class="size-4 shrink-0" />
            {#if expanded}
              <span class="truncate text-xs">{section.label}</span>
            {/if}
          </a>
        {:else}
          <button
            type="button"
            disabled
            title={section.label}
            aria-label={section.label}
            class={`${sectionClass(section)} cursor-not-allowed opacity-40`}
          >
            <Icon class="size-4 shrink-0" />
            {#if expanded}
              <span class="truncate text-xs">{section.label}</span>
            {/if}
          </button>
        {/if}
      {:else}
        <a
          href={section.hash}
          onclick={(e) => {
            e.preventDefault();
            navigate(section);
          }}
          aria-current={activeSection === section.id ? 'page' : undefined}
          title={section.label}
          class={sectionClass(section)}
        >
          <Icon class="size-4 shrink-0" />
          {#if expanded}
            <span class="truncate text-xs">{section.label}</span>
          {/if}
        </a>
      {/if}
    {/each}
  </nav>

  {#if expanded}
    <div class="shrink-0 px-3 pb-1 pt-3 text-[10px] uppercase tracking-wide text-base-content/50">
      Recent projects
    </div>
    <div class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
      {#if recent.length === 0}
        <p class="px-1 py-2 text-[11px] text-base-content/60">
          No recent projects. Opening a part creates a recent session in this browser.
        </p>
      {:else}
        {#each recent as session (session.mcuId)}
          <div class="flex items-center gap-1 rounded-box hover:bg-base-200">
            <button
              type="button"
              onclick={() => openRecent(session.mcuId)}
              class="min-w-0 flex-1 px-2 py-1.5 text-left"
              title={`Open ${session.mcuId}`}
            >
              <span class="block truncate font-mono text-[11px] text-foreground">{session.mcuId}</span>
              {#if session.state.projectName}
                <span class="block truncate text-[10px] text-base-content/70">{session.state.projectName}</span>
              {/if}
              <span class="block font-mono-tabular text-[10px] text-base-content/60">
                {session.assignedCount}/{session.pinCount} pins
              </span>
            </button>
            <button
              type="button"
              onclick={() => deleteRecent(session.mcuId)}
              class="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-error"
              aria-label={`Delete ${session.mcuId}`}
              title="Delete session"
            >
              <Trash2 class="size-3" />
            </button>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  <div class="mx-2 border-t border-base-300" role="separator" aria-orientation="horizontal"></div>

  <nav class="shrink-0 space-y-1 py-2" aria-label="More sections">
    {#each BOTTOM_SECTIONS as section (section.id)}
      {@const Icon = section.icon}
      {#if section.id === 'about'}
        <!-- Transient dialog flag; the entry has no hash target and no persisted state. -->
        <button
          type="button"
          onclick={() => (topBarUI.shortcutHelpOpen = true)}
          class={`flex w-full items-center rounded-box py-2 text-base-content/70 transition-colors ${
            expanded ? 'gap-3 px-3' : 'justify-center px-0'
          } hover:bg-base-300`}
          title="Hotkeys"
          aria-label="Hotkeys"
        >
          <Keyboard class="size-4 shrink-0" />
          {#if expanded}
            <span class="truncate text-xs">Hotkeys</span>
          {/if}
        </button>
      {/if}
      <a
        href={section.hash}
        onclick={(e) => {
          e.preventDefault();
          navigate(section);
        }}
        aria-current={activeSection === section.id ? 'page' : undefined}
        title={section.label}
        class={sectionClass(section)}
      >
        <Icon class="size-4 shrink-0" />
        {#if expanded}
          <span class="truncate text-xs">{section.label}</span>
        {/if}
      </a>
    {/each}
  </nav>

  <div class="mt-auto shrink-0 border-t border-base-300 p-2">
    <button
      type="button"
      onclick={() => (shellPreferences.sidebarExpanded = !expanded)}
      class={`flex w-full items-center rounded-box py-2 text-base-content/70 transition-colors hover:bg-base-300 ${
        expanded ? 'gap-3 px-3' : 'justify-center px-0'
      }`}
      aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
      title={expanded ? 'Collapse navigation' : 'Expand navigation'}
    >
      {#if expanded}
        <PanelLeftClose class="size-4 shrink-0" />
        <span class="truncate text-xs">Collapse navigation</span>
      {:else}
        <PanelLeftOpen class="size-4 shrink-0" />
      {/if}
    </button>
  </div>
</aside>

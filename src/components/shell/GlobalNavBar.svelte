<script lang="ts">
  import CircuitBoard from '@solar-icons/svelte/bold-duotone/cpu';
  import FolderOpen from '@solar-icons/svelte/bold-duotone/folder-open';
  import Home from '@solar-icons/svelte/bold-duotone/home';
  import Info from '@solar-icons/svelte/bold-duotone/info-circle';
  import Keyboard from '@solar-icons/svelte/bold-duotone/keyboard';
  import LayoutGrid from '@solar-icons/svelte/bold-duotone/grid-2x2';
  import { router } from '../../state/router.svelte';
  import { topBarUI } from '../../state/top-bar-ui.svelte';
  import { workspaceStore } from '../../state/workspace.svelte';
  import ThemePicker from '../ThemePicker.svelte';

  type SectionId = 'home' | 'workspace' | 'projects' | 'catalog' | 'about';

  interface NavEntry {
    id: SectionId;
    label: string;
    hash: string;
    icon: typeof Home;
  }

  /** Left group: section destinations that do not depend on a loaded chip. */
  const LEFT_ENTRIES: readonly NavEntry[] = [
    { id: 'home', label: 'Home', hash: '#/', icon: Home },
    { id: 'projects', label: 'Projects', hash: '#/projects', icon: FolderOpen },
    { id: 'catalog', label: 'Catalog', hash: '#/catalog', icon: LayoutGrid },
  ];

  const activeSection = $derived<SectionId>(() => {
    const view = router.route.view;
    if (view === 'landing') return 'home';
    if (view === 'workspace' || view === 'shared') return 'workspace';
    return view;
  });

  const isWorkspace = $derived(
    router.route.view === 'workspace' || router.route.view === 'shared',
  );
  const workspaceTarget = $derived(
    workspaceStore.chip?.id ?? workspaceStore.recentSessions[0]?.mcuId ?? null,
  );

  function navigate(entry: NavEntry): void {
    if (entry.id === 'home') router.navigateHome();
    else if (entry.id === 'projects') router.navigateProjects();
    else router.navigateCatalog();
  }

  /** Open the loaded chip, or hydrate the most recent session before routing. */
  function openWorkspace(): void {
    if (!workspaceTarget) return;
    if (!workspaceStore.chip) void workspaceStore.openMcu(workspaceTarget);
    router.navigateMcu(workspaceTarget);
  }

  /** Icon layers keep the accent token; the active section keeps info emphasis. */
  function iconClass(id: SectionId): string {
    return `size-4 shrink-0 ${activeSection === id ? 'text-info' : 'text-accent'}`;
  }

  function entryClass(id: SectionId): string {
    return `btn btn-ghost btn-sm gap-1 px-1 text-xs whitespace-nowrap sm:px-3 ${
      activeSection === id ? 'btn-active font-semibold text-info' : 'text-base-content/70'
    }`;
  }
</script>

<header
  class="global-nav-bar relative flex h-8 shrink-0 items-center justify-between gap-1 border-b border-base-300 bg-base-100 px-2 select-none"
  aria-label="Global navigation"
>
  <nav class="flex min-w-0 items-center gap-1" aria-label="Sections">
    {#each LEFT_ENTRIES as entry (entry.id)}
      {@const Icon = entry.icon}
      <a
        href={entry.hash}
        onclick={(e) => {
          e.preventDefault();
          navigate(entry);
        }}
        aria-current={activeSection === entry.id ? 'page' : undefined}
        title={entry.label}
        aria-label={entry.label}
        class={entryClass(entry.id)}
      >
        <Icon class={iconClass(entry.id)} />
        <span class="hidden sm:inline">{entry.label}</span>
      </a>
    {/each}
  </nav>

  {#if !isWorkspace}
    <div class="absolute left-1/2 -translate-x-1/2">
      <span class="flex shrink-0 items-center gap-1.5" title="PinSpec">
        <img
          src={`${import.meta.env.BASE_URL}radiokit-logo.svg`}
          alt=""
          class="size-5 shrink-0"
        />
        <span class="font-bold text-foreground">PinSpec</span>
      </span>
    </div>
  {/if}

  <nav class="flex min-w-0 items-center gap-1" aria-label="Resources">
    {#if !isWorkspace}
      {#if workspaceTarget}
        <a
          href={`#/mcu/${workspaceTarget}`}
          onclick={(e) => {
            e.preventDefault();
            openWorkspace();
          }}
          title="Workspace"
          aria-label="Workspace"
          class={entryClass('workspace')}
        >
          <CircuitBoard class={iconClass('workspace')} />
          <span class="hidden sm:inline">Workspace</span>
        </a>
      {:else}
        <button
          type="button"
          disabled
          title="Open a part first to enable the workspace"
          aria-label="Workspace"
          class={`${entryClass('workspace')} cursor-not-allowed opacity-40`}
        >
          <CircuitBoard class={iconClass('workspace')} />
          <span class="hidden sm:inline">Workspace</span>
        </button>
      {/if}
    {/if}
    <a
      href="#/about"
      onclick={(e) => {
        e.preventDefault();
        router.navigateAbout();
      }}
      aria-current={activeSection === 'about' ? 'page' : undefined}
      title="About"
      aria-label="About"
      class={entryClass('about')}
    >
      <Info class={iconClass('about')} />
      <span class="hidden sm:inline">About</span>
    </a>

    <a
      href="https://github.com/rambros3d/PinSpec"
      target="_blank"
      rel="noopener noreferrer"
      title="PinSpec repository on GitHub"
      aria-label="PinSpec repository on GitHub"
      class="btn btn-ghost btn-sm btn-square text-base-content/70"
    >
      <svg
        viewBox="0 0 16 16"
        class="size-4 shrink-0 fill-current text-accent"
        aria-hidden="true"
      >
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        ></path>
      </svg>
    </a>

    <button
      type="button"
      onclick={() => (topBarUI.shortcutHelpOpen = true)}
      title="Keyboard shortcuts (?)"
      aria-label="Keyboard shortcuts"
      aria-keyshortcuts="Shift+Slash"
      class="btn btn-ghost btn-sm btn-square text-base-content/70"
    >
      <Keyboard class="size-4 shrink-0 text-accent" />
    </button>

    <ThemePicker compact={true} />
  </nav>
</header>

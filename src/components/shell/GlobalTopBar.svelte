<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    Download,
    GitCompare,
    Keyboard,
    Redo2,
    Search,
    SearchCheck,
    Share2,
    Trash2,
    Undo2,
    X,
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { shouldShowScrollAffordance } from '../../core/scroll-affordance';
  import { router } from '../../state/router.svelte';
  import { topBarUI } from '../../state/top-bar-ui.svelte';
  import { workspaceStore } from '../../state/workspace.svelte';
  import ThemePicker from '../ThemePicker.svelte';

  interface SectionLink {
    id: 'home' | 'catalog' | 'projects';
    label: string;
    hash: string;
  }

  const SECTION_LINKS: readonly SectionLink[] = [
    { id: 'home', label: 'Home', hash: '#/' },
    { id: 'catalog', label: 'Catalog', hash: '#/catalog' },
    { id: 'projects', label: 'Projects', hash: '#/projects' },
  ];

  const isWorkspace = $derived(
    router.route.view === 'workspace' || router.route.view === 'shared',
  );
  const activeSection = $derived(
    router.route.view === 'workspace' || router.route.view === 'shared' ? null : router.route.view,
  );
  const routeTitle = $derived(
    isWorkspace
      ? (workspaceStore.chip?.id ?? 'Workspace')
      : router.route.view === 'landing'
        ? 'Home'
        : router.route.view === 'catalog'
          ? 'Catalog'
          : router.route.view === 'projects'
            ? 'Projects'
            : 'About',
  );

  let confirmClear = $state(false);
  let scrollRowEl = $state<HTMLDivElement | null>(null);
  let showScrollHint = $state(false);
  let searchInputRef = $state<HTMLInputElement | null>(null);

  function updateScrollHint(): void {
    if (!scrollRowEl) return;
    showScrollHint = shouldShowScrollAffordance(
      scrollRowEl.scrollLeft,
      scrollRowEl.clientWidth,
      scrollRowEl.scrollWidth,
    );
  }

  $effect(() => {
    updateScrollHint();
  });

  onMount(() => {
    /** Ctrl+F in a workspace focuses the bar's input and selects its query. */
    topBarUI.focusSearch = () => {
      searchInputRef?.focus();
      searchInputRef?.select();
    };
    return () => {
      topBarUI.focusSearch = null;
    };
  });

  function navigate(link: SectionLink): void {
    if (link.id === 'home') router.navigateHome();
    else if (link.id === 'catalog') router.navigateCatalog();
    else router.navigateProjects();
  }

  async function handleShare(): Promise<void> {
    const url = workspaceStore.buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      workspaceStore.showToast('Share link copied to clipboard.', 'success');
    } catch {
      topBarUI.exportOpen = true;
    }
  }
</script>

<header class="global-top-bar h-12 shrink-0 min-h-0 min-w-0 relative overflow-hidden border-b border-base-300 bg-base-100 select-none">
  <div
    bind:this={scrollRowEl}
    onscroll={updateScrollHint}
    class="flex h-full w-full min-w-0 items-center gap-3 px-3 overflow-x-auto overscroll-x-contain"
  >
    {#if !isWorkspace}
      <a href="#/" class="flex shrink-0 items-center gap-2 text-sm font-bold tracking-tight text-foreground">
        <svg class="size-5 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </svg>
        <span class="hidden sm:inline font-bold">PinCraft</span>
      </a>
    {/if}

    <span class="shrink-0 whitespace-nowrap font-mono text-xs font-semibold text-base-content/70">
      {routeTitle}
    </span>

    {#if !isWorkspace}
    <nav class="flex shrink-0 items-center gap-1" aria-label="Sections">
      {#each SECTION_LINKS as link (link.id)}
        <a
          href={link.hash}
          onclick={(e) => {
            e.preventDefault();
            navigate(link);
          }}
          aria-current={activeSection === link.id ? 'page' : undefined}
          class={`btn btn-ghost btn-sm whitespace-nowrap text-xs ${activeSection === link.id ? 'btn-active font-semibold text-info' : ''}`}
        >
          {link.label}
        </a>
      {/each}
    </nav>
    {/if}

    {#if isWorkspace}
      <div class="w-px h-5 shrink-0 bg-base-300"></div>

      {#if workspaceStore.chip}
        <button
          type="button"
          onclick={() => (topBarUI.switcherOpen = true)}
          class="btn btn-sm btn-outline gap-2 min-w-0 whitespace-nowrap"
          title="Switch MCU"
        >
          <span class="font-mono font-semibold text-xs text-foreground truncate max-w-[11rem]">
            {workspaceStore.chip.id}
          </span>
          <span class="hidden lg:inline font-mono-tabular text-[11px] text-base-content/60">
            {workspaceStore.chip.core} - {workspaceStore.chip.flashKb ?? '—'}KB/{workspaceStore.chip.ramKb}KB - {workspaceStore.chip.package.name} ({workspaceStore.chip.package.pinCount})
          </span>
          <ChevronDown class="size-3.5 text-base-content/40 shrink-0" />
        </button>
      {/if}

      <div class="min-w-[9rem] max-w-xs relative flex flex-1 shrink items-center">
        <Search class="size-3.5 text-base-content/40 absolute left-2.5 pointer-events-none" />
        <input
          bind:this={searchInputRef}
          value={workspaceStore.globalSearch}
          oninput={(e) => (workspaceStore.globalSearch = (e.currentTarget as HTMLInputElement).value)}
          type="text"
          placeholder="Find pin or signal (Ctrl+F)..."
          aria-label="Find pin or signal"
          class="input input-xs w-full pl-8 pr-14 font-mono"
        />
        {#if workspaceStore.globalSearch}
          <div class="absolute right-2 flex items-center gap-1">
            <span class="font-mono-tabular text-[10px] text-info">
              {workspaceStore.searchMatchingPins.length}
            </span>
            <button
              type="button"
              onclick={() => (workspaceStore.globalSearch = '')}
              class="btn btn-ghost btn-xs btn-square"
              title="Clear search"
              aria-label="Clear search"
            >
              <X class="size-3" />
            </button>
          </div>
        {/if}
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onclick={() => workspaceStore.undo()}
          disabled={!workspaceStore.canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          class="btn btn-ghost btn-sm btn-square"
        >
          <Undo2 class="size-4" />
        </button>
        <button
          type="button"
          onclick={() => workspaceStore.redo()}
          disabled={!workspaceStore.canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          class="btn btn-ghost btn-sm btn-square"
        >
          <Redo2 class="size-4" />
        </button>
        <button
          type="button"
          onclick={() => (confirmClear = !confirmClear)}
          title="Clear all assignments"
          aria-label="Clear all assignments"
          class="btn btn-ghost btn-sm btn-square hover:text-error"
        >
          <Trash2 class="size-4" />
        </button>
        <div class="mx-1 h-5 w-px bg-base-300"></div>

        <button
          type="button"
          onclick={() => (topBarUI.finderOpen = true)}
          title="Find pinout-compatible MCU alternatives"
          aria-label="Find MCU alternatives"
          class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
        >
          <SearchCheck class="size-3.5" />
          <span class="hidden lg:inline">Alternatives</span>
        </button>
        <button
          type="button"
          onclick={() => (topBarUI.diffOpen = true)}
          title="Compare two project pinouts"
          aria-label="Compare project pinouts"
          class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
        >
          <GitCompare class="size-3.5" />
          <span class="hidden lg:inline">Compare</span>
        </button>
        <button
          type="button"
          onclick={() => void handleShare()}
          class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
        >
          <Share2 class="size-3.5" />
          <span class="hidden md:inline">Share</span>
        </button>
        <button
          type="button"
          onclick={() => (topBarUI.exportOpen = true)}
          class="btn btn-sm btn-primary gap-1.5 text-xs font-semibold whitespace-nowrap"
        >
          <Download class="size-3.5" />
          <span>Export</span>
        </button>
      </div>
    {/if}

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <ThemePicker compact={true} />
      {#if !isWorkspace}
        <button
          type="button"
          onclick={() => (topBarUI.shortcutHelpOpen = true)}
          class="btn btn-ghost btn-sm btn-square shrink-0"
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard class="size-4" />
        </button>
      {/if}
    </div>
  </div>

  {#if confirmClear}
    <div class="card card-border fixed right-3 top-12 z-50 w-56 bg-base-100 shadow-xl p-3 text-xs">
      <p class="text-foreground font-medium">Clear all pin assignments?</p>
      <p class="mt-1 text-[11px] text-base-content/60">
        You can undo this action with Ctrl+Z.
      </p>
      <div class="mt-2.5 flex justify-end gap-1.5">
        <button type="button" onclick={() => (confirmClear = false)} class="btn btn-sm btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          onclick={() => {
            confirmClear = false;
            workspaceStore.clearAll();
          }}
          class="btn btn-sm btn-error font-medium"
        >
          Clear All
        </button>
      </div>
    </div>
  {/if}

  {#if showScrollHint}
    <ChevronRight
      class="size-4 text-base-content/60 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none"
      aria-hidden="true"
    />
  {/if}
</header>

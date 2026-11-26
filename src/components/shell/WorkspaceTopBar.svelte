<script lang="ts">
  import ChevronDown from '@solar-icons/svelte/bold-duotone/alt-arrow-down';
  import ChevronRight from '@solar-icons/svelte/bold-duotone/alt-arrow-right';
  import Download from '@solar-icons/svelte/bold-duotone/download';
  import GitCompare from '@solar-icons/svelte/bold-duotone/git-diff';
  import Pencil from '@solar-icons/svelte/bold-duotone/pen';
  import Redo2 from '@solar-icons/svelte/bold-duotone/undo-right';
  import SearchCheck from '@solar-icons/svelte/bold-duotone/magnifier-check';
  import Share2 from '@solar-icons/svelte/bold-duotone/share';
  import Trash2 from '@solar-icons/svelte/bold-duotone/trash-bin-trash';
  import Undo2 from '@solar-icons/svelte/bold-duotone/undo-left';
  import { tick } from 'svelte';
  import { shouldShowScrollAffordance } from '../../core/scroll-affordance';
  import { topBarUI } from '../../state/top-bar-ui.svelte';
  import { workspaceStore } from '../../state/workspace.svelte';

  let confirmClear = $state(false);
  let scrollRowEl = $state<HTMLDivElement | null>(null);
  let showScrollHint = $state(false);
  let editingName = $state(false);
  let nameDraft = $state('');
  let nameInputRef = $state<HTMLInputElement | null>(null);

  /** Transient edit mode only: no editing state enters persisted project data. */
  async function beginNameEdit(): Promise<void> {
    nameDraft = workspaceStore.state.projectName ?? '';
    editingName = true;
    await tick();
    nameInputRef?.focus();
    nameInputRef?.select();
  }

  function commitName(): void {
    if (!editingName) return;
    editingName = false;
    workspaceStore.renameProject(nameDraft);
  }

  function cancelNameEdit(): void {
    editingName = false;
    nameDraft = workspaceStore.state.projectName ?? '';
  }

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

<header
  class="global-top-bar h-12 shrink-0 min-h-0 min-w-0 relative overflow-hidden border-b border-base-300 bg-base-100 select-none"
  aria-label="Workspace actions"
>
  <div
    bind:this={scrollRowEl}
    onscroll={updateScrollHint}
    class="flex h-full w-full min-w-0 items-center gap-3 px-3 overflow-x-auto overscroll-x-contain"
  >
    <div class="flex shrink-0 items-center gap-1.5">
      <img
        src={`${import.meta.env.BASE_URL}radiokit-logo.svg`}
        alt=""
        class="size-5 shrink-0"
      />
      {#if editingName}
        <input
          bind:this={nameInputRef}
          bind:value={nameDraft}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitName();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelNameEdit();
            }
          }}
          onblur={commitName}
          type="text"
          maxlength="48"
          aria-label="Project name"
          class="input input-xs w-40 shrink-0 font-mono"
        />
      {:else}
        <button
          type="button"
          onclick={() => void beginNameEdit()}
          class="btn btn-ghost btn-xs shrink-0 gap-1 font-mono text-xs text-foreground"
          title="Rename project"
          aria-label="Rename project"
        >
          <span class="max-w-[16rem] truncate">
            {workspaceStore.state.projectName ?? 'Unnamed project'}
          </span>
          <Pencil class="size-3 shrink-0" />
        </button>
      {/if}
    </div>

    <div class="w-px h-5 shrink-0 bg-base-300"></div>

    {#if workspaceStore.chip}
      <button
        type="button"
        onclick={() => (topBarUI.switcherOpen = true)}
        class="btn btn-sm btn-outline gap-2 min-w-0 whitespace-nowrap"
        title="Switch MCU (Ctrl+K)"
        aria-keyshortcuts="Control+K Meta+K"
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

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <button
        type="button"
        onclick={() => workspaceStore.undo()}
        disabled={!workspaceStore.canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        aria-keyshortcuts="Control+Z Meta+Z"
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
        aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z"
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
        title="Find pinout-compatible MCUs"
        aria-label="Compatible MCUs"
        class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
      >
        <SearchCheck class="size-3.5" />
        <span class="hidden lg:inline">Compatible MCUs</span>
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
  </div>

  {#if confirmClear}
    <div class="card card-border fixed right-3 top-20 z-50 w-64 bg-base-100 shadow-xl p-3 text-xs">
      <p class="text-foreground font-medium">Reset the full pin plan?</p>
      <p class="mt-1 text-[11px] text-base-content/60">
        Assignments, labels, locks, modes, remaps, and PIO bindings are cleared. You can undo with Ctrl+Z.
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

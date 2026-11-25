<script lang="ts">
  import AlertCircle from '@solar-icons/svelte/bold-duotone/danger-circle';
  import Clock from '@solar-icons/svelte/bold-duotone/clock-circle';
  import FileUp from '@solar-icons/svelte/bold-duotone/import';
  import FolderOpen from '@solar-icons/svelte/bold-duotone/folder-open';
  import Pencil from '@solar-icons/svelte/bold-duotone/pen';
  import Trash2 from '@solar-icons/svelte/bold-duotone/trash-bin-trash';
  import { tick } from 'svelte';
  import PackageThumbnail from '../components/catalog/PackageThumbnail.svelte';
  import { exportPinoutJson, parsePinoutJson } from '../core/exporters/json';
  import { thumbnailGeometryFromSaved } from '../core/package-thumbnail';
  import { router } from '../state/router.svelte';
  import { workspaceStore } from '../state/workspace.svelte';

  let importError = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let editingMcuId = $state<string | null>(null);
  let nameDraft = $state('');
  let nameInputRef = $state<HTMLInputElement | null>(null);

  const sessions = $derived(workspaceStore.recentSessions.slice(0, 10));

  /** Inline name editing is component-local; only the committed name is stored. */
  async function beginRename(mcuId: string, currentName?: string): Promise<void> {
    editingMcuId = mcuId;
    nameDraft = currentName ?? '';
    await tick();
    nameInputRef?.focus();
    nameInputRef?.select();
  }

  function commitRename(): void {
    if (!editingMcuId) return;
    const mcuId = editingMcuId;
    editingMcuId = null;
    workspaceStore.renameProject(nameDraft, mcuId);
  }

  function cancelRename(): void {
    editingMcuId = null;
    nameDraft = '';
  }

  function openSession(mcuId: string): void {
    void workspaceStore.openMcu(mcuId);
    router.navigateMcu(mcuId);
  }

  function deleteSession(mcuId: string): void {
    workspaceStore.deleteRecentSession(mcuId);
  }

  function exportSession(mcuId: string): void {
    const session = workspaceStore.recentSessions.find((item) => item.mcuId === mcuId);
    if (!session) return;
    const blob = new Blob([exportPinoutJson(session.state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${mcuId}-pinout.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: Event): Promise<void> {
    importError = null;
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    const text = await file.text();
    const parsed = parsePinoutJson(text);
    if (!parsed.ok) {
      importError = parsed.error;
      return;
    }
    workspaceStore.setPendingHandoff(parsed.state);
    router.navigateMcu(parsed.state.mcuId);
  }

  function formatRelativeTime(ts: number): string {
    const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }
</script>

<div class="shell-route flex flex-col bg-base-200 text-foreground">
  <main class="max-w-7xl w-full mx-auto px-6 py-8 space-y-4 flex-1">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-base-content/60">Recent pinouts stored in this browser.</p>
      <div class="flex items-center gap-2">
        <button type="button" onclick={() => fileInput?.click()} class="btn btn-sm btn-outline gap-2">
          <FileUp class="size-3.5" />
          Import project
        </button>
        <a href="#/catalog" class="btn btn-sm btn-primary">New project</a>
      </div>
      <input
        bind:this={fileInput}
        type="file"
        accept=".json,application/json"
        class="hidden"
        aria-label="Import pinout JSON project file"
        onchange={handleImport}
      />
    </div>

    {#if importError}
      <p role="alert" class="alert alert-error text-xs flex items-start gap-2">
        <AlertCircle class="size-4 shrink-0" />
        <span>{importError}</span>
      </p>
    {/if}

    {#if sessions.length === 0}
      <section class="card card-border bg-base-100 p-10 text-center space-y-3">
        <FolderOpen class="size-6 mx-auto text-base-content/40" />
        <p class="text-sm text-foreground">No recent projects</p>
        <p class="text-xs text-base-content/60">
          Opening a part creates a recent session in this browser.
        </p>
        <a href="#/catalog" class="btn btn-sm btn-primary">Browse the catalog</a>
      </section>
    {:else}
      <!-- Cards derive outlines from stored session fields; no shard fetch here. -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each sessions as session (session.mcuId)}
          <article class="card card-border bg-base-100 p-4 flex flex-col gap-3">
            <div class="flex items-start gap-3">
              <PackageThumbnail
                geometry={thumbnailGeometryFromSaved(session.packageName, session.pinCount)}
                size={44}
              />
              <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-foreground truncate">{session.mcuId}</p>
                {#if editingMcuId === session.mcuId}
                  <input
                    bind:this={nameInputRef}
                    bind:value={nameDraft}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        cancelRename();
                      }
                    }}
                    onblur={commitRename}
                    type="text"
                    maxlength="48"
                    placeholder="Project name"
                    aria-label={`Rename ${session.mcuId}`}
                    class="input input-xs w-full font-mono"
                  />
                {:else}
                  {#if session.state.projectName}
                    <p class="truncate text-xs text-base-content/70">{session.state.projectName}</p>
                  {/if}
                  <button
                    type="button"
                    onclick={() => void beginRename(session.mcuId, session.state.projectName)}
                    class="btn btn-ghost btn-xs gap-1 font-mono text-[11px] text-base-content/60"
                    aria-label={`Rename ${session.mcuId}`}
                    title="Rename project"
                  >
                    <Pencil class="size-3 shrink-0" />
                    Rename
                  </button>
                {/if}
                <p class="font-mono text-[11px] text-base-content/60 truncate">{session.packageName}</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-tabular text-[11px] text-base-content/60">
              <span>{session.assignedCount}/{session.pinCount} pins assigned</span>
              <span class="inline-flex items-center gap-1">
                <Clock class="size-3" />
                {formatRelativeTime(session.updatedAt)}
              </span>
            </div>
            <div class="mt-auto flex items-center gap-1.5">
              <button type="button" onclick={() => openSession(session.mcuId)} class="btn btn-xs btn-outline">Open</button>
              <button type="button" onclick={() => exportSession(session.mcuId)} class="btn btn-xs btn-ghost">Export</button>
              <button
                type="button"
                onclick={() => deleteSession(session.mcuId)}
                class="btn btn-xs btn-ghost btn-square text-base-content/40 hover:text-error"
                aria-label={`Delete ${session.mcuId}`}
                title="Delete session"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </article>
        {/each}
      </section>
    {/if}
  </main>
</div>

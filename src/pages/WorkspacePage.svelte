<script lang="ts">
  import { AlertCircle, PanelLeft, PanelRight, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import ExportModal from '../components/workspace/ExportModal.svelte';
  import McuSwitcherModal from '../components/workspace/McuSwitcherModal.svelte';
  import PackageCanvas from '../components/workspace/PackageCanvas.svelte';
  import PeripheralTree from '../components/workspace/PeripheralTree.svelte';
  import SummaryDrawer from '../components/workspace/SummaryDrawer.svelte';
  import TopToolbar from '../components/workspace/TopToolbar.svelte';
  import type { WorkspaceState } from '../core/types';
  import { catalogStore } from '../state/catalog.svelte';
  import { router } from '../state/router.svelte';
  import { workspaceStore } from '../state/workspace.svelte';

  interface Props {
    mcuId?: string;
    sharedPayload?: string;
  }

  let { mcuId, sharedPayload }: Props = $props();

  let leftWidth = $state(280);
  let rightWidth = $state(330);
  let leftCollapsed = $state(false);
  let rightCollapsed = $state(false);
  let showSwitcher = $state(false);
  let showExport = $state(false);

  let canvasRef = $state<{ fitView: () => void } | null>(null);
  let searchInputRef = $state<HTMLInputElement | null>(null);

  // Hydrate MCU or shared payload when props change
  let lastLoadedKey = '';
  $effect(() => {
    const key = sharedPayload ? `s:${sharedPayload}` : `m:${mcuId ?? ''}`;
    if (!key || key === lastLoadedKey) return;
    lastLoadedKey = key;

    catalogStore.ensureLoaded();
    if (sharedPayload) {
      workspaceStore.openSharedPayload(sharedPayload);
    } else if (mcuId) {
      workspaceStore.openMcu(mcuId);
    }
  });

  // Combine search highlights and remap/alternate highlights
  const activeHighlights = $derived.by(() => {
    const set = new Set<string>(workspaceStore.highlightedPins);
    for (const pos of workspaceStore.searchMatchingPins) {
      set.add(pos);
    }
    return Array.from(set);
  });

  function startResize(side: 'left' | 'right', e: PointerEvent): void {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = side === 'left' ? leftWidth : rightWidth;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (side === 'left') {
        leftWidth = Math.max(220, Math.min(420, startWidth + dx));
      } else {
        rightWidth = Math.max(260, Math.min(480, startWidth - dx));
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function handleShare(): Promise<void> {
    const url = workspaceStore.buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      workspaceStore.showToast('Share link copied to clipboard.', 'success');
    } catch {
      showExport = true;
    }
  }

  function handleImportState(imported: WorkspaceState): void {
    workspaceStore.setPendingHandoff(imported);
    if (workspaceStore.chip && imported.mcuId.toUpperCase() === workspaceStore.chip.id.toUpperCase()) {
      workspaceStore.openMcu(imported.mcuId, imported);
    } else {
      router.navigateMcu(imported.mcuId);
    }
    workspaceStore.showToast(`Imported pinout for ${imported.mcuId}.`, 'success');
  }

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef?.focus();
        searchInputRef?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        showSwitcher = true;
      } else if ((e.ctrlKey || e.metaKey) && !inInput && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          workspaceStore.redo();
        } else {
          workspaceStore.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && !inInput && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        workspaceStore.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<div class="h-screen w-screen flex flex-col overflow-hidden bg-[#f8fafc] dark:bg-[#0b0e14] text-slate-900 dark:text-slate-100">
  <TopToolbar
    chip={workspaceStore.chip}
    globalSearch={workspaceStore.globalSearch}
    searchMatchCount={workspaceStore.searchMatchingPins.length}
    canUndo={workspaceStore.canUndo}
    canRedo={workspaceStore.canRedo}
    rotation={workspaceStore.rotation}
    bind:searchInputRef
    onHome={() => router.navigateHome()}
    onOpenSwitcher={() => (showSwitcher = true)}
    onSearchChange={(val) => (workspaceStore.globalSearch = val)}
    onUndo={() => workspaceStore.undo()}
    onRedo={() => workspaceStore.redo()}
    onClearAll={() => workspaceStore.clearAll()}
    onFitView={() => canvasRef?.fitView()}
    onRotate={() => workspaceStore.rotateClockwise()}
    onShare={handleShare}
    onOpenExport={() => (showExport = true)}
  />

  <!-- Dismissible Error Banner (e.g. malformed #/s/... link) -->
  {#if workspaceStore.bannerError}
    <div class="flex items-center justify-between gap-3 px-4 py-2 bg-red-500/15 border-b border-red-500/35 text-xs text-red-700 dark:text-red-300 shrink-0">
      <div class="flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0" />
        <span>{workspaceStore.bannerError}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => router.navigateHome()}
          class="underline font-medium hover:text-red-500"
        >
          Browse Catalog
        </button>
        <button
          type="button"
          onclick={() => workspaceStore.dismissBanner()}
          class="p-0.5 rounded hover:bg-red-500/20"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  {/if}

  <!-- Three-Pane Workspace Body -->
  {#if workspaceStore.loading}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-2">
        <div class="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-mono text-slate-500 dark:text-slate-400">
          Loading {mcuId ?? 'shared pinout'}...
        </p>
      </div>
    </div>
  {:else if workspaceStore.loadError || !workspaceStore.chip || !workspaceStore.report}
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="max-w-md w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121722] p-6 text-center space-y-3">
        <AlertCircle class="w-8 h-8 text-red-500 mx-auto" />
        <h2 class="text-base font-semibold">Unable to Open MCU</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {workspaceStore.loadError ?? 'The requested STM32 part could not be loaded.'}
        </p>
        <div class="flex justify-center gap-2 pt-2">
          <button
            type="button"
            onclick={() => router.navigateHome()}
            class="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Back to Home
          </button>
          <button
            type="button"
            onclick={() => (showSwitcher = true)}
            class="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold"
          >
            Choose Another MCU
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="flex-1 flex min-h-0 relative overflow-hidden">
      <!-- Left Pane: Peripheral Tree -->
      {#if !leftCollapsed}
        <div class="shrink-0 h-full hidden md:block" style={`width: ${leftWidth}px;`}>
          <PeripheralTree
            chip={workspaceStore.chip}
            assignments={workspaceStore.state.assignments}
            peripheralModes={workspaceStore.state.peripheralModes}
            peripheralStatus={workspaceStore.report.peripheralStatus}
            onModeChange={(p, m) => workspaceStore.setPeripheralMode(p, m)}
            onToggleSignal={(p, s) => workspaceStore.toggleSignal(p, s)}
            onFocusPin={(pos) => workspaceStore.focusPin(pos)}
          />
        </div>
        <!-- Left Drag Resizer -->
        <div
          class="hidden md:block w-1 cursor-col-resize hover:bg-sky-500/60 transition-colors shrink-0"
          onpointerdown={(e) => startResize('left', e)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize peripherals pane"
        ></div>
      {/if}

      <!-- Center Pane: Interactive Package Canvas -->
      <div class="flex-1 min-w-0 h-full relative flex flex-col">
        <!-- Drawer Collapse Toggles -->
        <button
          type="button"
          onclick={() => (leftCollapsed = !leftCollapsed)}
          title={leftCollapsed ? 'Show Peripherals' : 'Hide Peripherals'}
          class="hidden md:flex absolute top-3 left-3 z-20 p-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#121722]/95 text-slate-600 dark:text-slate-300 hover:border-sky-500/60 shadow-xs"
        >
          <PanelLeft class="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onclick={() => (rightCollapsed = !rightCollapsed)}
          title={rightCollapsed ? 'Show Summary Drawer' : 'Hide Summary Drawer'}
          class="hidden lg:flex absolute top-14 right-3 z-20 p-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#121722]/95 text-slate-600 dark:text-slate-300 hover:border-sky-500/60 shadow-xs"
        >
          <PanelRight class="w-3.5 h-3.5" />
        </button>

        <PackageCanvas
          bind:this={canvasRef}
          chip={workspaceStore.chip}
          assignments={workspaceStore.state.assignments}
          labels={workspaceStore.state.labels}
          locked={workspaceStore.state.locked}
          pinStatus={workspaceStore.report.pinStatus}
          rotation={workspaceStore.rotation}
          highlightedPins={activeHighlights}
          remapSourcePos={workspaceStore.remapSourcePos}
          focusPinRequest={workspaceStore.focusPinRequest}
          onAssign={(pos, a) => workspaceStore.assignPin(pos, a)}
          onClear={(pos) => workspaceStore.clearPin(pos)}
          onSetLabel={(pos, lbl) => workspaceStore.setLabel(pos, lbl)}
          onToggleLock={(pos) => workspaceStore.toggleLock(pos)}
          onHighlightAlternates={(pos) => workspaceStore.highlightAlternates(pos)}
          onEnterRemap={(pos) => workspaceStore.enterRemapMode(pos)}
          onCompleteRemap={(targetPos) => workspaceStore.completeRemap(targetPos)}
          onCancelRemap={() => workspaceStore.cancelRemapMode()}
          onRotate={() => workspaceStore.rotateClockwise()}
        />
      </div>

      <!-- Right Pane: Summary Drawer -->
      {#if !rightCollapsed}
        <!-- Right Drag Resizer -->
        <div
          class="hidden lg:block w-1 cursor-col-resize hover:bg-sky-500/60 transition-colors shrink-0"
          onpointerdown={(e) => startResize('right', e)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize summary pane"
        ></div>
        <div class="shrink-0 h-full hidden lg:block" style={`width: ${rightWidth}px;`}>
          <SummaryDrawer
            chip={workspaceStore.chip}
            assignments={workspaceStore.state.assignments}
            labels={workspaceStore.state.labels}
            locked={workspaceStore.state.locked}
            report={workspaceStore.report}
            onFocusPin={(pos) => workspaceStore.focusPin(pos)}
            onSetLabel={(pos, lbl) => workspaceStore.setLabel(pos, lbl)}
            onToggleLock={(pos) => workspaceStore.toggleLock(pos)}
            onClearPin={(pos) => workspaceStore.clearPin(pos)}
            onApplyFix={(fix) => workspaceStore.applyFix(fix)}
          />
        </div>
      {/if}
    </div>
  {/if}

  <!-- Toast Notification -->
  {#if workspaceStore.toast}
    <div
      class={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg border text-xs font-medium shadow-lg ${
        workspaceStore.toast.tone === 'success'
          ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
          : workspaceStore.toast.tone === 'warning'
            ? 'bg-amber-950/95 border-amber-500/50 text-amber-100'
            : 'bg-slate-900/95 border-slate-700 text-slate-100'
      }`}
    >
      {workspaceStore.toast.text}
    </div>
  {/if}

  <!-- Modals -->
  {#if showSwitcher}
    <McuSwitcherModal
      activeMcuId={workspaceStore.chip?.id ?? ''}
      onSelect={(id) => router.navigateMcu(id)}
      onClose={() => (showSwitcher = false)}
    />
  {/if}

  {#if showExport && workspaceStore.chip}
    <ExportModal
      chip={workspaceStore.chip}
      state={workspaceStore.state}
      shareUrl={workspaceStore.buildShareUrl()}
      onImportState={handleImportState}
      onClose={() => (showExport = false)}
    />
  {/if}
</div>

<script lang="ts">
  import { AlertCircle, CircuitBoard, FileUp, PanelLeft, PanelRight, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import BoardSelectorModal from '../components/workspace/BoardSelectorModal.svelte';
  import CompatibleMcuFinder from '../components/workspace/CompatibleMcuFinder.svelte';
  import ExportModal from '../components/workspace/ExportModal.svelte';
  import McuSwitcherModal from '../components/workspace/McuSwitcherModal.svelte';
  import PackageCanvas from '../components/workspace/PackageCanvas.svelte';
  import PeripheralTree from '../components/workspace/PeripheralTree.svelte';
  import PinoutDiffModal from '../components/workspace/PinoutDiffModal.svelte';
  import ShortcutHelpDialog from '../components/workspace/ShortcutHelpDialog.svelte';
  import SummaryDrawer from '../components/workspace/SummaryDrawer.svelte';
  import TopToolbar from '../components/workspace/TopToolbar.svelte';
  import {
    buildWorkspaceFromPins,
    prepareIocImport,
    type IocRawRecord,
  } from '../core/importers/ioc';
  import { DOCK_TABS, type DockTab, type WorkspaceState } from '../core/types';
  import {
    BOARD_PRESETS,
    buildBoardPresetState,
    resolveBoardPreset,
    type BoardPreset,
  } from '../data/boards';
  import { catalogStore } from '../state/catalog.svelte';
  import { openDialogWithFocus } from '../state/dialog-focus';
  import { router } from '../state/router.svelte';
  import { workspaceStore } from '../state/workspace.svelte';

  interface Props {
    mcuId?: string;
    sharedPayload?: string;
  }

  let { mcuId, sharedPayload }: Props = $props();

  type SummaryTab = 'pins' | 'diagnostics' | 'dma' | 'pio' | 'gpio' | 'audit';
  const DOCK_TAB_LABELS: Record<DockTab, string> = {
    peripherals: 'Peripherals',
    pins: 'Pins',
    diagnostics: 'Diagnostics',
    dma: 'DMA',
    pio: 'PIO',
    audit: 'Audit',
  };

  let leftWidth = $state(280);
  let rightWidth = $state(330);
  let leftCollapsed = $state(false);
  let rightCollapsed = $state(false);
  let showSwitcher = $state(false);
  let showFinder = $state(false);
  let showDiff = $state(false);
  let showExport = $state(false);
  let showBoardSelector = $state(false);
  let showShortcutHelp = $state(false);
  let iocDropActive = $state(false);
  let iocFileInput = $state<HTMLInputElement | null>(null);
  let ambiguousImport = $state<{ record: IocRawRecord; candidates: string[] } | null>(null);
  let ambiguousChoice = $state<string | null>(null);
  let ambiguousDialogEl = $state<HTMLDialogElement | null>(null);
  let ambiguousCancelEl = $state<HTMLButtonElement | null>(null);

  let canvasRef = $state<{ fitView: () => void } | null>(null);
  let searchInputRef = $state<HTMLInputElement | null>(null);
  let summaryTab = $state<SummaryTab>('pins');

  /** Select a portrait dock tab; non-tree tabs drive the shared summary pane. */
  function selectDockTab(tab: DockTab): void {
    workspaceStore.setDockTab(tab);
    if (tab !== 'peripherals') summaryTab = tab;
  }

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

  // The ambiguous-import dialog is conditional, so promote it when it mounts.
  $effect(() => {
    if (ambiguousImport && ambiguousDialogEl && !ambiguousDialogEl.open) {
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ambiguousDialogEl.showModal();
      openDialogWithFocus(ambiguousDialogEl, ambiguousCancelEl, opener);
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

  /** Hand a prepared state to the existing MCU-open handoff path. */
  function applyImportedState(
    state: WorkspaceState,
    message: string,
    tone: 'info' | 'success' | 'warning' = 'success',
  ): void {
    workspaceStore.setPendingHandoff(state);
    if (workspaceStore.chip && state.mcuId.toUpperCase() === workspaceStore.chip.id.toUpperCase()) {
      workspaceStore.openMcu(state.mcuId, state);
    } else {
      router.navigateMcu(state.mcuId);
    }
    workspaceStore.showToast(message, tone);
  }

  async function applyIocRecord(record: IocRawRecord, mcuId: string): Promise<void> {
    try {
      const chip = await catalogStore.loadChip(mcuId);
      const built = buildWorkspaceFromPins(record.pins, { chip, mcuId: chip.id });
      if (!built.ok) {
        workspaceStore.showToast(built.error, 'warning');
        return;
      }
      const label = record.board || mcuId;
      const message =
        built.warnings.length > 0
          ? `Imported ${label} with ${built.warnings.length} warning(s): ${built.warnings[0]}`
          : `Imported ${label} pinout.`;
      applyImportedState(
        built.state,
        message,
        built.warnings.length > 0 ? 'warning' : 'success',
      );
    } catch (err) {
      workspaceStore.showToast(
        err instanceof Error ? err.message : 'Unable to load the imported MCU.',
        'warning',
      );
    }
  }

  async function handleIocFile(file: File): Promise<void> {
    if (catalogStore.index.length === 0) await catalogStore.ensureLoaded();
    if (catalogStore.indexError) {
      workspaceStore.showToast(catalogStore.indexError, 'warning');
      return;
    }
    const text = await file.text();
    const prepared = prepareIocImport(text, catalogStore.index);
    if (prepared.kind === 'error') {
      workspaceStore.showToast(prepared.error, 'warning');
      return;
    }
    if (prepared.kind === 'ambiguous') {
      ambiguousImport = { record: prepared.record, candidates: prepared.candidates };
      return;
    }
    await applyIocRecord(prepared.record, prepared.mcuId);
  }

  /** Close the native dialog; the close event applies a choice or cancels it. */
  function closeAmbiguousDialog(): void {
    ambiguousDialogEl?.close();
  }

  function handleAmbiguousClose(): void {
    const record = ambiguousImport?.record;
    const mcuId = ambiguousChoice;
    ambiguousChoice = null;
    ambiguousImport = null;
    if (record && mcuId) void applyIocRecord(record, mcuId);
  }

  function handleAmbiguousSelect(mcuId: string): void {
    ambiguousChoice = mcuId;
    closeAmbiguousDialog();
  }

  async function handleBoardSelect(preset: BoardPreset): Promise<void> {
    await catalogStore.ensureLoaded();
    const resolved = resolveBoardPreset(preset, catalogStore.index);
    if (!resolved.ok) {
      workspaceStore.showToast(resolved.error, 'warning');
      return;
    }
    showBoardSelector = false;
    try {
      const chip = await catalogStore.loadChip(resolved.mcuId);
      const built = buildBoardPresetState(preset, chip);
      if (!built.ok) {
        workspaceStore.showToast(built.error, 'warning');
        return;
      }
      applyImportedState(built.state, `Loaded ${preset.board} board preset.`);
    } catch (err) {
      workspaceStore.showToast(
        err instanceof Error ? err.message : 'Unable to load the selected board MCU.',
        'warning',
      );
    }
  }

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
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
      } else if (e.key === '?' && !inInput) {
        e.preventDefault();
        showShortcutHelp = true;
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      iocDropActive = true;
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) iocDropActive = false;
    };
    const onDrop = (e: DragEvent) => {
      iocDropActive = false;
      const iocFile = Array.from(e.dataTransfer?.files ?? []).find((file) =>
        file.name.toLowerCase().endsWith('.ioc'),
      );
      if (!iocFile) return;
      e.preventDefault();
      void handleIocFile(iocFile);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  });
</script>

<div
  class="workspace-root h-[100dvh] w-full overflow-hidden overscroll-none bg-base-200 text-foreground"
  data-dock-tab={workspaceStore.dockTab}
  style={`--left-pane-width: ${leftWidth}px; --right-pane-width: ${rightWidth}px;`}
>
  <div class="workspace-toolbar min-w-0 min-h-0">
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
      onRotate={() => workspaceStore.toggleRotation()}
      onShare={handleShare}
      onOpenExport={() => (showExport = true)}
      onOpenFinder={() => (showFinder = true)}
      onOpenDiff={() => (showDiff = true)}
    />
  </div>

  <!-- Dismissible Error Banner (e.g. malformed #/s/... link) -->
  {#if workspaceStore.bannerError}
    <div role="alert" class="workspace-banner alert alert-error flex items-center justify-between gap-3 px-4 py-2 border-b text-xs shrink-0">
      <div class="flex items-center gap-2">
        <AlertCircle class="size-4 shrink-0" />
        <span>{workspaceStore.bannerError}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => router.navigateHome()}
          class="btn btn-link btn-sm font-medium"
        >
          Browse Catalog
        </button>
        <button
          type="button"
          onclick={() => workspaceStore.dismissBanner()}
          class="btn btn-ghost btn-xs btn-square"
        >
          <X class="size-3.5" />
        </button>
      </div>
    </div>
  {/if}

  <!-- Three-Pane Workspace Body -->
  {#if workspaceStore.loading}
    <div class="workspace-canvas flex items-center justify-center">
      <div class="text-center space-y-2">
        <div class="w-8 h-8 border-2 border-info border-t-transparent rounded-selector animate-spin mx-auto"></div>
        <p class="text-xs font-mono text-base-content/60">
          Loading {mcuId ?? 'shared pinout'}...
        </p>
      </div>
    </div>
  {:else if workspaceStore.loadError || !workspaceStore.chip || !workspaceStore.report}
    <div class="workspace-canvas flex items-center justify-center p-6">
      <div class="card card-border max-w-md w-full bg-base-100 p-6 text-center space-y-3">
        <AlertCircle class="w-8 h-8 text-error mx-auto" />
        <h2 class="text-base font-semibold">Unable to Open MCU</h2>
        <p class="text-xs text-base-content/60">
          {workspaceStore.loadError ?? 'The requested part could not be loaded.'}
        </p>
        <div class="flex justify-center gap-2 pt-2">
          <button
            type="button"
            onclick={() => router.navigateHome()}
            class="btn btn-sm btn-outline text-xs font-medium"
          >
            Back to Home
          </button>
          <button
            type="button"
            onclick={() => (showSwitcher = true)}
            class="btn btn-sm btn-primary text-xs font-semibold"
          >
            Choose Another MCU
          </button>
        </div>
      </div>
    </div>
  {:else}
      <!-- Left Pane: Peripheral Tree -->
      {#if !leftCollapsed}
        <div class="workspace-peripherals h-full">
          <PeripheralTree
            chip={workspaceStore.chip}
            assignments={workspaceStore.state.assignments}
            peripheralModes={workspaceStore.state.peripheralModes}
            peripheralStatus={workspaceStore.report.peripheralStatus}
            activeRemaps={workspaceStore.state.activeRemaps ?? {}}
            onModeChange={(p, m) => workspaceStore.setPeripheralMode(p, m)}
            onRemapChange={(p, id) => workspaceStore.setActiveRemap(p, id)}
            onToggleSignal={(p, s) => workspaceStore.toggleSignal(p, s)}
            onFocusPin={(pos) => workspaceStore.focusPin(pos)}
          />
        </div>
        <!-- Left Drag Resizer (landscape only) -->
        <div
          class="workspace-resizer-left w-1 cursor-col-resize hover:bg-primary/60 transition-colors"
          onpointerdown={(e) => startResize('left', e)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize peripherals pane"
        ></div>
      {/if}

      <!-- Center Pane: Interactive Package Canvas -->
      <div class="workspace-canvas h-full">
        <!-- Drawer Collapse Toggles -->
        <button
          type="button"
          onclick={() => (leftCollapsed = !leftCollapsed)}
          title={leftCollapsed ? 'Show Peripherals' : 'Hide Peripherals'}
          class="btn btn-ghost btn-sm btn-square workspace-landscape-only hidden md:flex absolute top-3 left-3 z-20 shadow-xs"
        >
          <PanelLeft class="size-3.5" />
        </button>

        <button
          type="button"
          onclick={() => (rightCollapsed = !rightCollapsed)}
          title={rightCollapsed ? 'Show Summary Drawer' : 'Hide Summary Drawer'}
          class="btn btn-ghost btn-sm btn-square workspace-landscape-only hidden lg:flex absolute top-14 right-3 z-20 shadow-xs"
        >
          <PanelRight class="size-3.5" />
        </button>

        <div class="absolute top-3 left-12 z-20 flex items-center gap-1">
          <button
            type="button"
            onclick={() => iocFileInput?.click()}
            title="Import an STM32CubeIDE .ioc project file"
            aria-label="Import .ioc project file"
            class="btn btn-ghost btn-sm gap-1.5 shadow-xs"
          >
            <FileUp class="size-3.5" />
            <span class="hidden xl:inline text-[11px] font-medium">Import .ioc</span>
          </button>
          <button
            type="button"
            onclick={() => (showBoardSelector = true)}
            title="Start from an official ST board preset"
            aria-label="Open board preset selector"
            class="btn btn-ghost btn-sm gap-1.5 shadow-xs"
          >
            <CircuitBoard class="size-3.5" />
            <span class="hidden xl:inline text-[11px] font-medium">Board preset</span>
          </button>
        </div>
        <input
          bind:this={iocFileInput}
          type="file"
          accept=".ioc"
          class="hidden"
          onchange={(e) => {
            const file = (e.currentTarget as HTMLInputElement).files?.[0];
            if (file) void handleIocFile(file);
            (e.currentTarget as HTMLInputElement).value = '';
          }}
        />

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
          onRotate={() => workspaceStore.toggleRotation()}
        />
      </div>

      <!-- Right Pane: Summary Drawer -->
      {#if !rightCollapsed}
        <!-- Right Drag Resizer (landscape only) -->
        <div
          class="workspace-resizer-right w-1 cursor-col-resize hover:bg-primary/60 transition-colors"
          onpointerdown={(e) => startResize('right', e)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize summary pane"
        ></div>
        <div class="workspace-summary h-full">
          <SummaryDrawer
            chip={workspaceStore.chip}
            assignments={workspaceStore.state.assignments}
            labels={workspaceStore.state.labels}
            locked={workspaceStore.state.locked}
            pioAssignments={workspaceStore.state.pioAssignments ?? {}}
            report={workspaceStore.report}
            bind:activeTab={summaryTab}
            onFocusPin={(pos) => workspaceStore.focusPin(pos)}
            onSetLabel={(pos, lbl) => workspaceStore.setLabel(pos, lbl)}
            onToggleLock={(pos) => workspaceStore.toggleLock(pos)}
            onClearPin={(pos) => workspaceStore.clearPin(pos)}
            onApplyFix={(fix) => workspaceStore.applyFix(fix)}
            onSetPioAssignment={(pos, binding) => workspaceStore.setPioAssignment(pos, binding)}
          />
        </div>
      {/if}

      <!-- Portrait dock tab strip; the panes above occupy the dock area. -->
      <div
        role="tablist"
        class="dock workspace-dock-tabs shrink-0 items-center gap-1 border-b border-base-300 bg-base-200 px-2 py-1 text-xs"
        aria-label="Workspace panels"
      >
        {#each DOCK_TABS as tab (tab)}
          <button
            type="button"
            role="tab"
            onclick={() => selectDockTab(tab)}
            aria-selected={workspaceStore.dockTab === tab}
            class={`btn btn-sm min-h-11 whitespace-nowrap shrink-0 ${
              workspaceStore.dockTab === tab ? 'dock-active btn-primary' : 'btn-ghost'
            }`}
          >
            {DOCK_TAB_LABELS[tab]}
          </button>
        {/each}
      </div>
  {/if}

  <!-- Toast Notification -->
  {#if workspaceStore.toast}
    <div
      role="status"
      class={`workspace-toast alert fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 text-xs font-medium shadow-lg ${
        workspaceStore.toast.tone === 'success'
          ? 'alert-success'
          : workspaceStore.toast.tone === 'warning'
            ? 'alert-warning'
            : 'alert-info'
      }`}
    >
      <span>{workspaceStore.toast.text}</span>
      <button
        type="button"
        onclick={() => workspaceStore.dismissToast()}
        aria-label="Dismiss notification"
        class="btn btn-ghost btn-xs btn-square"
      >
        <X class="size-3" />
      </button>
    </div>
  {/if}

  {#if iocDropActive}
    <div class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-neutral/50">
      <div class="card card-border border-dashed border-info bg-base-100 px-8 py-6 text-center shadow-lg">
        <FileUp class="w-8 h-8 mx-auto text-info" />
        <p class="mt-2 text-sm font-semibold text-foreground">Drop an .ioc file to import</p>
        <p class="text-xs text-base-content/60 mt-1">Pins are matched by name against the loaded catalog.</p>
      </div>
    </div>
  {/if}

  <!-- Ambiguous part ID confirmation -->
  {#if ambiguousImport}
    <dialog
      bind:this={ambiguousDialogEl}
      class="modal"
      onclose={handleAmbiguousClose}
      oncancel={(e) => {
        e.preventDefault();
        closeAmbiguousDialog();
      }}
      onclick={(e) => {
        if (e.target === ambiguousDialogEl) closeAmbiguousDialog();
      }}
      aria-label="Confirm MCU for .ioc import"
    >
      <div
        class="modal-box w-full max-w-md max-h-[92dvh] min-h-0 flex flex-col p-0 shadow-2xl overflow-hidden"
      >
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-base-300">
          <h2 class="text-sm font-semibold text-foreground">Confirm MCU for Import</h2>
          <button
            bind:this={ambiguousCancelEl}
            type="button"
            onclick={closeAmbiguousDialog}
            class="btn btn-ghost btn-sm btn-square"
            aria-label="Cancel import"
            title="Cancel import"
          >
            <X class="size-4" />
          </button>
        </div>
        <div class="px-5 py-4 space-y-3 min-h-0 overflow-y-auto">
          <p class="text-xs text-base-content/60">
            The part ID in this file matches more than one catalog MCU. Select the part used by your board.
          </p>
          <p class="font-mono text-xs text-foreground break-all">{ambiguousImport.record.mcuName}</p>
          <div class="flex flex-wrap gap-2">
            {#each ambiguousImport.candidates as candidate (candidate)}
              <button
                type="button"
                onclick={() => handleAmbiguousSelect(candidate)}
                class="btn btn-sm btn-outline font-mono text-xs"
              >
                {candidate}
              </button>
            {/each}
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button aria-label="Cancel import">close</button>
      </form>
    </dialog>
  {/if}

  <!-- Modals -->
  {#if showDiff}
    <PinoutDiffModal onClose={() => (showDiff = false)} />
  {/if}

  {#if showFinder}
    <CompatibleMcuFinder
      chip={workspaceStore.chip}
      workspaceState={workspaceStore.state}
      onClose={() => (showFinder = false)}
    />
  {/if}

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

  {#if showBoardSelector}
    <BoardSelectorModal
      presets={BOARD_PRESETS}
      onSelect={handleBoardSelect}
      onClose={() => (showBoardSelector = false)}
    />
  {/if}

  {#if showShortcutHelp}
    <ShortcutHelpDialog onClose={() => (showShortcutHelp = false)} />
  {/if}
</div>

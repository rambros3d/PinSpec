<script lang="ts">
  import { AlertCircle, PanelLeft, PanelRight, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import CombinedSidebar from '../components/workspace/CombinedSidebar.svelte';
  import CompatibleMcuFinder from '../components/workspace/CompatibleMcuFinder.svelte';
  import ExportModal from '../components/workspace/ExportModal.svelte';
  import McuSwitcherModal from '../components/workspace/McuSwitcherModal.svelte';
  import PackageCanvas from '../components/workspace/PackageCanvas.svelte';
  import PinoutDiffModal from '../components/workspace/PinoutDiffModal.svelte';
  import SummaryDrawer from '../components/workspace/SummaryDrawer.svelte';
  import { DOCK_TABS, type DockTab, type SummaryTab, type WorkspaceState } from '../core/types';
  import { catalogStore } from '../state/catalog.svelte';
  import { router } from '../state/router.svelte';
  import { topBarUI } from '../state/top-bar-ui.svelte';
  import { viewPreferences } from '../state/workspace-preferences.svelte';
  import { workspaceStore } from '../state/workspace.svelte';

  interface Props {
    mcuId?: string;
    sharedPayload?: string;
  }

  let { mcuId, sharedPayload }: Props = $props();

  const DOCK_TAB_LABELS: Record<DockTab, string> = {
    peripherals: 'Peripherals',
    pins: 'Pins',
    diagnostics: 'Diagnostics',
    dma: 'DMA',
    pio: 'PIO',
    placement: 'Placement',
    audit: 'Audit',
  };

  /** Combined tree and detail column; 160 + 280 with a 260px detail minimum. */
  let leftWidth = $state(440);
  let rightWidth = $state(330);
  let leftCollapsed = $state(false);
  let rightCollapsed = $state(false);

  let canvasRef = $state<{ fitView: () => void } | null>(null);
  let summaryTab = $state<SummaryTab>(viewPreferences.summaryTab);

  /** Select a portrait dock tab; non-tree tabs drive the shared summary pane. */
  function selectDockTab(tab: DockTab): void {
    const previous = workspaceStore.dockTab;
    workspaceStore.setDockTab(tab);
    if (tab !== 'peripherals') summaryTab = tab;
    if (tab === 'placement') workspaceStore.setPlacementOverlayVisible(true);
    else if (previous === 'placement') workspaceStore.setPlacementOverlayVisible(false);
  }

  /**
   * A tree row selects the peripheral for editing. Selection is local UI state
   * and stays out of share URLs and project files; the detail column no longer
   * has a section switcher.
   */
  function selectPeripheral(name: string): void {
    viewPreferences.selectedPeripheral = name;
  }

  /**
   * Keep the drawer's own tab clicks in localStorage view preferences. Opening
   * Placement activates the overlay; leaving it deactivates an overlay that
   * was activated by the tab. A canvas toggle remains the explicit override.
   */
  let previousSummaryTab = $state<SummaryTab>(viewPreferences.summaryTab);
  $effect(() => {
    const tab = summaryTab;
    if (viewPreferences.summaryTab !== tab) viewPreferences.summaryTab = tab;
    if (tab !== previousSummaryTab) {
      if (tab === 'placement') workspaceStore.setPlacementOverlayVisible(true);
      else if (previousSummaryTab === 'placement') workspaceStore.setPlacementOverlayVisible(false);
      previousSummaryTab = tab;
    }
  });

  /** Collapsing the drawer hides an overlay opened by its Placement tab. */
  function toggleRightDrawer(): void {
    rightCollapsed = !rightCollapsed;
    if (summaryTab === 'placement') {
      workspaceStore.setPlacementOverlayVisible(!rightCollapsed);
    }
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
        // Combined minimum: 120px tree + 260px detail + resize gutters.
        leftWidth = Math.max(400, Math.min(680, startWidth + dx));
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
    topBarUI.workspaceMode = true;
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        topBarUI.focusSearch?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        topBarUI.switcherOpen = true;
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
        topBarUI.shortcutHelpOpen = true;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      topBarUI.reset();
    };
  });
</script>

<div
  class="workspace-root h-full w-full overflow-hidden overscroll-none bg-base-200 text-foreground"
  data-dock-tab={workspaceStore.dockTab}
  style={`--left-pane-width: ${leftWidth}px; --right-pane-width: ${rightWidth}px;`}
>
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
            onclick={() => (topBarUI.switcherOpen = true)}
            class="btn btn-sm btn-primary text-xs font-semibold"
          >
            Choose Another MCU
          </button>
        </div>
      </div>
    </div>
  {:else}
      <!-- Left Pane: Combined peripheral tree and detail sidebar -->
      {#if !leftCollapsed}
        <div class="workspace-peripherals h-full">
          <CombinedSidebar
            chip={workspaceStore.chip}
            assignments={workspaceStore.state.assignments}
            peripheralModes={workspaceStore.state.peripheralModes}
            peripheralStatus={workspaceStore.report.peripheralStatus}
            activeRemaps={workspaceStore.state.activeRemaps ?? {}}
            onSelectPeripheral={selectPeripheral}
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
          data-placement-furniture
          class="btn btn-ghost btn-sm btn-square workspace-landscape-only hidden md:flex absolute top-3 left-3 z-20 shadow-xs"
        >
          <PanelLeft class="size-3.5" />
        </button>

        <button
          type="button"
          onclick={toggleRightDrawer}
          title={rightCollapsed ? 'Show Summary Drawer' : 'Hide Summary Drawer'}
          data-placement-furniture
          class="btn btn-ghost btn-sm btn-square workspace-landscape-only hidden lg:flex absolute top-14 right-3 z-20 shadow-xs"
        >
          <PanelRight class="size-3.5" />
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
            peripheralModes={workspaceStore.state.peripheralModes}
            peripheralStatus={workspaceStore.report.peripheralStatus}
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
      class={`workspace-toast alert fixed bottom-14 left-1/2 -translate-x-1/2 z-[60] flex flex-row items-center gap-2 px-4 py-2 text-xs font-medium shadow-lg ${
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

  <!-- Modals; dialog flags live in transient top-bar UI state. -->
  {#if topBarUI.diffOpen}
    <PinoutDiffModal onClose={() => (topBarUI.diffOpen = false)} />
  {/if}

  {#if topBarUI.finderOpen}
    <CompatibleMcuFinder
      chip={workspaceStore.chip}
      workspaceState={workspaceStore.state}
      onClose={() => (topBarUI.finderOpen = false)}
    />
  {/if}

  {#if topBarUI.switcherOpen}
    <McuSwitcherModal
      activeMcuId={workspaceStore.chip?.id ?? ''}
      onSelect={(id) => router.navigateMcu(id)}
      onClose={() => (topBarUI.switcherOpen = false)}
    />
  {/if}

  {#if topBarUI.exportOpen && workspaceStore.chip}
    <ExportModal
      chip={workspaceStore.chip}
      state={workspaceStore.state}
      shareUrl={workspaceStore.buildShareUrl()}
      onImportState={handleImportState}
      onClose={() => (topBarUI.exportOpen = false)}
    />
  {/if}
</div>

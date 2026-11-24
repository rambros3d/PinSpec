<script lang="ts">
  import {
    AlertCircle,
    ArrowRight,
    CircuitBoard,
    Database,
    FileUp,
    FolderOpen,
    GitCompare,
    Keyboard,
    Plus,
    RefreshCw,
    Upload,
    X,
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import PresetGrid from '../components/landing/PresetGrid.svelte';
  import QuickSearchBar from '../components/landing/QuickSearchBar.svelte';
  import BoardSelectorModal from '../components/workspace/BoardSelectorModal.svelte';
  import PinoutDiffModal from '../components/workspace/PinoutDiffModal.svelte';
  import { parsePinoutJson } from '../core/exporters/json';
  import {
    buildWorkspaceFromPins,
    prepareIocImport,
    type IocRawRecord,
  } from '../core/importers/ioc';
  import type { CatalogSourceId, VendorId } from '../core/types';
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

  /** Seven canonical upstream sources credited in the technical footer. */
  const PROVENANCE_SOURCES: ReadonlyArray<{
    id: CatalogSourceId;
    label: string;
    url: string;
    license: string;
  }> = [
    {
      id: 'st-open-pin-data',
      label: 'STMicroelectronics/STM32_open_pin_data',
      url: 'https://github.com/STMicroelectronics/STM32_open_pin_data',
      license: 'BSD-3-Clause',
    },
    {
      id: 'stm32-data-generated',
      label: 'embassy-rs/stm32-data-generated',
      url: 'https://github.com/embassy-rs/stm32-data-generated',
      license: 'MIT / Apache-2.0',
    },
    {
      id: 'ch32-device-data',
      label: 'ch32-riscv-ug/ch32-device-data',
      url: 'https://github.com/ch32-riscv-ug/ch32-device-data',
      license: 'MIT',
    },
    {
      id: 'kicad',
      label: 'KiCad symbols and footprints',
      url: 'https://gitlab.com/kicad/libraries/kicad-symbols',
      license: 'CC-BY-SA-4.0 (generated-file exception)',
    },
    {
      id: 'pico-sdk',
      label: 'pico-sdk and picotool',
      url: 'https://github.com/raspberrypi/pico-sdk',
      license: 'BSD-3-Clause',
    },
    {
      id: 'zephyr',
      label: 'Zephyr',
      url: 'https://github.com/zephyrproject-rtos/zephyr',
      license: 'Apache-2.0',
    },
    {
      id: 'raspberry-pi-docs',
      label: 'raspberrypi/documentation',
      url: 'https://github.com/raspberrypi/documentation',
      license: 'CC-BY-SA-4.0',
    },
  ];

  const PROVENANCE_VENDORS: ReadonlyArray<{ id: VendorId; label: string }> = [
    { id: 'stm32', label: 'STM32' },
    { id: 'ch32', label: 'CH32' },
    { id: 'rp', label: 'RP' },
  ];

  /** Text-only keyboard reference shown in the right rail. */
  const SHORTCUTS: ReadonlyArray<{ keys: string; action: string }> = [
    { keys: 'Ctrl+K', action: 'Search parts' },
    { keys: 'Ctrl+F', action: 'Search pins in a workspace' },
    { keys: 'Ctrl+Click', action: 'Open pin remap mode' },
    { keys: 'Ctrl+Z', action: 'Undo' },
    { keys: 'Ctrl+Y', action: 'Redo' },
    { keys: '0', action: 'Fit package in view' },
    { keys: 'Escape', action: 'Cancel the current action' },
  ];

  let searchRef = $state<{ focusInput: () => void } | undefined>(undefined);
  let presetsRef = $state<HTMLElement | null>(null);
  let showBoardSelector = $state(false);
  let showDiff = $state(false);
  let importError = $state<string | null>(null);
  let jsonFileInput = $state<HTMLInputElement | null>(null);
  let iocFileInput = $state<HTMLInputElement | null>(null);
  let iocDropActive = $state(false);
  let ambiguousImport = $state<{ record: IocRawRecord; candidates: string[] } | null>(null);
  let ambiguousChoice = $state<string | null>(null);
  let ambiguousDialogEl = $state<HTMLDialogElement | null>(null);
  let ambiguousCancelEl = $state<HTMLButtonElement | null>(null);

  /** Focus the central part search without changing any persisted state. */
  function focusQuickSearch(): void {
    searchRef?.focusInput();
  }

  /** Bring the recent sessions and starter chips into view. */
  function revealRecentSessions(): void {
    presetsRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleJsonImport(e: Event): Promise<void> {
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

  async function applyIocRecord(record: IocRawRecord, mcuId: string): Promise<void> {
    try {
      const chip = await catalogStore.loadChip(mcuId);
      const built = buildWorkspaceFromPins(record.pins, { chip, mcuId: chip.id });
      if (!built.ok) {
        importError = built.error;
        return;
      }
      workspaceStore.setPendingHandoff(built.state);
      router.navigateMcu(chip.id);
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Unable to load the imported MCU.';
    }
  }

  async function handleIocFile(file: File): Promise<void> {
    importError = null;
    if (catalogStore.index.length === 0) await catalogStore.ensureLoaded();
    if (catalogStore.indexError) {
      importError = catalogStore.indexError;
      return;
    }
    const text = await file.text();
    const prepared = prepareIocImport(text, catalogStore.index);
    if (prepared.kind === 'error') {
      importError = prepared.error;
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
    importError = null;
    await catalogStore.ensureLoaded();
    const resolved = resolveBoardPreset(preset, catalogStore.index);
    if (!resolved.ok) {
      importError = resolved.error;
      return;
    }
    showBoardSelector = false;
    try {
      const chip = await catalogStore.loadChip(resolved.mcuId);
      const built = buildBoardPresetState(preset, chip);
      if (!built.ok) {
        importError = built.error;
        return;
      }
      workspaceStore.setPendingHandoff(built.state);
      router.navigateMcu(chip.id);
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Unable to load the selected board MCU.';
    }
  }

  // The ambiguous-import dialog is conditional, so promote it when it mounts.
  $effect(() => {
    if (ambiguousImport && ambiguousDialogEl && !ambiguousDialogEl.open) {
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ambiguousDialogEl.showModal();
      openDialogWithFocus(ambiguousDialogEl, ambiguousCancelEl, opener);
    }
  });

  function formatSyncDate(iso: string | undefined): string {
    if (!iso) return 'pending';
    try {
      return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    } catch {
      return iso;
    }
  }

  onMount(() => {
    catalogStore.ensureLoaded();
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

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  });
</script>

<div class="landing-shell flex flex-col bg-base-200 text-foreground">
  <!-- Sticky navigation: discovery anchors and theme control stay available. -->
  <header class="navbar sticky top-0 z-30 border-b border-base-300 bg-base-100/95 backdrop-blur-xs">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
      <a
        href="#/"
        class="flex items-center gap-2 text-base font-bold tracking-tight text-foreground whitespace-nowrap shrink-0"
      >
        <svg class="size-5 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </svg>
        <span>PinCraft</span>
      </a>

      <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-base-content/60">
        <a href="#presets" class="link link-hover transition-colors whitespace-nowrap shrink-0">
          Starter Chips
        </a>
        <a
          href="#provenance"
          class="link link-hover transition-colors whitespace-nowrap shrink-0"
        >
          Data Sources
        </a>
      </nav>

      <div class="flex items-center gap-2.5 shrink-0">
        <ThemePicker />
      </div>
    </div>
  </header>

  <!-- Start screen: actions, discovery, and catalog facts share one scroll shell. -->
  <main class="start-grid max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- Left action column -->
    <section data-zone="actions" class="start-actions lg:col-span-3 space-y-3" aria-label="Start a pinout">
      <div class="px-1 pb-1">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">Start a pinout</h1>
        <p class="text-xs text-base-content/60 mt-1">
          Pin allocation for STM32, CH32 and RP parts in the browser.
        </p>
      </div>

      <button
        type="button"
        onclick={focusQuickSearch}
        class="card card-border w-full bg-base-100 p-3.5 flex items-center gap-3 text-left hover:border-info transition-colors"
      >
        <Plus class="size-4 text-info shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-foreground">New pinout MCU/Board</span>
          <span class="block text-xs text-base-content/60 mt-0.5">Search the catalog by part, family or package.</span>
        </span>
        <ArrowRight class="size-3.5 text-base-content/60 shrink-0" />
      </button>
      <button
        type="button"
        onclick={() => (showBoardSelector = true)}
        title="Start from an official board preset"
        aria-label="Open board preset selector"
        class="btn btn-sm btn-outline w-full gap-2 text-xs font-medium"
      >
        <CircuitBoard class="size-3.5" />
        <span>Choose a board preset</span>
      </button>

      <button
        type="button"
        onclick={revealRecentSessions}
        class="card card-border w-full bg-base-100 p-3.5 flex items-center gap-3 text-left hover:border-info transition-colors"
      >
        <FolderOpen class="size-4 text-info shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-foreground">Open project</span>
          <span class="block text-xs text-base-content/60 mt-0.5">Reopen a recent local session.</span>
        </span>
        <ArrowRight class="size-3.5 text-base-content/60 shrink-0" />
      </button>

      <button
        type="button"
        onclick={() => iocFileInput?.click()}
        class="card card-border w-full bg-base-100 p-3.5 flex items-center gap-3 text-left hover:border-info transition-colors"
      >
        <FileUp class="size-4 text-info shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-foreground">Import .ioc</span>
          <span class="block text-xs text-base-content/60 mt-0.5">Read assignments from an STM32CubeIDE file.</span>
        </span>
        <ArrowRight class="size-3.5 text-base-content/60 shrink-0" />
      </button>
      <input
        bind:this={iocFileInput}
        type="file"
        accept=".ioc"
        class="hidden"
        aria-label="Import .ioc project file"
        onchange={(e) => {
          const file = (e.currentTarget as HTMLInputElement).files?.[0];
          if (file) void handleIocFile(file);
          (e.currentTarget as HTMLInputElement).value = '';
        }}
      />

      <button
        type="button"
        onclick={() => jsonFileInput?.click()}
        class="card card-border w-full bg-base-100 p-3.5 flex items-center gap-3 text-left hover:border-info transition-colors"
      >
        <Upload class="size-4 text-info shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-foreground">Import pinout.json</span>
          <span class="block text-xs text-base-content/60 mt-0.5">Load a version-2 project file.</span>
        </span>
        <ArrowRight class="size-3.5 text-base-content/60 shrink-0" />
      </button>
      <input
        bind:this={jsonFileInput}
        type="file"
        accept=".json,application/json"
        class="hidden"
        aria-label="Import pinout JSON project file"
        onchange={handleJsonImport}
      />

      <button
        type="button"
        onclick={() => (showDiff = true)}
        class="card card-border w-full bg-base-100 p-3.5 flex items-center gap-3 text-left hover:border-info transition-colors"
      >
        <GitCompare class="size-4 text-info shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-foreground">Compare</span>
          <span class="block text-xs text-base-content/60 mt-0.5">Diff two project files without editing.</span>
        </span>
        <ArrowRight class="size-3.5 text-base-content/60 shrink-0" />
      </button>

      {#if importError}
        <p role="alert" class="alert alert-error text-xs flex items-start gap-2">
          <AlertCircle class="size-4 shrink-0" />
          <span>{importError}</span>
        </p>
      {/if}
    </section>

    <!-- Central discovery column -->
    <div data-zone="discovery" class="start-discovery lg:col-span-6 min-w-0 space-y-8">
      <section class="bg-dot-grid border border-base-300 rounded-box p-5 space-y-4">
        <div class="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-base-content/60">
          <span>
            {#if catalogStore.meta}
              {catalogStore.meta.chipCount.toLocaleString()} parts indexed · {catalogStore.meta.families.length} families
            {:else}
              STM32, CH32 and RP pinout planning
            {/if}
          </span>
          <span class="badge badge-sm badge-accent">Static / offline-ready</span>
          <span class="badge badge-sm badge-secondary">Open datasets</span>
        </div>

        <QuickSearchBar bind:this={searchRef} onSelect={(id) => router.navigateMcu(id)} />
      </section>

      <div bind:this={presetsRef} class="scroll-mt-20">
        <PresetGrid
          recentSessions={workspaceStore.recentSessions}
          onOpenMcu={(id) => router.navigateMcu(id)}
          onDeleteRecent={(id) => workspaceStore.deleteRecentSession(id)}
        />
      </div>
    </div>

    <!-- Right rail: generated catalog facts, provenance summary and shortcuts. -->
    <aside data-zone="rail" class="start-rail lg:col-span-3 space-y-3" aria-label="Catalog information">
      <section class="card card-border bg-base-100 p-4 space-y-3">
        <div class="flex items-center gap-2">
          <Database class="size-4 text-info" />
          <h2 class="text-sm font-semibold text-foreground">Catalog</h2>
        </div>
        {#if catalogStore.meta}
          <p class="text-xs text-base-content/60 font-mono-tabular">
            {catalogStore.meta.chipCount.toLocaleString()} parts indexed · Synced {formatSyncDate(catalogStore.meta.generatedAt)}
          </p>
          <div class="space-y-2">
            {#each PROVENANCE_VENDORS as vendor (vendor.id)}
              {@const vendorSource = catalogStore.meta.sources?.[vendor.id]}
              {#if vendorSource}
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="font-mono font-semibold text-foreground">{vendor.label}</span>
                  <span class="font-mono-tabular text-base-content/60 text-right">
                    {vendorSource.chipCount.toLocaleString()} chips
                    {#if vendorSource.ratios}
                      · match {vendorSource.ratios.match.toFixed(1)}% · coverage {vendorSource.ratios.coverage.toFixed(1)}%
                    {/if}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        {:else if catalogStore.indexError}
          <p role="alert" class="text-xs text-error">
            Catalog statistics unavailable. Use the retry control in the search results to reload the catalog.
          </p>
        {:else}
          <p class="text-xs text-base-content/60">Loading catalog statistics...</p>
        {/if}
      </section>

      <section class="card card-border bg-base-100 p-4 space-y-2">
        <h2 class="text-sm font-semibold text-foreground">Data provenance</h2>
        <p class="text-xs text-base-content/60">
          {PROVENANCE_SOURCES.length} upstream sources are credited with their licenses and revisions.
        </p>
        <a href="#provenance" class="link link-hover text-xs font-medium inline-flex items-center gap-1">
          View source revisions <ArrowRight class="size-3" />
        </a>
      </section>

      <section class="card card-border bg-base-100 p-4 space-y-2">
        <div class="flex items-center gap-2">
          <Keyboard class="size-4 text-info" />
          <h2 class="text-sm font-semibold text-foreground">Shortcuts</h2>
        </div>
        <ul class="space-y-1.5 text-xs">
          {#each SHORTCUTS as shortcut (shortcut.keys)}
            <li class="flex items-center justify-between gap-3">
              <kbd class="kbd kbd-sm font-mono text-[11px] whitespace-nowrap">{shortcut.keys}</kbd>
              <span class="text-base-content/60 text-right">{shortcut.action}</span>
            </li>
          {/each}
        </ul>
      </section>
    </aside>
  </main>

  <!-- Technical attribution footer -->
  <footer id="provenance" class="footer footer-horizontal border-t border-base-300 bg-base-100">
    <div class="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row items-start justify-between gap-6 text-xs text-base-content/60">
      <div class="font-mono-tabular space-y-1">
        <div class="font-semibold text-foreground">Per-vendor chip counts and source revisions</div>
        <div>
          PinCraft ·
          {#if catalogStore.meta}
            {catalogStore.meta.chipCount.toLocaleString()} MCUs indexed · Synced {formatSyncDate(catalogStore.meta.generatedAt)}
          {:else}
            Catalog metadata loading...
          {/if}
        </div>
        {#each PROVENANCE_VENDORS as vendor (vendor.id)}
          {@const vendorSource = catalogStore.meta?.sources?.[vendor.id]}
          {#if vendorSource}
            {@const repoCount = vendorSource.repositories?.length ?? 0}
            <div class="text-[11px] text-base-content/60 space-y-0.5">
              <div>
                {vendor.label}: {vendorSource.chipCount.toLocaleString()} chips · primary revision {vendorSource.commit ?? 'unknown'}
                {#if vendorSource.ratios}
                  · match {vendorSource.ratios.match.toFixed(1)}% · coverage {vendorSource.ratios.coverage.toFixed(1)}%
                {/if}
              </div>
              {#if repoCount > 0}
                {#each vendorSource.repositories ?? [] as repo (repo.id)}
                  <div>{repo.id} {repo.commit} ({repo.license})</div>
                {/each}
              {:else}
                <div>open-pin-data {vendorSource.openPinDataCommit ?? catalogStore.meta?.openPinDataCommit ?? 'unknown'}</div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>

      <div class="text-[11px] space-y-1 lg:text-right">
        <div class="font-semibold text-foreground">Upstream data sources and licenses</div>
        {#each PROVENANCE_SOURCES as source (source.id)}
          {@const record = catalogStore.meta?.sources?.[source.id]}
          <div>
            <a class="underline hover:text-foreground" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
            ({source.license}) · {record?.sha ?? 'loading'}
          </div>
        {/each}
      </div>
    </div>
  </footer>

  {#if iocDropActive}
    <div class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-neutral/50">
      <div class="card card-border border-dashed border-info bg-base-100 px-8 py-6 text-center shadow-lg">
        <FileUp class="w-8 h-8 mx-auto text-info" />
        <p class="mt-2 text-sm font-semibold text-foreground">Drop an .ioc file to import</p>
        <p class="text-xs text-base-content/60 mt-1">Pins are matched by name against the generated catalog.</p>
      </div>
    </div>
  {/if}

  <!-- Ambiguous part ID confirmation, owned by the start screen. -->
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

  {#if showDiff}
    <PinoutDiffModal onClose={() => (showDiff = false)} />
  {/if}

  {#if showBoardSelector}
    <BoardSelectorModal
      presets={BOARD_PRESETS}
      onSelect={(preset) => void handleBoardSelect(preset)}
      onClose={() => (showBoardSelector = false)}
    />
  {/if}
</div>

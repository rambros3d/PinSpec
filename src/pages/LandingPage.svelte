<script lang="ts">
  import {
    AlertCircle,
    Check,
    Copy,
    Download,
    RefreshCw,
    Upload,
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import HeroChipPreview from '../components/landing/HeroChipPreview.svelte';
  import PresetGrid from '../components/landing/PresetGrid.svelte';
  import QuickSearchBar from '../components/landing/QuickSearchBar.svelte';
  import { buildHeroDemoState } from '../core/hero-demo';
  import { exportCHeader } from '../core/exporters/c-header';
  import { exportCsv } from '../core/exporters/csv';
  import { exportEmbassyRust } from '../core/exporters/embassy-rust';
  import { exportPinoutJson, parsePinoutJson } from '../core/exporters/json';
  import { createEmptyWorkspace } from '../core/solver';
  import {
    getChipVendor,
    type CatalogSourceId,
    type ChipData,
    type VendorId,
    type WorkspaceState,
  } from '../core/types';
  import { HERO_CHIPS } from '../core/vendor-view';
  import { catalogStore } from '../state/catalog.svelte';
  import { router } from '../state/router.svelte';
  import { workspaceStore } from '../state/workspace.svelte';

  const HERO_CHIP_ID = 'STM32G431CBU6';

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

  let heroChip = $state<ChipData | null>(null);
  let heroVendor = $state<VendorId>('stm32');
  let heroChipId = $state<string>(HERO_CHIP_ID);
  let heroLoading = $state(true);
  let heroError = $state<string | null>(null);

  function makeInitialDemo(chip: ChipData): WorkspaceState {
    return buildHeroDemoState(chip);
  }

  let demoState = $state<WorkspaceState>(createEmptyWorkspace(HERO_CHIP_ID));
  let exportTab = $state<'rust' | 'c' | 'csv' | 'json'>('rust');
  let copiedExport = $state(false);
  let importError = $state<string | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let heroLoadToken = 0;

  const rustCrate = $derived.by(() => {
    const vendor = heroChip ? getChipVendor(heroChip) : heroVendor;
    if (vendor === 'rp') return 'embassy-rp';
    if (vendor === 'ch32') return 'ch32-hal';
    return 'embassy-stm32';
  });

  const exportTabs = $derived([
    { id: 'rust', label: `Rust · ${rustCrate}` },
    { id: 'c', label: 'C Header' },
    { id: 'csv', label: 'CSV' },
    { id: 'json', label: 'JSON' },
  ] as const);

  const exportFilename = $derived.by(() => {
    const id = (heroChip?.id ?? HERO_CHIP_ID).toLowerCase();
    if (exportTab === 'rust') return `${id}_pins.rs`;
    if (exportTab === 'c') return `${id}_pinout.h`;
    if (exportTab === 'csv') return `${id}_pinout.csv`;
    return `${id}_pinout.json`;
  });

  const exportPreview = $derived.by(() => {
    if (!heroChip) return '';
    if (exportTab === 'rust') return exportEmbassyRust(heroChip, demoState);
    if (exportTab === 'c') return exportCHeader(heroChip, demoState);
    if (exportTab === 'csv') return exportCsv(heroChip, demoState, false);
    return exportPinoutJson(demoState, getChipVendor(heroChip));
  });

  async function loadHero(targetId: string = HERO_CHIP_ID): Promise<void> {
    const token = ++heroLoadToken;
    heroLoading = true;
    heroError = null;
    try {
      // Default hero is always loaded from the generated catalog, never a
      // committed snapshot. Vendor switching reuses the same lazy loader.
      const chip =
        targetId === HERO_CHIP_ID
          ? await catalogStore.loadChip(HERO_CHIP_ID)
          : await catalogStore.loadChip(targetId);
      if (token !== heroLoadToken) return;
      heroChipId = chip.id;
      heroChip = chip;
      demoState = makeInitialDemo(chip);
      catalogStore.primeChip(chip);
    } catch (err) {
      if (token !== heroLoadToken) return;
      heroError = err instanceof Error ? err.message : 'Unable to load hero chip data.';
    } finally {
      if (token === heroLoadToken) heroLoading = false;
    }
  }

  function selectHeroVendor(vendor: VendorId): void {
    const hero = HERO_CHIPS.find((item) => item.vendor === vendor);
    if (!hero) return;
    heroVendor = vendor;
    void loadHero(hero.id);
  }

  function openHeroInWorkspace(state: WorkspaceState): void {
    if (!heroChip) return;
    catalogStore.primeChip(heroChip);
    workspaceStore.setPendingHandoff(state);
    router.navigateMcu(heroChip.id);
  }

  async function handleJsonImport(e: Event): Promise<void> {
    importError = null;
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parsePinoutJson(text);
    if (!parsed.ok) {
      importError = parsed.error;
      return;
    }
    workspaceStore.setPendingHandoff(parsed.state);
    router.navigateMcu(parsed.state.mcuId);
  }

  async function copyPreview(): Promise<void> {
    if (!exportPreview) return;
    try {
      await navigator.clipboard.writeText(exportPreview);
      copiedExport = true;
      setTimeout(() => (copiedExport = false), 1600);
    } catch {
      // ignore
    }
  }

  function downloadPreview(): void {
    if (!exportPreview || typeof document === 'undefined') return;
    const blob = new Blob([exportPreview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

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
    void loadHero();
  });
</script>

<div class="min-h-screen flex flex-col bg-base-200 text-foreground">
  <!-- Clean 3-Zone Top Navigation Bar -->
  <header class="navbar sticky top-0 z-30 border-b border-base-300 bg-base-100/95 backdrop-blur-xs">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
      <!-- Zone 1: Geometric IC Logo + Wordmark -->
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

      <!-- Zone 2: Concise Single-Line Navigation Links -->
      <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-base-content/60">
        <a href="#presets" class="link link-hover transition-colors whitespace-nowrap shrink-0">
          Starter Chips
        </a>
        <a href="#export-preview" class="link link-hover transition-colors whitespace-nowrap shrink-0">
          Exports
        </a>
        <a
          href="#provenance"
          class="link link-hover transition-colors whitespace-nowrap shrink-0"
        >
          Data Sources
        </a>
      </nav>

      <!-- Zone 3: Primary Action + Theme Picker -->
      <div class="flex items-center gap-2.5 shrink-0">
        <ThemePicker />
        <button
          type="button"
          onclick={() => openHeroInWorkspace(demoState)}
          disabled={!heroChip}
          class="btn btn-sm btn-primary text-xs font-semibold whitespace-nowrap shrink-0"
        >
          Workspace
        </button>
      </div>
    </div>
  </header>

  <!-- Split Hero Section with Faint SVG Dot-Grid -->
  <section class="relative border-b border-base-300 bg-dot-grid">
    <div class="max-w-7xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
      <!-- Left Column -->
      <div class="lg:col-span-6 space-y-6 pt-2">
        <div class="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-base-content/60">
          <span>
            {#if catalogStore.meta}
              {catalogStore.meta.chipCount.toLocaleString()} MCUs indexed · {catalogStore.meta.families.length} families
            {:else}
              STM32, CH32 & RP pinout planning
            {/if}
          </span>
          <span class="badge badge-sm badge-accent">Static / offline-ready</span>
          <span class="badge badge-sm badge-secondary">Open datasets</span>
        </div>

        <h1 class="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.12] text-foreground [text-wrap:balance]">
          Fast pinout planning for STM32, CH32 and RP, directly in your browser.
        </h1>

        <p class="text-base text-base-content/60 leading-relaxed max-w-xl">
          Zero-install CubeMX-style pin allocation backed by ST open pin geometry, Embassy peripheral tables, WCH CH32 data and Raspberry Pi RP data. Check signal, remap, PIO and DMA conflicts in real time, move pins with <kbd class="kbd kbd-sm text-xs font-mono">Ctrl+Click</kbd>, and export Rust, C headers, CSV, or shareable URLs.
        </p>

        <!-- Instant Fuzzy MCU Search -->
        <QuickSearchBar onSelect={(id) => router.navigateMcu(id)} />

        <!-- Secondary Action: Import pinout.json -->
        <div class="flex flex-wrap items-center gap-4 pt-1">
          <button
            type="button"
            onclick={() => fileInputEl?.click()}
            class="btn btn-sm btn-outline gap-2 text-xs font-medium whitespace-nowrap"
          >
            <Upload class="size-3.5 text-info" />
            <span>Import pinout.json</span>
          </button>
          <input
            bind:this={fileInputEl}
            type="file"
            accept=".json,application/json"
            class="hidden"
            onchange={handleJsonImport}
          />
          <span class="text-xs text-base-content/60">
            No account or backend required — all state stays local or in your URL hash.
          </span>
        </div>

        {#if importError}
          <p role="alert" class="alert alert-error text-xs">{importError}</p>
        {/if}
      </div>

      <!-- Right Column: Live Interactive HeroChipPreview (lazy catalog data) -->
      <div class="lg:col-span-6">
        {#if heroChip}
          <HeroChipPreview
            chip={heroChip}
            vendor={heroVendor}
            bind:demoState
            onVendorChange={selectHeroVendor}
            onOpenWorkspace={openHeroInWorkspace}
          />
        {:else if heroLoading}
          <div class="card card-border bg-base-100 min-h-[380px] flex items-center justify-center">
            <div class="flex items-center gap-2 text-sm text-base-content/60">
              <RefreshCw class="size-4 animate-spin" />
              <span>Loading hero chip data from the generated catalog...</span>
            </div>
          </div>
        {:else}
          <div class="card card-border bg-base-100 min-h-[380px] flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle class="size-5 text-error" />
            <p class="text-sm font-medium text-foreground">Hero chip data unavailable</p>
            <p class="text-xs text-base-content/60 max-w-md">{heroError ?? 'The generated chip shard could not be loaded.'}</p>
            <button
              type="button"
              onclick={() => void loadHero()}
              class="btn btn-sm btn-outline gap-1.5 text-xs font-medium"
            >
              <RefreshCw class="size-3.5" />
              Retry
            </button>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- Main Below-the-Fold Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-6 py-14 space-y-16">
    <!-- Recent Designs & Popular Starter Chips -->
    <PresetGrid
      recentSessions={workspaceStore.recentSessions}
      onOpenMcu={(id) => router.navigateMcu(id)}
      onDeleteRecent={(id) => workspaceStore.deleteRecentSession(id)}
    />

    <!-- Interactive Export Preview Strip (Live-Synced to Hero Demo) -->
    <section id="export-preview" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-foreground">
            Live Export Preview
          </h2>
          <p class="text-sm text-base-content/60">
            Generated from the {heroChipId} demo above. Changing the vendor or a hero pin assignment updates this output.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <div role="tablist" class="tabs tabs-box flex items-center gap-1 p-1 rounded-box bg-base-300 border border-base-300">
            {#each exportTabs as tab (tab.id)}
              <button
                type="button"
                role="tab"
                aria-selected={exportTab === tab.id}
                onclick={() => (exportTab = tab.id)}
                class={`tab px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  exportTab === tab.id ? 'tab-active bg-base-100 text-foreground shadow-xs' : ''
                }`}
              >
                {tab.label}
              </button>
            {/each}
          </div>

          <button
            type="button"
            onclick={copyPreview}
            class="btn btn-sm btn-outline gap-1.5 text-xs font-medium whitespace-nowrap"
          >
            {#if copiedExport}
              <Check class="size-3.5 text-success" />
              <span>Copied</span>
            {:else}
              <Copy class="size-3.5" />
              <span>Copy</span>
            {/if}
          </button>
          <button
            type="button"
            onclick={downloadPreview}
            class="btn btn-sm btn-primary gap-1.5 text-xs font-semibold whitespace-nowrap"
          >
            <Download class="size-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      <div class="card card-border bg-base-100 overflow-hidden">
        <pre class="p-5 font-mono text-xs leading-relaxed text-foreground overflow-x-auto max-h-[340px]">{exportPreview}</pre>
      </div>
    </section>
  </main>

  <!-- Technical Attribution Footer -->
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
            <div class="text-[11px] text-base-content/40 space-y-0.5">
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
</div>

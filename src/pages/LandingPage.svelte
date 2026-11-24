<script lang="ts">
  import {
    AlertCircle,
    ArrowLeftRight,
    Check,
    Copy,
    Cpu,
    FileCode2,
    RefreshCw,
    Upload,
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import ThemePicker from '../components/ThemePicker.svelte';
  import HeroChipPreview from '../components/landing/HeroChipPreview.svelte';
  import PresetGrid from '../components/landing/PresetGrid.svelte';
  import QuickSearchBar from '../components/landing/QuickSearchBar.svelte';
  import { exportCHeader } from '../core/exporters/c-header';
  import { exportCsv } from '../core/exporters/csv';
  import { exportEmbassyRust } from '../core/exporters/embassy-rust';
  import { parsePinoutJson } from '../core/exporters/json';
  import { allocatePeripheralMode, createEmptyWorkspace } from '../core/solver';
  import type { ChipData, WorkspaceState } from '../core/types';
  import { catalogStore } from '../state/catalog.svelte';
  import { router } from '../state/router.svelte';
  import { workspaceStore } from '../state/workspace.svelte';

  const HERO_CHIP_ID = 'STM32G431CBU6';

  let heroChip = $state<ChipData | null>(null);
  let heroLoading = $state(true);
  let heroError = $state<string | null>(null);

  function makeInitialDemo(chip: ChipData): WorkspaceState {
    let s = createEmptyWorkspace(chip.id);
    s = allocatePeripheralMode(chip, s, 'SYS', 'swd').state;
    s = allocatePeripheralMode(chip, s, 'SPI1', 'full_duplex').state;
    s = allocatePeripheralMode(chip, s, 'USART2', 'async').state;
    s = allocatePeripheralMode(chip, s, 'TIM1', 'pwm_3phase_comp').state;
    for (const [pos, asgn] of Object.entries(s.assignments)) {
      if (asgn.peripheral === 'SPI1' && asgn.signal === 'SCK') s.labels[pos] = 'IMU_CLK';
      if (asgn.peripheral === 'SPI1' && asgn.signal === 'MISO') s.labels[pos] = 'IMU_MISO';
      if (asgn.peripheral === 'SPI1' && asgn.signal === 'MOSI') s.labels[pos] = 'IMU_MOSI';
      if (asgn.peripheral === 'USART2' && asgn.signal === 'TX') s.labels[pos] = 'DBG_TX';
      if (asgn.peripheral === 'USART2' && asgn.signal === 'RX') s.labels[pos] = 'DBG_RX';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH1') s.labels[pos] = 'MOTOR_UH';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH1N') s.labels[pos] = 'MOTOR_UL';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH2') s.labels[pos] = 'MOTOR_VH';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH2N') s.labels[pos] = 'MOTOR_VL';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH3') s.labels[pos] = 'MOTOR_WH';
      if (asgn.peripheral === 'TIM1' && asgn.signal === 'CH3N') s.labels[pos] = 'MOTOR_WL';
    }
    return s;
  }

  let demoState = $state<WorkspaceState>(createEmptyWorkspace(HERO_CHIP_ID));
  let exportTab = $state<'rust' | 'c' | 'csv'>('rust');
  let copiedExport = $state(false);
  let importError = $state<string | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  const exportPreview = $derived.by(() => {
    if (!heroChip) return '';
    if (exportTab === 'rust') return exportEmbassyRust(heroChip, demoState);
    if (exportTab === 'c') return exportCHeader(heroChip, demoState);
    return exportCsv(heroChip, demoState, false);
  });

  async function loadHero(): Promise<void> {
    heroLoading = true;
    heroError = null;
    try {
      const chip = await catalogStore.loadChip(HERO_CHIP_ID);
      heroChip = chip;
      demoState = makeInitialDemo(chip);
      catalogStore.primeChip(chip);
    } catch (err) {
      heroError = err instanceof Error ? err.message : 'Unable to load hero chip data.';
    } finally {
      heroLoading = false;
    }
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

<div class="min-h-screen flex flex-col bg-canvas text-primary">
  <!-- Clean 3-Zone Top Navigation Bar -->
  <header class="sticky top-0 z-30 border-b border-hairline bg-surface-alpha backdrop-blur-xs">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
      <!-- Zone 1: Geometric IC Logo + Wordmark -->
      <a
        href="#/"
        class="flex items-center gap-2 text-base font-bold tracking-tight text-primary whitespace-nowrap shrink-0"
      >
        <svg class="w-5 h-5 text-hint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </svg>
        <span>PinCraft</span>
      </a>

      <!-- Zone 2: Concise Single-Line Navigation Links -->
      <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-muted">
        <a href="#presets" class="hover:text-primary transition-colors whitespace-nowrap shrink-0">
          Starter Chips
        </a>
        <a href="#capabilities" class="hover:text-primary transition-colors whitespace-nowrap shrink-0">
          Capabilities
        </a>
        <a href="#export-preview" class="hover:text-primary transition-colors whitespace-nowrap shrink-0">
          Exports
        </a>
        <a
          href="https://github.com/STMicroelectronics/STM32_open_pin_data"
          target="_blank"
          rel="noreferrer"
          class="hover:text-primary transition-colors whitespace-nowrap shrink-0"
        >
          Open Data
        </a>
      </nav>

      <!-- Zone 3: Primary Action + Theme Picker -->
      <div class="flex items-center gap-2.5 shrink-0">
        <ThemePicker />
        <button
          type="button"
          onclick={() => openHeroInWorkspace(demoState)}
          disabled={!heroChip}
          class="px-4 py-2 rounded-lg bg-action hover:bg-action-hover text-xs font-semibold text-on-action whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Workspace
        </button>
      </div>
    </div>
  </header>

  <!-- Split Hero Section with Faint SVG Dot-Grid -->
  <section class="relative border-b border-hairline bg-dot-grid">
    <div class="max-w-7xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
      <!-- Left Column -->
      <div class="lg:col-span-6 space-y-6 pt-2">
        <div class="text-xs font-mono-tabular text-muted">
          {#if catalogStore.meta}
            {catalogStore.meta.chipCount.toLocaleString()} STM32 MCUs indexed · {catalogStore.meta.families.length} families · Static & offline-ready
          {:else}
            STM32 pinout planning · Open ST & Embassy datasets
          {/if}
        </div>

        <h1 class="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.12] text-primary [text-wrap:balance]">
          Fast STM32 pinout planning, directly in your browser.
        </h1>

        <p class="text-base text-muted leading-relaxed max-w-xl">
          Zero-install CubeMX-style pin allocation backed by official ST open pin geometry and Embassy peripheral tables. Check signal and DMA conflicts in real time, remap alternate pins with <kbd class="px-1.5 py-0.5 text-xs font-mono rounded border border-strong bg-surface">Ctrl+Click</kbd>, and export clean Embassy Rust, C headers, CSV, or shareable URLs.
        </p>

        <!-- Instant Fuzzy MCU Search -->
        <QuickSearchBar onSelect={(id) => router.navigateMcu(id)} />

        <!-- Secondary Action: Import pinout.json -->
        <div class="flex flex-wrap items-center gap-4 pt-1">
          <button
            type="button"
            onclick={() => fileInputEl?.click()}
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-strong bg-surface hover:border-hint text-xs font-medium text-primary transition-colors whitespace-nowrap"
          >
            <Upload class="w-3.5 h-3.5 text-hint" />
            <span>Import pinout.json</span>
          </button>
          <input
            bind:this={fileInputEl}
            type="file"
            accept=".json,application/json"
            class="hidden"
            onchange={handleJsonImport}
          />
          <span class="text-xs text-muted">
            No account or backend required — all state stays local or in your URL hash.
          </span>
        </div>

        {#if importError}
          <p class="text-xs text-danger">{importError}</p>
        {/if}
      </div>

      <!-- Right Column: Live Interactive HeroChipPreview (lazy catalog data) -->
      <div class="lg:col-span-6">
        {#if heroChip}
          <HeroChipPreview
            chip={heroChip}
            bind:demoState
            onOpenWorkspace={openHeroInWorkspace}
          />
        {:else if heroLoading}
          <div class="rounded-xl border border-hairline bg-surface min-h-[380px] flex items-center justify-center">
            <div class="flex items-center gap-2 text-sm text-muted">
              <RefreshCw class="w-4 h-4 animate-spin" />
              <span>Loading hero chip data from the generated catalog...</span>
            </div>
          </div>
        {:else}
          <div class="rounded-xl border border-hairline bg-surface min-h-[380px] flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle class="w-5 h-5 text-danger" />
            <p class="text-sm font-medium text-primary">Hero chip data unavailable</p>
            <p class="text-xs text-muted max-w-md">{heroError ?? 'The generated chip shard could not be loaded.'}</p>
            <button
              type="button"
              onclick={() => void loadHero()}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-strong bg-surface hover:border-hint text-xs font-medium text-primary transition-colors"
            >
              <RefreshCw class="w-3.5 h-3.5" />
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

    <!-- Core Capabilities Grid (4 Engineering Cards) -->
    <section id="capabilities" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-primary">
          Built for Real Hardware Workflows
        </h2>
        <p class="text-sm text-muted">
          Deterministic constraint solving and accurate package layouts without desktop bloat.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="rounded-lg border border-hairline bg-surface p-5 space-y-2.5">
          <Cpu class="w-5 h-5 text-hint" />
          <h3 class="text-sm font-semibold text-primary">
            Parametric Perimeter & BGA Renderers
          </h3>
          <p class="text-xs text-muted leading-relaxed">
            Accurate counter-clockwise LQFP, QFN, UFQFPN, and TSSOP layouts alongside zoom-adaptive JEDEC UFBGA, TFBGA, and WLCSP ball matrices.
          </p>
        </div>

        <div class="rounded-lg border border-hairline bg-surface p-5 space-y-2.5">
          <ArrowLeftRight class="w-5 h-5 text-pin-success" />
          <h3 class="text-sm font-semibold text-primary">
            Mode Allocation & Ctrl+Click Remapping
          </h3>
          <p class="text-xs text-muted leading-relaxed">
            Scarcity-aware backtracking preserves USB, HSE, and SWD pins, flags DMA contention, and surfaces 1-hop remap fixes in one click.
          </p>
        </div>

        <div class="rounded-lg border border-hairline bg-surface p-5 space-y-2.5">
          <FileCode2 class="w-5 h-5 text-pin-power" />
          <h3 class="text-sm font-semibold text-primary">
            Embassy Rust, C Header, CSV & URL Links
          </h3>
          <p class="text-xs text-muted leading-relaxed">
            Export idiomatic Embassy peripheral structs, include-guarded C macros, KiCad/EasyEDA CSV cross-checks, or deflate-compressed share links.
          </p>
        </div>

        <div class="rounded-lg border border-hairline bg-surface p-5 space-y-2.5">
          <RefreshCw class="w-5 h-5 text-hint" />
          <h3 class="text-sm font-semibold text-primary">
            Automated Weekly Open-Data Sync
          </h3>
          <p class="text-xs text-muted leading-relaxed">
            Static per-MCU JSON shards are compiled directly from ST open pin XMLs and Embassy stm32-data with zero runtime servers.
          </p>
        </div>
      </div>
    </section>

    <!-- Interactive Export Preview Strip (Live-Synced to Hero Demo) -->
    <section id="export-preview" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-primary">
            Live Export Preview
          </h2>
          <p class="text-sm text-muted">
            Synchronized in real time with the {heroChip?.id ?? HERO_CHIP_ID} chip above — edit any hero pin to watch the generated code update.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 p-1 rounded-lg bg-elevated border border-hairline">
            {#each [
              { id: 'rust', label: 'Embassy Rust' },
              { id: 'c', label: 'C Header' },
              { id: 'csv', label: 'CSV' },
            ] as tab (tab.id)}
              <button
                type="button"
                onclick={() => (exportTab = tab.id as 'rust' | 'c' | 'csv')}
                class={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  exportTab === tab.id
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            {/each}
          </div>

          <button
            type="button"
            onclick={copyPreview}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline bg-surface hover:border-hint text-xs font-medium text-primary whitespace-nowrap"
          >
            {#if copiedExport}
              <Check class="w-3.5 h-3.5 text-pin-success" />
              <span>Copied</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span>Copy</span>
            {/if}
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-hairline bg-surface overflow-hidden">
        <pre class="p-5 font-mono text-xs leading-relaxed text-primary overflow-x-auto max-h-[340px]">{exportPreview}</pre>
      </div>
    </section>
  </main>

  <!-- Technical Attribution Footer -->
  <footer class="border-t border-hairline bg-surface">
    <div class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted">
      <div class="font-mono-tabular space-y-1">
        <div>
          PinCraft ·
          {#if catalogStore.meta}
            {catalogStore.meta.chipCount.toLocaleString()} MCUs indexed · Synced {formatSyncDate(catalogStore.meta.generatedAt)}
          {:else}
            Catalog metadata loading...
          {/if}
        </div>
        {#if catalogStore.meta?.sources?.stm32}
          {@const stm32Source = catalogStore.meta.sources.stm32}
          <div class="text-[11px] text-faint space-y-0.5">
            {#if stm32Source.repositories}
              {#each stm32Source.repositories as repo (repo.id)}
                <div>{repo.id} {repo.commit} ({repo.license}) · {stm32Source.chipCount.toLocaleString()} chips</div>
              {/each}
            {:else}
              <div>
                Upstream commits: open-pin-data {stm32Source.openPinDataCommit ?? catalogStore.meta.openPinDataCommit} · stm32-data {stm32Source.commit ?? catalogStore.meta.stm32DataCommit}
              </div>
            {/if}
          </div>
        {:else if catalogStore.meta}
          <div class="text-[11px] text-faint">
            Upstream commits: open-pin-data {catalogStore.meta.openPinDataCommit} · stm32-data {catalogStore.meta.stm32DataCommit}
          </div>
        {/if}
      </div>

      <div class="text-[11px] space-y-1 sm:text-right">
        <div>
          Pinout geometry: <a class="underline hover:text-primary" href="https://github.com/STMicroelectronics/STM32_open_pin_data" target="_blank" rel="noreferrer">STMicroelectronics/STM32_open_pin_data</a> (BSD-3-Clause)
        </div>
        <div>
          AF & DMA tables: <a class="underline hover:text-primary" href="https://github.com/embassy-rs/stm32-data-generated" target="_blank" rel="noreferrer">embassy-rs/stm32-data-generated</a> (MIT / Apache-2.0)
        </div>
      </div>
    </div>
  </footer>
</div>

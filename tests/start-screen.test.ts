import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace } from '../src/core/solver';
import { THEME_STORAGE_KEY } from '../src/state/theme.svelte';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const page = read('src/pages/LandingPage.svelte');
const workspace = read('src/pages/WorkspacePage.svelte');

describe('start screen layout', () => {
  it('renders three zones inside one scrollable landing shell', () => {
    expect(page).toContain('class="landing-shell flex flex-col bg-base-200 text-foreground"');
    expect(page).not.toContain('class="navbar');
    expect(page).toContain('data-zone="actions"');
    expect(page).toContain('data-zone="discovery"');
    expect(page).toContain('data-zone="rail"');
    expect(page).not.toContain('min-h-screen');
    const bar = read('src/components/shell/GlobalTopBar.svelte');
    expect(bar).toContain('<ThemePicker compact={true} />');
    expect(bar).toContain("label: 'Home'");
    expect(bar).toContain("label: 'Catalog'");
    expect(bar).toContain("label: 'Projects'");
    expect(page).toContain('href="#presets"');
    expect(page).not.toContain('href="#/about"');
    expect(page).not.toContain('href="#provenance"');
    expect(page).not.toContain('id="provenance"');
    expect(page).not.toContain('href="#export-preview"');
  });

  it('keeps catalog loading and the central discovery surfaces', () => {
    expect(page).toContain('catalogStore.ensureLoaded()');
    expect(page).toContain('<QuickSearchBar');
    expect(page).toContain('<PresetGrid');
    const search = read('src/components/landing/QuickSearchBar.svelte');
    expect(search).toContain('Ctrl+K');
    expect(search).toContain('buildVendorTabs');
    expect(search).toContain('catalogStore.indexError');
    expect(search).toContain('Retry catalog load');
    expect(search).toContain('No parts matched your filter criteria.');
    expect(search).toContain('export function focusInput()');
    expect(page).toContain('focusQuickSearch');
  });

  it('restores quick-search filters from the localStorage-only store', () => {
    const search = read('src/components/landing/QuickSearchBar.svelte');
    expect(search).toContain('discoveryPreferences.quickSearch');
    for (const field of [
      'filters.query',
      'filters.vendor',
      'filters.family',
      'filters.package',
    ]) {
      expect(search, field).toContain(field);
    }
    expect(search).toContain('filters.reset()');
    expect(search).not.toContain('workspaceStore.state');
    expect(read('src/core/types.ts')).not.toContain('quickSearchFilters');
  });

  it('uses daisyUI alert and loading classes on quick-search and statistics surfaces', () => {
    const search = read('src/components/landing/QuickSearchBar.svelte');
    expect(search).toContain('alert alert-soft alert-error');
    expect(search).toContain('loading loading-spinner loading-xs');
    expect(page).toContain('alert alert-soft alert-error');
    expect(page).toContain('Catalog statistics unavailable.');
    expect(page).toContain('loading loading-spinner loading-xs');
  });
});

describe('start screen vendor copy', () => {
  it('names all six vendors and avoids an offline-font claim', () => {
    const preset = read('src/components/landing/PresetGrid.svelte');
    for (const source of [page, preset]) {
      expect(source).toContain('ESP32');
      expect(source).toContain('Microchip SAM');
      expect(source).toContain('Nordic');
      expect(source).not.toContain('STM32, CH32 and RP');
    }
    expect(page).toContain('Static / no backend');
    expect(page).not.toContain('offline-ready');
  });
});

describe('start screen icon provenance', () => {
  it('uses Solar bold duotone icons on the landing and discovery surfaces', () => {
    for (const rel of [
      'src/pages/LandingPage.svelte',
      'src/components/landing/QuickSearchBar.svelte',
      'src/components/landing/PresetGrid.svelte',
    ]) {
      const source = read(rel);
      expect(source, rel).not.toContain('lucide-svelte');
      expect(source, rel).toContain('@solar-icons/svelte/bold-duotone/');
    }
    expect(page).not.toContain('RefreshCw');
    expect(read('src/components/landing/QuickSearchBar.svelte')).toContain(
      '@solar-icons/svelte/bold-duotone/magnifier',
    );
    expect(read('src/components/landing/PresetGrid.svelte')).toContain(
      '@solar-icons/svelte/bold-duotone/clock-circle',
    );
  });
});

describe('start screen actions', () => {
  it('exposes the five entry points with their existing flows', () => {
    for (const label of [
      'New pinout MCU/Board',
      'Open project',
      'Import .ioc',
      'Import pinout.json',
      'Compare',
    ]) {
      expect(page, label).toContain(label);
    }
    expect(page).toContain('router.navigateCatalog()');
    expect(page).toContain('revealRecentSessions');
    expect(page).toContain('presetsRef?.scrollIntoView');
    expect(page).toContain('parsePinoutJson(');
    expect(page).toContain('topBarUI.diffOpen = true');
    expect(page).not.toContain('<PinoutDiffModal');
    expect(page).toContain('<BoardSelectorModal');
    expect(page).toContain('showBoardSelector = true');
  });

  it('uses the shared board preset and pin configuration handoff', () => {
    for (const token of [
      'resolveBoardPreset(',
      'buildBoardPresetState(',
      'workspaceStore.setPendingHandoff(',
      'router.navigateMcu(',
    ]) {
      expect(page, token).toContain(token);
    }
    expect(workspace).toContain('workspaceStore.setPendingHandoff(');
    expect(workspace).not.toContain('BoardSelectorModal');
  });

  it('keeps global shortcuts out of the inline project-name input', () => {
    expect(workspace).toContain("e.key === '?' && !inInput");
    expect(workspace).toContain("(e.ctrlKey || e.metaKey) && !inInput && e.key.toLowerCase() === 'f'");
    expect(workspace).toContain("(e.ctrlKey || e.metaKey) && !inInput && e.key.toLowerCase() === 'k'");
    expect(workspace).toContain("e.key === 'Escape' && inInput");
  });

  it('keeps start-screen presentation state out of shareable pin configuration', () => {
    expect(page).toContain('let showBoardSelector = $state(false)');
    expect(page).toContain('let iocDropActive = $state(false)');
    expect(page).not.toContain('showDiff');
    expect(read('src/state/theme.svelte.ts')).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(page).not.toContain(THEME_STORAGE_KEY);
  });
});

describe('catalog rail', () => {
  const discoveryStart = page.indexOf('data-zone="discovery"');
  const railStart = page.indexOf('data-zone="rail"');
  const discovery = page.slice(discoveryStart, railStart);
  const rail = page.slice(railStart);

  it('reads live metadata for compact vendor counts and the sync date', () => {
    expect(page).toContain('catalogStore.meta');
    expect(page).toContain('PROVENANCE_VENDORS');
    expect(page).toContain('{vendor.label}');
    expect(page).toContain('{vendorSource.chipCount.toLocaleString()} chips');
    expect(page).toContain('Synced {formatSyncDate(catalogStore.meta.generatedAt)}');
    expect(page).not.toContain('ratios.');
    expect(page).not.toContain('match {');
    expect(page).not.toContain('coverage {');
    expect(rail).not.toContain('catalogStore.meta.chipCount.toLocaleString()');
    expect(page).not.toContain('PROVENANCE_SOURCES.length');
    expect(page).toContain('Catalog statistics unavailable.');
    expect(fs.existsSync(path.join(ROOT, 'public', 'data', 'meta.json'))).toBe(true);
  });

  it('keeps the index count in discovery only and leaves shortcuts to the shared dialog', () => {
    expect(discovery).toContain('catalogStore.index.length.toLocaleString()');
    expect(discovery).toContain('familyCount');
    expect(discovery.match(/parts indexed/g)?.length).toBe(1);
    expect(rail).not.toContain('parts indexed');
    expect(rail).not.toContain('families');
    expect(page).not.toContain('SHORTCUTS');
    expect(page).not.toContain('Shortcuts');
    expect(page).not.toContain('<kbd');
    const reference = read('src/data/provenance.ts');
    for (const token of ['Ctrl+K', 'Ctrl+F', 'Ctrl+Click', 'Ctrl+Z', 'Ctrl+Y', '0', 'Escape']) {
      expect(reference, token).toContain(token);
    }
    expect(reference).toContain('const SHORTCUTS');
    expect(read('src/pages/AboutPage.svelte')).toContain('<ProvenancePanel');
  });
});

describe('starter-chip module tags from generated catalog', () => {
  it('derives module tags from the index and keeps starter-chip facts curated only', () => {
    const preset = read('src/components/landing/PresetGrid.svelte');
    expect(preset).toContain('moduleIds?: Set<string>');
    expect(preset).toContain('moduleIds.has(item.id.toUpperCase())');
    expect(preset).not.toContain('module: true');
    expect(preset).toContain('ESP32-WROOM-E');
    expect(page).toContain('moduleIds={moduleIds}');
    expect(page).toContain('entry.module');
  });
});

describe('removed hero and export surfaces', () => {
  it('has no hero identifier, loader, selector or preview on the start screen', () => {
    for (const token of [
      'HeroChipPreview',
      'HERO_CHIP_ID',
      'heroChip',
      'heroVendor',
      'heroChipId',
      'loadHero',
      'selectHeroVendor',
      'openHeroInWorkspace',
      'buildHeroDemoState',
      'HERO_CHIPS',
      'disabled={!',
    ]) {
      expect(page, token).not.toContain(token);
    }
    expect(fs.existsSync(path.join(ROOT, 'src', 'components', 'landing', 'HeroChipPreview.svelte'))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(ROOT, 'src', 'core', 'hero-demo.ts'))).toBe(false);
    expect(read('src/core/vendor-view.ts')).not.toContain('HERO_CHIPS');
  });

  it('has no landing export preview or copy and download controls', () => {
    for (const token of [
      'id="export-preview"',
      'exportTab',
      'exportTabs',
      'exportFilename',
      'exportPreview',
      'rustCrate',
      'copyPreview',
      'downloadPreview',
      'copyContent',
      'downloadFile',
    ]) {
      expect(page, token).not.toContain(token);
    }
    const modal = read('src/components/workspace/ExportModal.svelte');
    for (const token of [
      'embassy-stm32',
      'embassy-rp',
      'ch32-hal',
      'copyContent',
      'downloadFile',
    ]) {
      expect(modal, token).toContain(token);
    }
  });
});

describe('start-screen-only .ioc entry point', () => {
  it('owns file selection, resolution and handoff on the start screen', () => {
    for (const token of [
      'prepareIocImport(',
      'catalogStore.ensureLoaded()',
      'catalogStore.loadChip(',
      'buildWorkspaceFromPins(',
      'applyIocRecord(',
      'handleIocFile(',
      'accept=".ioc"',
      "addEventListener('drop'",
    ]) {
      expect(page, token).toContain(token);
    }
    expect(read('src/core/importers/ioc.ts')).toContain('export function prepareIocImport');
  });

  it('removes every workspace .ioc control, drop handler and dialog', () => {
    for (const token of [
      'accept=".ioc"',
      'handleIocFile',
      'applyIocRecord',
      'prepareIocImport',
      'iocDropActive',
      "addEventListener('dragover'",
      "addEventListener('dragleave'",
      "addEventListener('drop'",
      'ambiguousDialogEl',
      'FileUp',
    ]) {
      expect(workspace, token).not.toContain(token);
    }
    expect(workspace).toContain('handleImportState(');
  });

  it('confirms ambiguous parts on the start screen before opening a workspace', () => {
    for (const token of [
      'ambiguousImport',
      'ambiguousChoice',
      'onClose={handleAmbiguousClose}',
      'ariaLabel="Confirm MCU for .ioc import"',
      'Dialog.svelte',
      '92dvh',
    ]) {
      expect(page, token).toContain(token);
    }
    expect(page).toContain('The part ID in this file matches more than one catalog MCU.');
  });
});

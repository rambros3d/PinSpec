import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '../src/state/theme.svelte';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const page = read('src/pages/LandingPage.svelte');
const workspace = read('src/pages/WorkspacePage.svelte');
const recent = read('src/components/landing/RecentSessions.svelte');

describe('start screen layout', () => {
  it('renders one hero and a two-column body inside one scrollable landing shell', () => {
    expect(page).toContain('class="landing-shell flex flex-col bg-base-200 text-foreground"');
    expect(page).not.toContain('class="navbar');
    expect(page).toContain('data-zone="hero"');
    expect(page).toContain('data-zone="actions"');
    expect(page).toContain('data-zone="sessions"');
    expect(page).not.toContain('data-zone="discovery"');
    expect(page).not.toContain('data-zone="rail"');
    expect(page).not.toContain('start-grid');
    expect(page).not.toContain('min-h-screen');
    const main = page.match(/class="landing-main[^"]*"/)?.[0] ?? '';
    expect(main).toContain('max-w-7xl');
    const body = page.match(/class="grid grid-cols-1[^"]*"/)?.[0] ?? '';
    expect(body).toContain('grid-cols-1');
    expect(body).toContain('lg:grid-cols-2');
    const bar = read('src/components/shell/GlobalNavBar.svelte');
    expect(bar).toContain('<ThemePicker compact={true} />');
    expect(bar).toContain("id: 'home'");
    expect(bar).toContain("id: 'catalog'");
    expect(bar).toContain("id: 'projects'");
    expect(page).not.toContain('href="#presets"');
    expect(page).not.toContain('href="#/about"');
    expect(page).not.toContain('href="#provenance"');
    expect(page).not.toContain('id="provenance"');
    expect(page).not.toContain('href="#export-preview"');
  });

  it('keeps the hero headline, one factual sentence, and the catalog action', () => {
    const hero = page.slice(page.indexOf('data-zone="hero"'), page.indexOf('data-zone="actions"'));
    expect(hero).toContain('<h1');
    expect(hero).toContain('>Plan a pinout</h1>');
    expect(hero.match(/<h1\b/g)?.length).toBe(1);
    expect(hero.indexOf('>Plan a pinout</h1>')).toBeLessThan(hero.indexOf('<p class="text-sm'));
    expect(hero).toContain('generated catalog');
    expect(hero).toContain('>New pinout</span>');
    expect(hero).toContain('router.navigateCatalog()');
    expect(hero).toContain('<QuickSearchBar');
    expect(hero).not.toContain('PerimeterPackage');
    expect(hero).not.toContain('GridPackage');
    expect(hero).not.toContain('ExportModal');
  });

  it('keeps catalog loading and the hero search surfaces', () => {
    expect(page).toContain('catalogStore.ensureLoaded()');
    expect(page).toContain('<QuickSearchBar');
    expect(page).toContain('<RecentSessions');
    const search = read('src/components/landing/QuickSearchBar.svelte');
    expect(search).toContain('Ctrl+K');
    expect(search).toContain('buildVendorTabs');
    expect(search).toContain('catalogStore.indexError');
    expect(search).toContain('Retry catalog load');
    expect(search).toContain('No parts matched your filter criteria.');
    expect(search).toContain('export function focusInput()');
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

  it('uses daisyUI alert and loading classes on quick-search and catalog facts', () => {
    const search = read('src/components/landing/QuickSearchBar.svelte');
    expect(search).toContain('alert alert-soft alert-error');
    expect(search).toContain('loading loading-spinner loading-xs');
    expect(page).toContain('alert alert-soft alert-error');
    expect(page).toContain('Catalog statistics unavailable.');
    expect(page).toContain('loading loading-spinner loading-xs');
  });
});

describe('start screen vendor copy', () => {
  it('names all six vendors and avoids claim badges', () => {
    expect(page).toContain('STM32');
    expect(page).toContain('CH32');
    expect(page).toContain('RP');
    expect(page).toContain('ESP32');
    expect(page).toContain('Microchip SAM');
    expect(page).toContain('Nordic');
    expect(page).not.toContain('Static / no backend');
    expect(page).not.toContain('Open datasets');
    expect(page).not.toContain('offline-ready');
  });
});

describe('start screen icon provenance', () => {
  it('uses Solar bold duotone icons on the landing and discovery surfaces', () => {
    for (const rel of [
      'src/pages/LandingPage.svelte',
      'src/components/landing/QuickSearchBar.svelte',
      'src/components/landing/RecentSessions.svelte',
    ]) {
      const source = read(rel);
      expect(source, rel).not.toContain('lucide-svelte');
      expect(source, rel).toContain('@solar-icons/svelte/bold-duotone/');
    }
    expect(page).not.toContain('RefreshCw');
    expect(read('src/components/landing/QuickSearchBar.svelte')).toContain(
      '@solar-icons/svelte/bold-duotone/magnifier',
    );
    expect(recent).toContain('@solar-icons/svelte/bold-duotone/clock-circle');
  });
});

describe('start screen actions', () => {
  it('exposes the secondary entry points with their existing flows', () => {
    for (const label of [
      'New pinout',
      'Choose a board preset',
      'Import .ioc',
      'Import pinout.json',
      'Compare',
    ]) {
      expect(page, label).toContain(label);
    }
    expect(page).toContain('router.navigateCatalog()');
    expect(page).toContain('parsePinoutJson(');
    expect(page).toContain('catalogStore.retry()');
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

describe('hero catalog facts', () => {
  const heroStart = page.indexOf('data-zone="hero"');
  const bodyStart = page.indexOf('data-zone="actions"');
  const hero = page.slice(heroStart, bodyStart);

  it('reads generated part, vendor, and sync values and offers a retry', () => {
    expect(hero).toContain('catalogStore.meta');
    expect(hero).toContain('catalogStore.index.length.toLocaleString()');
    expect(hero).toContain('vendorCount');
    expect(hero).toContain('Synced {formatSyncDate(catalogStore.meta.generatedAt)}');
    expect(page).toContain('Catalog statistics unavailable.');
    expect(page).toContain('catalogStore.retry()');
    expect(page).toContain('Retry catalog load');
    expect(page).not.toContain('ratios.');
    expect(page).not.toContain('match {');
    expect(page).not.toContain('coverage {');
    expect(page).not.toContain('PROVENANCE_SOURCES.length');
    expect(fs.existsSync(path.join(ROOT, 'public', 'data', 'meta.json'))).toBe(true);
  });

  it('leaves shortcut reference to the shared dialog', () => {
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

describe('recent sessions as compact rows', () => {
  it('renders saved fields with Reopen and Delete and no starter-chip grid', () => {
    for (const token of [
      'recentSessions: RecentSession[]',
      'onOpenMcu: (mcuId: string) => void',
      'onDeleteRecent: (mcuId: string) => void',
      'session.mcuId',
      'session.packageName',
      'session.assignedCount',
      'session.pinCount',
      'formatRelativeTime(session.updatedAt)',
      'Reopen',
      'onDeleteRecent(session.mcuId)',
    ]) {
      expect(recent, token).toContain(token);
    }
    expect(page).toContain('<RecentSessions');
    expect(page).toContain('workspaceStore.deleteRecentSession(id)');
    for (const token of ['STARTER_CHIPS', 'moduleIds', 'Cross-Vendor Starter Chips', 'id="presets"']) {
      expect(page, token).not.toContain(token);
      expect(recent, token).not.toContain(token);
    }
    expect(recent).not.toContain('card card-border group');
    expect(fs.existsSync(path.join(ROOT, 'src', 'components', 'landing', 'PresetGrid.svelte'))).toBe(
      false,
    );
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

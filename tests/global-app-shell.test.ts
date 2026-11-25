import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHash } from '../src/state/router.svelte';
import { createEmptyWorkspace } from '../src/core/solver';
import { exportPinoutJson } from '../src/core/exporters/json';
import { encodeWorkspaceState } from '../src/core/url-state';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('global shell mount and routes', () => {
  const app = read('src/App.svelte');

  it('mounts exactly one shell around all six route bodies', () => {
    expect(app.match(/<AppShell>/g)?.length).toBe(1);
    expect(app.match(/<\/AppShell>/g)?.length).toBe(1);
    for (const page of ['LandingPage', 'CatalogPage', 'ProjectsPage', 'AboutPage', 'WorkspacePage']) {
      expect(app, page).toContain(`<${page}`);
    }
    expect(app.match(/<WorkspacePage\b/g)?.length).toBe(2);
    expect(read('src/components/shell/AppShell.svelte')).toContain('<GlobalSidebar />');
  });

  it('resolves every hash route and keeps unknown hashes on home', () => {
    expect(parseHash('#/')).toEqual({ view: 'landing' });
    expect(parseHash('#/catalog')).toEqual({ view: 'catalog' });
    expect(parseHash('#/projects')).toEqual({ view: 'projects' });
    expect(parseHash('#/about')).toEqual({ view: 'about' });
    expect(parseHash('#/mcu/RP2040')).toEqual({ view: 'workspace', mcuId: 'RP2040' });
    expect(parseHash('#/s/payload')).toEqual({ view: 'shared', payload: 'payload' });
    expect(parseHash('#/elsewhere')).toEqual({ view: 'landing' });
    const router = read('src/state/router.svelte.ts');
    for (const helper of ['navigateHome', 'navigateCatalog', 'navigateProjects', 'navigateAbout']) {
      expect(router, helper).toContain(helper);
    }
  });
});

describe('collapsible sidebar overlay', () => {
  const sidebar = read('src/components/shell/GlobalSidebar.svelte');

  it('renders a fixed collapse overlay that never resizes page content', () => {
    expect(sidebar).toContain('shell-rail w-12');
    expect(sidebar).toContain('w-72');
    expect(sidebar).toContain('class="shell-backdrop fixed inset-0 z-30');
    expect(sidebar).toContain('shell-panel fixed inset-y-0 left-0 z-40');
    expect(sidebar).toContain('shellPreferences.sidebarExpanded = !expanded');
    expect(sidebar).toContain('shellPreferences.sidebarExpanded = false');
    const css = read('src/app.css');
    expect(css).toContain('--shell-panel-z: 40');
    expect(css).toContain('--shell-backdrop-z: 30');
    expect(css).toContain('z-index: var(--shell-panel-z)');
  });

  it('offers four section entries with active-route indication', () => {
    for (const entry of [
      "hash: '#/'",
      "hash: '#/catalog'",
      "hash: '#/projects'",
      "hash: '#/about'",
      "label: 'Home screen'",
      "label: 'Catalog screen'",
      "label: 'Projects screen'",
      "label: 'About'",
    ]) {
      expect(sidebar, entry).toContain(entry);
    }
    expect(sidebar).toContain('aria-current={activeSection === section.id ? \'page\' : undefined}');
    expect(sidebar).toContain('router.navigateCatalog()');
    expect(sidebar).toContain('router.navigateProjects()');
    expect(sidebar).toContain('router.navigateAbout()');
  });

  it('lists ten recent sessions with open and delete wiring', () => {
    expect(sidebar).toContain('workspaceStore.recentSessions.slice(0, 10)');
    expect(sidebar).toContain('openRecent(session.mcuId)');
    expect(sidebar).toContain('void workspaceStore.openMcu(mcuId)');
    expect(sidebar).toContain('deleteRecent(session.mcuId)');
    expect(sidebar).toContain('workspaceStore.deleteRecentSession(mcuId)');
    expect(sidebar).toContain('No recent projects.');
    const workspace = read('src/state/workspace.svelte.ts');
    expect(workspace).toContain("'pincraft:recent_sessions_v1'");
    expect(workspace).toContain('const MAX_RECENT = 10');
  });
});

describe('catalog route', () => {
  const page = read('src/pages/CatalogPage.svelte');

  it('browses the generated index with query, vendor, family and package filters', () => {
    expect(page).toContain('catalogStore.index');
    expect(page).toContain('searchCatalogEntries(');
    expect(page).toContain('buildVendorTabs(');
    expect(page).toContain('catalogFamilies(');
    expect(page).toContain('catalogPackageKinds(');
    expect(page).toContain('vendorFilter');
    expect(page).toContain('familyFilter');
    expect(page).toContain('packageFilter');
    expect(page).toContain('router.navigateMcu(entry.id)');
  });

  it('shows a retryable failure and a pending state instead of an empty list', () => {
    expect(page).toContain('catalogStore.indexError');
    expect(page).toContain('catalogStore.retry()');
    expect(page).toContain('Retry catalog load');
    expect(page).toContain('catalogStore.loadingIndex');
    expect(page).toContain('Loading multi-vendor catalog...');
  });

  it('shows the generated module marker without a hardcoded part table', () => {
    expect(page).toContain('{#if entry.module}');
    expect(page).toContain('MODULE');
    expect(page).not.toContain('ESP32-WROOM-E');
  });
});

describe('projects route', () => {
  const page = read('src/pages/ProjectsPage.svelte');

  it('lists recent sessions with open, delete and an empty-state link', () => {
    expect(page).toContain('workspaceStore.recentSessions.slice(0, 10)');
    expect(page).toContain('workspaceStore.openMcu(mcuId)');
    expect(page).toContain('workspaceStore.deleteRecentSession(mcuId)');
    expect(page).toContain('No recent projects');
    expect(page).toContain('href="#/catalog"');
  });

  it('imports and exports version-2 project files only', () => {
    expect(page).toContain('parsePinoutJson(');
    expect(page).toContain('exportPinoutJson(');
    expect(page).toContain('workspaceStore.setPendingHandoff(parsed.state)');
    expect(page).toContain('router.navigateMcu(parsed.state.mcuId)');
    expect(page).toContain('application/json');
    const state = createEmptyWorkspace('STM32G431CBU6');
    const project = exportPinoutJson(state);
    expect(project).not.toContain('sidebarExpanded');
    expect(project).not.toContain('aboutTab');
    expect(encodeWorkspaceState(state)).not.toContain('shell');
  });
});

describe('about route', () => {
  const page = read('src/pages/AboutPage.svelte');

  it('presents catalog statistics, provenance and the shortcut reference', () => {
    expect(page).toContain('catalogStore.meta.chipCount');
    expect(page).toContain('catalogStore.meta.families.length');
    expect(page).toContain('<ProvenancePanel');
    const panel = read('src/components/about/ProvenancePanel.svelte');
    expect(panel).toContain('PROVENANCE_SOURCES');
    expect(panel).toContain('PROVENANCE_VENDORS');
    expect(panel).toContain('SHORTCUTS');
    expect(panel).toContain('catalogStore.meta');
  });

  it('persists the selected tab through the shell preference store', () => {
    expect(page).toContain('shellPreferences.aboutTab');
    expect(page).toContain('ABOUT_TABS');
    expect(page).toContain('aria-selected={shellPreferences.aboutTab === tab}');
    expect(read('src/state/shell-preferences.svelte.ts')).toContain(
      "'pincraft:shell_preferences_v1'",
    );
  });

  it('tolerates missing metadata without dropping the shortcut reference', () => {
    expect(page).toContain('catalogStore.indexError');
    expect(page).toContain('catalogStore.retry()');
    expect(page).toContain('Loading catalog statistics...');
    const panel = read('src/components/about/ProvenancePanel.svelte');
    expect(panel).toContain('Catalog statistics unavailable');
    expect(panel).toContain('SHORTCUTS');
  });
});

describe('start screen redirect', () => {
  it('opens the catalog from New pinout and keeps its quick actions', () => {
    const page = read('src/pages/LandingPage.svelte');
    expect(page).toContain('router.navigateCatalog()');
    expect(page).toContain('focusQuickSearch');
    expect(page).toContain('<QuickSearchBar');
    expect(page).toContain('<BoardSelectorModal');
    expect(page).toContain('<PinoutDiffModal');
    expect(page).not.toContain('id="provenance"');
  });
});

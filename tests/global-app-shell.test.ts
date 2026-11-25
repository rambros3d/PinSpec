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
    const shell = read('src/components/shell/AppShell.svelte');
    expect(shell).toContain('<GlobalSidebar />');
    expect(shell.match(/<GlobalTopBar\s*\/>/g)?.length).toBe(1);
    expect(shell).toContain('<ShortcutHelpDialog');
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

describe('global top bar', () => {
  const bar = read('src/components/shell/GlobalTopBar.svelte');
  const shell = read('src/components/shell/AppShell.svelte');

  it('is the only navigation and action bar on every route', () => {
    expect(bar).toContain('class="global-top-bar h-12 shrink-0');
    expect(shell).toContain('<GlobalTopBar />');
    for (const file of [
      'src/pages/LandingPage.svelte',
      'src/pages/CatalogPage.svelte',
      'src/pages/ProjectsPage.svelte',
      'src/pages/AboutPage.svelte',
      'src/pages/WorkspacePage.svelte',
    ]) {
      expect(read(file), file).not.toContain('class="navbar');
    }
    expect(read('src/pages/WorkspacePage.svelte')).not.toContain('TopToolbar');
    expect(fs.existsSync(path.join(ROOT, 'src/components/workspace/TopToolbar.svelte'))).toBe(false);
  });

  it('shows the wordmark on shell routes and merges workspace actions', () => {
    expect(bar).toContain('{#if !isWorkspace}');
    expect(bar).toContain('PinCraft');
    for (const token of [
      'router.navigateCatalog()',
      'router.navigateProjects()',
      '<ThemePicker compact={true} />',
      'topBarUI.shortcutHelpOpen = true',
      'topBarUI.switcherOpen = true',
      'workspaceStore.globalSearch',
      'workspaceStore.undo()',
      'workspaceStore.redo()',
      'workspaceStore.clearAll()',
      'topBarUI.finderOpen = true',
      'topBarUI.diffOpen = true',
      'handleShare()',
      'topBarUI.exportOpen = true',
    ]) {
      expect(bar, token).toContain(token);
    }
    expect(bar).toContain('topBarUI.focusSearch = () =>');
    expect(bar).toContain('searchInputRef?.select()');
    for (const token of ['overflow-x-auto', 'min-w-0', 'shouldShowScrollAffordance']) {
      expect(bar, token).toContain(token);
    }
    const state = read('src/state/top-bar-ui.svelte.ts');
    for (const field of [
      'workspaceMode',
      'switcherOpen',
      'exportOpen',
      'finderOpen',
      'diffOpen',
      'shortcutHelpOpen',
      'focusSearch',
    ]) {
      expect(state, field).toContain(field);
    }
    expect(state).toContain('Nothing here is persisted');
  });

  it('shows an inline-editable project-name pill beside the MCU pill', () => {
    expect(bar).toContain('workspaceStore.state.projectName ?? \'Unnamed project\'');
    expect(bar).toContain('aria-label="Rename project"');
    expect(bar).toContain('aria-label="Project name"');
    expect(bar).toContain('beginNameEdit()');
    expect(bar).toContain('workspaceStore.renameProject(nameDraft)');
    expect(bar).toContain('cancelNameEdit()');
    expect(bar).toContain('onblur={commitName}');
    expect(bar).toContain('e.key === \'Enter\'');
    expect(bar).toContain('e.key === \'Escape\'');
    const mcu = bar.indexOf('title="Switch MCU"');
    const pill = bar.indexOf('aria-label="Rename project"');
    expect(mcu).toBeGreaterThan(-1);
    expect(pill).toBeGreaterThan(mcu);
  });

  it('opens the same help dialog on every route through the shared flag', () => {
    expect(bar).toContain('topBarUI.shortcutHelpOpen = true');
    expect(shell).toContain('topBarUI.shortcutHelpOpen');
    expect(shell).toContain('ShortcutHelpDialog');
    expect(bar).not.toContain("'#/about'");
  });
});

describe('collapsible sidebar overlay', () => {
  const sidebar = read('src/components/shell/GlobalSidebar.svelte');

  it('renders a fixed collapse overlay that never resizes page content', () => {
    expect(sidebar).toContain('shell-rail w-12');
    expect(sidebar).toContain('w-72');
    expect(sidebar).toContain('class="shell-backdrop fixed inset-0 z-30');
    expect(sidebar).toContain('shell-panel fixed bottom-0 left-0 top-12 z-40');
    expect(sidebar).toContain('shellPreferences.sidebarExpanded = false');
    expect(sidebar).toContain('PanelLeftClose');
    expect(sidebar).toContain('PanelLeftOpen');
    expect(sidebar).toContain('shellPreferences.sidebarExpanded = !expanded');
    expect(read('src/components/shell/GlobalTopBar.svelte')).not.toContain(
      'shellPreferences.sidebarExpanded = !expanded',
    );
    const css = read('src/app.css');
    expect(css).toContain('--shell-panel-z: 40');
    expect(css).toContain('--shell-backdrop-z: 30');
    expect(css).toContain('z-index: var(--shell-panel-z)');
    expect(css).toContain('top: 3rem;');
    const contentBlock = css.match(/\.app-shell-content\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(contentBlock).toContain('padding-left: 3rem');
  });

  it('offers the five section entries with active-route indication', () => {
    for (const entry of [
      "hash: '#/'",
      "hash: '#/catalog'",
      "hash: '#/projects'",
      "hash: '#/about'",
      "label: 'Home'",
      "label: 'Workspace'",
      "label: 'Catalog'",
      "label: 'Projects'",
      "label: 'About'",
    ]) {
      expect(sidebar, entry).toContain(entry);
    }
    expect(sidebar).not.toMatch(/label: '[^']*screen/i);
    expect(sidebar).toContain('aria-current={activeSection === section.id ? \'page\' : undefined}');
    expect(sidebar).toContain('router.navigateCatalog()');
    expect(sidebar).toContain('router.navigateProjects()');
    expect(sidebar).toContain('router.navigateAbout()');
    const top = sidebar.indexOf("id: 'home'");
    const workspace = sidebar.indexOf("id: 'workspace'");
    const projects = sidebar.indexOf("id: 'projects'");
    expect(workspace).toBeGreaterThan(top);
    expect(projects).toBeGreaterThan(workspace);
  });

  it('resolves the Workspace entry from the loaded chip or the most recent session', () => {
    expect(sidebar).toContain('workspaceStore.chip?.id');
    expect(sidebar).toContain('workspaceStore.recentSessions[0]?.mcuId');
    expect(sidebar).toContain('router.navigateMcu(workspaceTarget)');
    expect(sidebar).toContain('void workspaceStore.openMcu(workspaceTarget)');
    expect(sidebar).toContain('href={`#/mcu/${workspaceTarget}`}');
    expect(sidebar).toContain('disabled');
    expect(sidebar).toContain('cursor-not-allowed opacity-40');
    const disabled = sidebar.indexOf('cursor-not-allowed opacity-40');
    const firstSection = sidebar.indexOf('{#each TOP_SECTIONS');
    const recent = sidebar.indexOf('Recent projects');
    expect(disabled).toBeGreaterThan(firstSection);
    expect(disabled).toBeLessThan(recent);
  });

  it('keeps recent sessions between the top and bottom groups', () => {
    expect(sidebar).toContain('const TOP_SECTIONS = SECTIONS.filter');
    expect(sidebar).toContain('const BOTTOM_SECTIONS = SECTIONS.filter');
    expect(sidebar).toContain('role="separator"');
    const top = sidebar.indexOf('{#each TOP_SECTIONS');
    const recent = sidebar.indexOf('Recent projects');
    const separator = sidebar.indexOf('role="separator"');
    const bottom = sidebar.indexOf('{#each BOTTOM_SECTIONS');
    expect(top).toBeLessThan(recent);
    expect(recent).toBeLessThan(separator);
    expect(separator).toBeLessThan(bottom);
  });

  it('shows saved project names on recent-session entries', () => {
    expect(sidebar).toContain('{#if session.state.projectName}');
    expect(sidebar).toContain('{session.state.projectName}');
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

  it('browses the generated index with locally persisted query, vendor, family and package filters', () => {
    expect(page).toContain('catalogStore.index');
    expect(page).toContain('searchCatalogEntries(');
    expect(page).toContain('buildVendorTabs(');
    expect(page).toContain('catalogFamilies(');
    expect(page).toContain('catalogPackageKinds(');
    expect(page).toContain('discoveryPreferences.catalog');
    for (const field of [
      'filters.query',
      'filters.vendor',
      'filters.family',
      'filters.package',
    ]) {
      expect(page, field).toContain(field);
    }
    expect(page).toContain('filters.reset()');
    expect(read('src/state/discovery-preferences.svelte.ts')).toContain(
      "'pincraft:discovery_preferences_v1'",
    );
    expect(page).toContain('router.navigateMcu(entry.id)');
  });

  it('shows a retryable failure and a pending state instead of an empty list', () => {
    expect(page).toContain('catalogStore.indexError');
    expect(page).toContain('catalogStore.retry()');
    expect(page).toContain('Retry catalog load');
    expect(page).toContain('catalogStore.loadingIndex');
    expect(page).toContain('Loading multi-vendor catalog...');
    expect(page).toContain('alert alert-soft alert-error');
    expect(page).toContain('loading loading-spinner loading-xs');
  });

  it('shows the generated module marker without a hardcoded part table', () => {
    expect(page).toContain('{#if entry.module}');
    expect(page).toContain('MODULE');
    expect(page).not.toContain('ESP32-WROOM-E');
  });

  it('leads each dense result row with a decorative package thumbnail', () => {
    expect(page).toContain('<PackageThumbnail');
    expect(page).toContain('size={44}');
    expect(page).toContain('Outline');
    expect(page).toContain('MAX_THUMBNAIL_REFINEMENTS');
    expect(page).toContain('use:observeRow={entry.id}');
    expect(page).toContain('searchCatalogEntries(');
    expect(page).toContain('500,');
  });
});

describe('projects route', () => {
  const page = read('src/pages/ProjectsPage.svelte');

  it('lists recent sessions as cards with a thumbnail and open, export and delete actions', () => {
    expect(page).toContain('workspaceStore.recentSessions.slice(0, 10)');
    expect(page).toContain('workspaceStore.openMcu(mcuId)');
    expect(page).toContain('workspaceStore.deleteRecentSession(mcuId)');
    expect(page).toContain('exportSession(session.mcuId)');
    expect(page).toContain('approximateThumbnailGeometry(session.packageName, session.pinCount)');
    expect(page).toContain('No recent projects');
    expect(page).toContain('href="#/catalog"');
    expect(page).not.toContain('<table');
  });

  it('shows and renames the saved project name on each card', () => {
    expect(page).toContain('session.state.projectName');
    expect(page).toContain('beginRename(session.mcuId, session.state.projectName)');
    expect(page).toContain('aria-label={`Rename ${session.mcuId}`}');
    expect(page).toContain('workspaceStore.renameProject(nameDraft, mcuId)');
    expect(page).toContain('onblur={commitRename}');
    expect(page).toContain('cancelRename()');
    expect(page).toContain('maxlength="48"');
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
  const panel = read('src/components/about/ProvenancePanel.svelte');

  it('presents one grouped Catalog sources table with totals in its header', () => {
    expect(page).toContain('<ProvenancePanel');
    expect(page).not.toContain('Catalog summary');
    expect(panel).toContain('Catalog sources');
    expect(panel).toContain('catalogStore.meta.chipCount.toLocaleString()');
    expect(panel).toContain('catalogStore.meta.families.length');
    expect(panel).toContain('PROVENANCE_SOURCES');
    expect(panel).toContain('PROVENANCE_VENDORS');
    expect(panel).toContain('catalogStore.meta.sources?.[vendor.id]');
    expect(panel).toContain('catalogStore.meta.sources?.[sourceId]');
    expect(panel).not.toContain('Per-vendor chip counts and source revisions');
    expect(panel).not.toContain('Upstream data sources and licenses');
  });

  it('persists the sources tab through the shell preference store', () => {
    expect(page).toContain('shellPreferences.aboutTab');
    expect(page).toContain('ABOUT_TABS');
    expect(page).toContain('aria-selected={shellPreferences.aboutTab === tab}');
    expect(page).not.toContain('Shortcuts');
    expect(read('src/state/shell-preferences.svelte.ts')).toContain(
      "'pincraft:shell_preferences_v1'",
    );
    expect(read('src/state/shell-preferences.svelte.ts')).toContain(
      "ABOUT_TABS = ['sources']",
    );
    expect(page).toContain('class="tabs tabs-box w-fit"');
    expect(page).not.toContain('tabs-boxed');
  });

  it('keeps loading and retry states on the merged surface', () => {
    expect(page).toContain('catalogStore.ensureLoaded()');
    expect(panel).toContain('catalogStore.indexError');
    expect(panel).toContain('catalogStore.retry()');
    expect(panel).toContain('Retry catalog load');
    expect(panel).toContain('Loading catalog statistics...');
    expect(panel).toContain('Catalog statistics unavailable');
    expect(panel).not.toContain('SHORTCUTS');
    expect(panel).toContain('alert alert-soft alert-error');
    expect(panel).toContain('loading loading-spinner loading-xs');
  });

  it('offers a Hotkeys entry immediately above About without a route', () => {
    const sidebar = read('src/components/shell/GlobalSidebar.svelte');
    expect(sidebar).toContain('Keyboard');
    expect(sidebar).toContain('>Hotkeys<');
    expect(sidebar).toContain("section.id === 'about'");
    expect(sidebar).toContain('topBarUI.shortcutHelpOpen = true');
    expect(sidebar).not.toContain("'#/hotkeys'");
    const hotkeys = sidebar.indexOf('>Hotkeys<');
    const about = sidebar.indexOf('{section.label}', hotkeys);
    expect(hotkeys).toBeGreaterThan(-1);
    expect(about).toBeGreaterThan(hotkeys);
  });
});

describe('shell documentation', () => {
  it('documents local-only discovery filters and the Workspace sidebar target', () => {
    const readme = read('README.md');
    expect(readme).toContain('pincraft:discovery_preferences_v1');
    expect(readme).toContain('Catalog and quick-search discovery filters');
    expect(readme).toContain('absent from share URLs, version-2 project files');
    expect(readme).toContain('Home, Workspace, and Projects form the top group');
    expect(readme).toContain('Workspace appears next to Home');
    expect(readme).toContain('most recent local session');
    expect(readme).toContain('word-word-family');
    expect(readme).toContain('shareable pin-planning metadata');
    expect(readme).toContain('version-2 share URLs');
    expect(readme).toContain('inline editing mode itself is component-local');
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

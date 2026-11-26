import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHash } from '../src/state/router.svelte';
import { topBarUI } from '../src/state/top-bar-ui.svelte';
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
    expect(shell.match(/<PinoutDiffModal/g)?.length).toBe(1);
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
    expect(bar.match(/<ThemePicker compact=\{true\} \/>/g)?.length).toBe(2);
    for (const token of ['overflow-x-auto', 'min-w-0', 'shouldShowScrollAffordance']) {
      expect(bar, token).toContain(token);
    }
    const state = read('src/state/top-bar-ui.svelte.ts');
    for (const field of [
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

  it('shows an inline-editable project name at the left edge before the MCU pill', () => {
    expect(bar).toContain('workspaceStore.state.projectName ?? \'Unnamed project\'');
    for (const hook of [
      'aria-label="Rename project"',
      'aria-label="Project name"',
      'beginNameEdit()',
      'workspaceStore.renameProject(nameDraft)',
      'cancelNameEdit()',
      'onblur={commitName}',
      'e.stopPropagation()',
      'e.key === \'Enter\'',
      'e.key === \'Escape\'',
    ]) {
      expect(bar, hook).toContain(hook);
    }
    const routeTitle = bar.match(/const routeTitle = \$derived\([\s\S]*?\n  \);/)?.[0] ?? '';
    expect(routeTitle).not.toContain('workspaceStore.chip?.id');
    const title = bar.indexOf('workspaceStore.state.projectName ?? \'Unnamed project\'');
    const mcu = bar.indexOf('title="Switch MCU (Ctrl+K)"');
    const undo = bar.indexOf('aria-label="Undo"');
    expect(title).toBeGreaterThan(-1);
    expect(title).toBeLessThan(mcu);
    expect(mcu).toBeLessThan(undo);
  });

  it('renders find in the canvas HUD and right-aligns workspace actions through Theme', () => {
    for (const token of ['workspaceStore.globalSearch', 'searchInputRef', 'topBarUI.focusSearch']) {
      expect(bar, token).not.toContain(token);
    }
    const canvas = read('src/components/workspace/PackageCanvas.svelte');
    for (const token of [
      'workspaceStore.globalSearch',
      'workspaceStore.searchMatchingPins.length',
      'topBarUI.focusSearch = () =>',
      'searchInputRef?.select()',
      'aria-label="Find pin or signal"',
      'data-placement-furniture',
    ]) {
      expect(canvas, token).toContain(token);
    }
    const firstGroup = bar.indexOf('class="ml-auto flex shrink-0 items-center gap-1"');
    const secondGroup = bar.indexOf('class="ml-auto flex shrink-0 items-center gap-1"', firstGroup + 1);
    expect(firstGroup).toBeGreaterThan(-1);
    expect(secondGroup).toBeGreaterThan(firstGroup);
    const workspaceActions = bar.slice(firstGroup, secondGroup);
    const shellActions = bar.slice(secondGroup);
    expect(workspaceActions).toContain('aria-label="Undo"');
    expect(workspaceActions).toContain('<ThemePicker compact={true} />');
    expect(workspaceActions.indexOf('<ThemePicker compact={true} />')).toBeGreaterThan(
      workspaceActions.indexOf('topBarUI.exportOpen = true'),
    );
    expect(workspaceActions.indexOf('class="ml-auto')).toBeLessThan(
      workspaceActions.indexOf('aria-label="Undo"'),
    );
    expect(workspaceActions).not.toContain('Rotate package clockwise');
    expect(shellActions).toContain('aria-label="Keyboard shortcuts"');
    expect(shellActions).not.toContain('aria-label="Undo"');
  });

  it('opens the same help dialog on every route through the shared flag', () => {
    expect(bar).toContain('topBarUI.shortcutHelpOpen = true');
    expect(shell).toContain('topBarUI.activeDialog === \'shortcutHelp\'');
    expect(shell).toContain('ShortcutHelpDialog');
    expect(bar).not.toContain("'#/about'");
  });

  it('backs every dialog flag with one typed active dialog', () => {
    const store = read('src/state/top-bar-ui.svelte.ts');
    expect(store).toContain("export type DialogKind = 'switcher' | 'export' | 'finder' | 'diff' | 'shortcutHelp';");
    expect(store).toContain('activeDialog = $state<DialogKind | null>(null)');
    for (const name of ['switcher', 'export', 'finder', 'diff', 'shortcutHelp']) {
      expect(store, name).toContain(`get ${name}Open()`);
      expect(store, name).toContain(`set ${name}Open(`);
    }
    expect(store).toContain('this.activeDialog = null');
  });

  it('keeps one dialog active and clears flags through the shared owner', () => {
    topBarUI.reset();
    expect(topBarUI.activeDialog).toBeNull();
    topBarUI.diffOpen = true;
    expect(topBarUI.activeDialog).toBe('diff');
    expect(topBarUI.diffOpen).toBe(true);
    topBarUI.shortcutHelpOpen = true;
    expect(topBarUI.activeDialog).toBe('shortcutHelp');
    expect(topBarUI.diffOpen).toBe(false);
    topBarUI.shortcutHelpOpen = false;
    expect(topBarUI.activeDialog).toBeNull();
    topBarUI.switcherOpen = true;
    topBarUI.reset();
    expect(topBarUI.activeDialog).toBeNull();
    expect(topBarUI.switcherOpen).toBe(false);
  });
});

describe('shell icon provenance', () => {
  it('uses Solar bold duotone icons on shell surfaces', () => {
    for (const rel of [
      'src/components/shell/GlobalSidebar.svelte',
      'src/components/shell/GlobalTopBar.svelte',
      'src/components/ThemePicker.svelte',
    ]) {
      const source = read(rel);
      expect(source, rel).not.toContain('lucide-svelte');
      expect(source, rel).toMatch(/from '@solar-icons\/svelte\/bold-duotone\/[a-z0-9-]+'/);
    }
    const sidebar = read('src/components/shell/GlobalSidebar.svelte');
    expect(sidebar).toContain("import Home from '@solar-icons/svelte/bold-duotone/home'");
    expect(sidebar).toContain('PanelLeftClose');
    expect(sidebar).toContain('PanelLeftOpen');
    const picker = read('src/components/ThemePicker.svelte');
    for (const slug of ['monitor', 'sun', 'moon']) {
      expect(picker, slug).toContain(`@solar-icons/svelte/bold-duotone/${slug}`);
    }
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

  it('colors section icons with accent while labels keep their foreground', () => {
    expect(sidebar).toContain('function sectionIconClass(section: Section): string');
    expect(sidebar).toContain("activeSection === section.id ? 'text-info' : 'text-accent'");
    expect(sidebar).toContain('<Icon class={sectionIconClass(section)} />');
    expect(sidebar).toContain('<Keyboard class="size-4 shrink-0 text-accent" />');
    expect(sidebar).toContain('<PanelLeftClose class="size-4 shrink-0 text-accent" />');
    expect(sidebar).toContain('<PanelLeftOpen class="size-4 shrink-0 text-accent" />');
    expect(sidebar.match(/<Icon class=\{sectionIconClass\(section\)\} \/>/g)?.length).toBe(4);
    const sectionClassFn =
      sidebar.match(/function sectionClass\(section: Section\): string \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(sectionClassFn).toContain('text-base-content/70');
    expect(sectionClassFn).not.toContain('text-accent');
    expect(sidebar).toContain('class="truncate text-xs">{section.label}</span>');
    expect(sidebar).not.toMatch(/<a[^>]*text-accent[^>]*>/);
    expect(sidebar).not.toMatch(/<button[^>]*text-accent[^>]*>/);
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
    expect(page).toContain('thumbnailGeometryFromIndex(entry)');
    expect(page).not.toContain('IntersectionObserver');
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
    expect(page).toContain('thumbnailGeometryFromSaved(session.packageName, session.pinCount)');
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
    expect(panel).toContain('catalogStore.index.length.toLocaleString()');
    expect(panel).toContain('familyCount');
    expect(panel).toContain('PROVENANCE_SOURCES');
    expect(panel).toContain('PROVENANCE_VENDORS');
    expect(panel).toContain('catalogStore.meta.sources?.[vendor.id]');
    expect(panel).toContain('catalogStore.meta.sources?.[sourceId]');
    expect(panel).not.toContain('Per-vendor chip counts and source revisions');
    expect(panel).not.toContain('Upstream data sources and licenses');
  });

  it('renders one static provenance surface with no tab preference', () => {
    expect(page).not.toContain('shellPreferences');
    expect(page).not.toContain('ABOUT_TABS');
    expect(page).not.toContain('role="tablist"');
    expect(page).not.toContain('aria-selected');
    expect(page).not.toContain('Shortcuts');
    expect(panel).not.toContain('AboutTab');
    expect(panel).not.toContain('sr-only');
    expect(read('src/state/shell-preferences.svelte.ts')).toContain(
      "'pincraft:shell_preferences_v1'",
    );
    expect(read('src/state/shell-preferences.svelte.ts')).not.toContain('aboutTab');
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
    expect(readme).toContain('two curated words');
    expect(readme).not.toContain('word-word-family');
    expect(readme).toContain('Home, Workspace, and Projects form the top group');
    expect(readme).toContain('Workspace appears next to Home');
    expect(readme).toContain('most recent local session');
    expect(readme).toContain('word-word');
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
    expect(page).toContain('topBarUI.diffOpen = true');
    expect(page).not.toContain('PinoutDiffModal');
    expect(page).not.toContain('id="provenance"');
  });

  it('leaves the shared Hotkeys dialog as the only shortcut reference', () => {
    const page = read('src/pages/LandingPage.svelte');
    expect(page).not.toContain('SHORTCUTS');
    expect(page).not.toContain('Shortcuts');
    expect(page).not.toContain('<kbd');
    expect(page).not.toContain('ratios.');
    expect(page).toContain('PROVENANCE_VENDORS');
    expect(page).toContain('Synced {formatSyncDate(catalogStore.meta.generatedAt)}');
    const shell = read('src/components/shell/AppShell.svelte');
    expect(shell.match(/<ShortcutHelpDialog/g)?.length).toBe(1);
    expect(read('src/pages/AboutPage.svelte')).not.toContain('SHORTCUTS');
    const sidebar = read('src/components/shell/GlobalSidebar.svelte');
    expect(sidebar).toContain('>Hotkeys<');
    expect(sidebar).toContain('topBarUI.shortcutHelpOpen = true');
  });
});
